import { PublicKey, clusterApiUrl } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import idl from '../idl/moto_escrow.json'

export const PROGRAM_ID = new PublicKey(idl.address || '6H3xC9yvLTM8YX8ruRDHbqmGySGTuQmdKSH8oW9jjhLF')

// Fixed exchange rate for hackathon MVP: 1 SOL = 4,500 THB (approx 135 USD)
export const THB_PER_SOL = 4500

export const thbToSol = (thb) => {
  const num = parseFloat(thb)
  if (isNaN(num) || num <= 0) return '0'
  const sol = num / THB_PER_SOL
  return sol.toFixed(5)
}

export const solToThb = (sol) => {
  const num = parseFloat(sol)
  if (isNaN(num) || num <= 0) return '0'
  return (num * THB_PER_SOL).toFixed(0)
}

export const thbToLamports = (thb) => {
  const num = parseFloat(thb)
  if (isNaN(num) || num <= 0) return new anchor.BN(0)
  const sol = num / THB_PER_SOL
  const lamports = Math.round(sol * 1_000_000_000)
  return new anchor.BN(lamports)
}

export const lamportsToSol = (lamports) => {
  if (!lamports) return '0'
  const val = typeof lamports === 'number' ? lamports : lamports.toNumber ? lamports.toNumber() : Number(lamports)
  return (val / 1_000_000_000).toFixed(5)
}

export const findRidePda = (driverPubkey, rideId) => {
  if (!driverPubkey) return null
  const driver = typeof driverPubkey === 'string' ? new PublicKey(driverPubkey) : driverPubkey
  const rideIdBn = typeof rideId === 'number' || typeof rideId === 'string' 
    ? new anchor.BN(rideId) 
    : rideId

  const [pda, bump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('ride'),
      driver.toBuffer(),
      rideIdBn.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  )
  return { pda, bump }
}

export const getProgram = (connection, wallet) => {
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    { preflightCommitment: 'confirmed' }
  )
  return new anchor.Program(idl, provider)
}

export const NETWORK_CONFIGS = {
  devnet: {
    name: 'Solana Devnet',
    endpoint: clusterApiUrl('devnet'),
    explorerUrl: (tx) => `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    accountUrl: (acc) => `https://explorer.solana.com/address/${acc}?cluster=devnet`,
  },
  localnet: {
    name: 'Localnet (Validator)',
    endpoint: 'http://127.0.0.1:8899',
    explorerUrl: (tx) => `https://explorer.solana.com/tx/${tx}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`,
    accountUrl: (acc) => `https://explorer.solana.com/address/${acc}?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899`,
  },
}

export const RIDE_STATUS = {
  0: { label: 'Created', color: '#f59e0b', desc: 'Awaiting rider escrow lock' },
  1: { label: 'Funded', color: '#10b981', desc: 'Fare locked in escrow! Safe to ride' },
  2: { label: 'Completed', color: '#3b82f6', desc: 'Payment released to driver' },
  3: { label: 'Cancelled', color: '#ef4444', desc: 'Ride cancelled and refunded' },
}
