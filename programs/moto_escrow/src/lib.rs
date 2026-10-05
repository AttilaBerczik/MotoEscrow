use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6H3xC9yvLTM8YX8ruRDHbqmGySGTuQmdKSH8oW9jjhLF");

#[program]
pub mod moto_escrow {
    use super::*;

    /// Driver creates ride escrow account on-chain with expected fare
    pub fn create_ride(ctx: Context<CreateRide>, ride_id: u64, fare_lamports: u64) -> Result<()> {
        require!(fare_lamports > 0, EscrowError::InvalidFare);
        let ride = &mut ctx.accounts.ride_escrow;
        ride.driver = ctx.accounts.driver.key();
        ride.rider = Pubkey::default();
        ride.ride_id = ride_id;
        ride.fare_lamports = fare_lamports;
        ride.status = RideStatus::Created as u8;
        ride.bump = ctx.bumps.ride_escrow;
        msg!("Ride created: id={}, fare={}", ride_id, fare_lamports);
        Ok(())
    }

    /// Rider funds the existing created ride
    pub fn fund_ride(ctx: Context<FundRide>) -> Result<()> {
        let ride = &mut ctx.accounts.ride_escrow;
        require!(ride.status == RideStatus::Created as u8, EscrowError::InvalidStatus);

        // Transfer fare from rider to escrow PDA
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.rider.to_account_info(),
                to: ride.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, ride.fare_lamports)?;

        ride.rider = ctx.accounts.rider.key();
        ride.status = RideStatus::Funded as u8;
        msg!("Ride funded by: {}", ctx.accounts.rider.key());
        Ok(())
    }

    /// One-step: Rider creates and funds ride directly from driver's QR code
    pub fn create_and_fund_ride(
        ctx: Context<CreateAndFundRide>,
        ride_id: u64,
        fare_lamports: u64,
    ) -> Result<()> {
        require!(fare_lamports > 0, EscrowError::InvalidFare);

        // Transfer fare from rider to escrow PDA
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.rider.to_account_info(),
                to: ctx.accounts.ride_escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, fare_lamports)?;

        let ride = &mut ctx.accounts.ride_escrow;
        ride.driver = ctx.accounts.driver.key();
        ride.rider = ctx.accounts.rider.key();
        ride.ride_id = ride_id;
        ride.fare_lamports = fare_lamports;
        ride.status = RideStatus::Funded as u8;
        ride.bump = ctx.bumps.ride_escrow;
        msg!(
            "Ride created & funded: id={}, fare={}, driver={}, rider={}",
            ride_id, fare_lamports, ride.driver, ride.rider
        );
        Ok(())
    }

    /// Rider releases the escrowed fare to the driver upon ride completion
    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        let ride = &mut ctx.accounts.ride_escrow;
        require!(ride.status == RideStatus::Funded as u8, EscrowError::InvalidStatus);
        require_keys_eq!(ctx.accounts.rider.key(), ride.rider, EscrowError::UnauthorizedRider);
        require_keys_eq!(ctx.accounts.driver.key(), ride.driver, EscrowError::UnauthorizedDriver);

        let fare = ride.fare_lamports;

        // Transfer fare lamports from escrow PDA to driver
        **ride.to_account_info().try_borrow_mut_lamports()? -= fare;
        **ctx.accounts.driver.to_account_info().try_borrow_mut_lamports()? += fare;

        ride.status = RideStatus::Completed as u8;
        msg!("Payment of {} lamports released to driver {}", fare, ride.driver);
        Ok(())
    }

    /// Cancel ride and refund fare to rider if already funded, or cancel if created
    pub fn cancel_ride(ctx: Context<CancelRide>) -> Result<()> {
        let ride = &mut ctx.accounts.ride_escrow;
        let caller = ctx.accounts.caller.key();

        if ride.status == RideStatus::Created as u8 {
            require_keys_eq!(caller, ride.driver, EscrowError::Unauthorized);
            ride.status = RideStatus::Cancelled as u8;
            msg!("Ride cancelled before funding");
        } else if ride.status == RideStatus::Funded as u8 {
            require!(
                caller == ride.rider || caller == ride.driver,
                EscrowError::Unauthorized
            );
            let fare = ride.fare_lamports;
            **ride.to_account_info().try_borrow_mut_lamports()? -= fare;
            **ctx.accounts.rider.to_account_info().try_borrow_mut_lamports()? += fare;

            ride.status = RideStatus::Cancelled as u8;
            msg!("Ride refunded: {} lamports returned to rider", fare);
        } else {
            return err!(EscrowError::InvalidStatus);
        }

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(ride_id: u64, fare_lamports: u64)]
pub struct CreateRide<'info> {
    #[account(
        init,
        payer = driver,
        space = 8 + RideEscrow::INIT_SPACE,
        seeds = [b"ride", driver.key().as_ref(), &ride_id.to_le_bytes()],
        bump
    )]
    pub ride_escrow: Account<'info, RideEscrow>,

    #[account(mut)]
    pub driver: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundRide<'info> {
    #[account(
        mut,
        seeds = [b"ride", ride_escrow.driver.as_ref(), &ride_escrow.ride_id.to_le_bytes()],
        bump = ride_escrow.bump
    )]
    pub ride_escrow: Account<'info, RideEscrow>,

    #[account(mut)]
    pub rider: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ride_id: u64, fare_lamports: u64)]
pub struct CreateAndFundRide<'info> {
    #[account(
        init,
        payer = rider,
        space = 8 + RideEscrow::INIT_SPACE,
        seeds = [b"ride", driver.key().as_ref(), &ride_id.to_le_bytes()],
        bump
    )]
    pub ride_escrow: Account<'info, RideEscrow>,

    /// CHECK: Driver recipient account
    #[account(mut)]
    pub driver: AccountInfo<'info>,

    #[account(mut)]
    pub rider: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleasePayment<'info> {
    #[account(
        mut,
        seeds = [b"ride", driver.key().as_ref(), &ride_escrow.ride_id.to_le_bytes()],
        bump = ride_escrow.bump
    )]
    pub ride_escrow: Account<'info, RideEscrow>,

    pub rider: Signer<'info>,

    /// CHECK: Driver must match ride_escrow.driver
    #[account(mut)]
    pub driver: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CancelRide<'info> {
    #[account(
        mut,
        seeds = [b"ride", driver.key().as_ref(), &ride_escrow.ride_id.to_le_bytes()],
        bump = ride_escrow.bump
    )]
    pub ride_escrow: Account<'info, RideEscrow>,

    pub caller: Signer<'info>,

    /// CHECK: Rider recipient account if refunding
    #[account(mut)]
    pub rider: AccountInfo<'info>,

    /// CHECK: Driver account
    #[account(mut)]
    pub driver: AccountInfo<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct RideEscrow {
    pub driver: Pubkey,
    pub rider: Pubkey,
    pub ride_id: u64,
    pub fare_lamports: u64,
    pub status: u8,
    pub bump: u8,
}

#[repr(u8)]
pub enum RideStatus {
    Created = 0,
    Funded = 1,
    Completed = 2,
    Cancelled = 3,
}

#[error_code]
pub enum EscrowError {
    #[msg("Fare must be greater than zero")]
    InvalidFare,
    #[msg("Invalid ride status for this operation")]
    InvalidStatus,
    #[msg("Signer is not authorized to perform this operation")]
    Unauthorized,
    #[msg("Caller is not the rider of this ride")]
    UnauthorizedRider,
    #[msg("Specified driver does not match escrow driver")]
    UnauthorizedDriver,
}
