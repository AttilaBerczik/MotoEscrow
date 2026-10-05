import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { MotoEscrow } from "../target/types/moto_escrow";
import { expect } from "chai";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";

describe("moto_escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MotoEscrow as Program<MotoEscrow>;

  // Driver and Rider keypairs
  const driver = Keypair.generate();
  const rider = Keypair.generate();

  const fareLamports = new anchor.BN(0.05 * LAMPORTS_PER_SOL); // 0.05 SOL

  // Helper to find PDA
  const getRidePda = (driverPubkey: PublicKey, rideId: anchor.BN) => {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("ride"),
        driverPubkey.toBuffer(),
        rideId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
  };

  before(async () => {
    // Fund driver and rider from provider wallet
    const fundTx1 = await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: driver.publicKey,
          lamports: 1 * LAMPORTS_PER_SOL,
        })
      )
    );
    const fundTx2 = await provider.sendAndConfirm(
      new anchor.web3.Transaction().add(
        SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: rider.publicKey,
          lamports: 1 * LAMPORTS_PER_SOL,
        })
      )
    );
  });

  it("Step 1: Driver creates ride, Rider funds ride, Rider releases payment", async () => {
    const rideId = new anchor.BN(1001);
    const ridePda = getRidePda(driver.publicKey, rideId);

    // 1. Driver creates ride
    await program.methods
      .createRide(rideId, fareLamports)
      .accounts({
        rideEscrow: ridePda,
        driver: driver.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([driver])
      .rpc();

    let escrowAccount = await program.account.rideEscrow.fetch(ridePda);
    expect(escrowAccount.driver.toBase58()).to.equal(driver.publicKey.toBase58());
    expect(escrowAccount.fareLamports.toString()).to.equal(fareLamports.toString());
    expect(escrowAccount.status).to.equal(0); // Created

    // 2. Rider funds ride
    await program.methods
      .fundRide()
      .accounts({
        rideEscrow: ridePda,
        rider: rider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([rider])
      .rpc();

    escrowAccount = await program.account.rideEscrow.fetch(ridePda);
    expect(escrowAccount.rider.toBase58()).to.equal(rider.publicKey.toBase58());
    expect(escrowAccount.status).to.equal(1); // Funded

    const driverBalBefore = await provider.connection.getBalance(driver.publicKey);

    // 3. Rider releases payment after ride
    await program.methods
      .releasePayment()
      .accounts({
        rideEscrow: ridePda,
        rider: rider.publicKey,
        driver: driver.publicKey,
      })
      .signers([rider])
      .rpc();

    escrowAccount = await program.account.rideEscrow.fetch(ridePda);
    expect(escrowAccount.status).to.equal(2); // Completed

    const driverBalAfter = await provider.connection.getBalance(driver.publicKey);
    expect(driverBalAfter - driverBalBefore).to.equal(fareLamports.toNumber());
  });

  it("Step 2: Instant QR flow — Rider creates and funds ride in 1 tx, then releases", async () => {
    const rideId = new anchor.BN(1002);
    const ridePda = getRidePda(driver.publicKey, rideId);

    const driverBalBefore = await provider.connection.getBalance(driver.publicKey);

    // Rider scans QR and executes createAndFundRide directly
    await program.methods
      .createAndFundRide(rideId, fareLamports)
      .accounts({
        rideEscrow: ridePda,
        driver: driver.publicKey,
        rider: rider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([rider])
      .rpc();

    let escrowAccount = await program.account.rideEscrow.fetch(ridePda);
    expect(escrowAccount.driver.toBase58()).to.equal(driver.publicKey.toBase58());
    expect(escrowAccount.rider.toBase58()).to.equal(rider.publicKey.toBase58());
    expect(escrowAccount.status).to.equal(1); // Funded

    // Rider completes ride and releases payment
    await program.methods
      .releasePayment()
      .accounts({
        rideEscrow: ridePda,
        rider: rider.publicKey,
        driver: driver.publicKey,
      })
      .signers([rider])
      .rpc();

    escrowAccount = await program.account.rideEscrow.fetch(ridePda);
    expect(escrowAccount.status).to.equal(2); // Completed

    const driverBalAfter = await provider.connection.getBalance(driver.publicKey);
    expect(driverBalAfter - driverBalBefore).to.equal(fareLamports.toNumber());
  });

  it("Step 3: Cancel and refund ride", async () => {
    const rideId = new anchor.BN(1003);
    const ridePda = getRidePda(driver.publicKey, rideId);

    // Create and fund
    await program.methods
      .createAndFundRide(rideId, fareLamports)
      .accounts({
        rideEscrow: ridePda,
        driver: driver.publicKey,
        rider: rider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([rider])
      .rpc();

    const riderBalBefore = await provider.connection.getBalance(rider.publicKey);

    // Rider cancels before ride
    await program.methods
      .cancelRide()
      .accounts({
        rideEscrow: ridePda,
        caller: rider.publicKey,
        rider: rider.publicKey,
        driver: driver.publicKey,
      })
      .signers([rider])
      .rpc();

    const escrowAccount = await program.account.rideEscrow.fetch(ridePda);
    expect(escrowAccount.status).to.equal(3); // Cancelled

    const riderBalAfter = await provider.connection.getBalance(rider.publicKey);
    // Rider received the fare back minus tx fee
    expect(riderBalAfter).to.be.greaterThan(riderBalBefore);
  });
});
