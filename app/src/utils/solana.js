import { PublicKey, clusterApiUrl } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import idl from '../idl/moto_escrow.json'

export const PROGRAM_ID = new PublicKey(idl.address || '6H3xC9yvLTM8YX8ruRDHbqmGySGTuQmdKSH8oW9jjhLF')

// Fixed exchange rate for hackathon MVP: 1 SOL = 4,500 THB (approx 135 USD)
export const THB_PER_SOL = 4500

export const DEFAULT_MOCK_DRIVER = '8z4yo6AnCCUshYmzo1hqm8eaqscJRLXhX4i336oLzoGy'
export const DEFAULT_MOCK_RIDER = 'Rider7x8VzN9pQrS2u4wK1e5tM3bY6hF8jL9aC4oP7qE'

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
  try {
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
  } catch (e) {
    return { pda: { toBase58: () => 'SimulatedEscrowPDA11111111111111111111111' }, bump: 255 }
  }
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

// -------------------------------------------------------------
// Cross-tab / Local Sync Store for Demo / Testing Reliability
// -------------------------------------------------------------
const STORAGE_PREFIX = 'moto_ride_'
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('moto_escrow_sync') 
  : null

export const saveSimulatedRide = (rideId, data) => {
  if (typeof window === 'undefined') return
  try {
    const existing = getSimulatedRide(rideId) || {}
    const updated = { ...existing, ...data, updatedAt: Date.now() }
    localStorage.setItem(STORAGE_PREFIX + rideId, JSON.stringify(updated))
    if (channel) {
      channel.postMessage({ type: 'RIDE_UPDATE', rideId, data: updated })
    }
    return updated
  } catch (e) {
    console.error('Error saving simulated ride:', e)
  }
}

export const getSimulatedRide = (rideId) => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + rideId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const subscribeToRideUpdates = (rideId, callback) => {
  if (typeof window === 'undefined') return () => {}

  // 1. BroadcastChannel listener
  const handleBroadcast = (event) => {
    if (event.data?.type === 'RIDE_UPDATE' && event.data.rideId === rideId) {
      callback(event.data.data)
    }
  }

  // 2. Storage event for cross-tab sync
  const handleStorage = (e) => {
    if (e.key === STORAGE_PREFIX + rideId && e.newValue) {
      try {
        callback(JSON.parse(e.newValue))
      } catch {}
    }
  }

  if (channel) channel.addEventListener('message', handleBroadcast)
  window.addEventListener('storage', handleStorage)

  return () => {
    if (channel) channel.removeEventListener('message', handleBroadcast)
    window.removeEventListener('storage', handleStorage)
  }
}
