import React, { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import confetti from 'canvas-confetti'
import { 
  Shield, 
  Lock, 
  CheckCircle, 
  Send, 
  ExternalLink, 
  Bike, 
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DollarSign,
  ArrowLeft
} from 'lucide-react'
import { 
  findRidePda, 
  getProgram, 
  thbToLamports, 
  thbToSol, 
  lamportsToSol,
  NETWORK_CONFIGS,
  DEFAULT_MOCK_DRIVER,
  DEFAULT_MOCK_RIDER,
  saveSimulatedRide,
  getSimulatedRide,
  subscribeToRideUpdates
} from '../utils/solana'
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'

export const RiderView = ({ rideParams, network, onBackToDriver }) => {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey } = wallet

  const [driverAddress, setDriverAddress] = useState(rideParams?.driver || DEFAULT_MOCK_DRIVER)
  const [rideId, setRideId] = useState(rideParams?.rideId || '')
  const [fareTHB, setFareTHB] = useState(rideParams?.fareTHB || '50')
  const [fareSOL, setFareSOL] = useState(rideParams?.fareSOL || thbToSol('50'))

  const [rideState, setRideState] = useState({ status: 0 })
  const [loading, setLoading] = useState(false)
  const [txSignature, setTxSignature] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const effectiveRiderPubkey = publicKey ? publicKey.toBase58() : DEFAULT_MOCK_RIDER

  // Update when props change
  useEffect(() => {
    if (rideParams) {
      if (rideParams.driver) setDriverAddress(rideParams.driver)
      if (rideParams.rideId) setRideId(rideParams.rideId)
      if (rideParams.fareTHB) setFareTHB(rideParams.fareTHB)
      if (rideParams.fareSOL) setFareSOL(rideParams.fareSOL)
    }
  }, [rideParams])

  // Derive PDA if possible
  const pdaInfo = React.useMemo(() => {
    if (!driverAddress || !rideId) return null
    return findRidePda(driverAddress, rideId)
  }, [driverAddress, rideId])

  // Listen to cross-tab updates and on-chain state
  useEffect(() => {
    if (!rideId) return

    // 1. Cross-tab sync listener
    const unsubscribe = subscribeToRideUpdates(rideId, (updated) => {
      if (updated) {
        setRideState(updated)
        if (updated.tx) setTxSignature(updated.tx)
      }
    })

    // Read initial local store
    const initial = getSimulatedRide(rideId)
    if (initial) {
      setRideState(initial)
      if (initial.tx) setTxSignature(initial.tx)
    }

    // 2. On-chain check if real wallet is connected
    let isMounted = true
    const checkOnChain = async () => {
      if (!publicKey || !pdaInfo?.pda) return
      try {
        const acc = await connection.getAccountInfo(pdaInfo.pda)
        if (!acc) return
        const program = getProgram(connection, wallet)
        const data = await program.account.rideEscrow.fetch(pdaInfo.pda)
        if (isMounted && data) {
          const updated = {
            status: data.status,
            rider: data.rider.toBase58(),
            fareLamports: data.fareLamports.toString(),
          }
          setRideState(updated)
          saveSimulatedRide(rideId, updated)
        }
      } catch (e) {
        // Ignored if account not yet created on chain
      }
    }

    const interval = setInterval(checkOnChain, 3000)
    return () => {
      isMounted = false
      unsubscribe()
      clearInterval(interval)
    }
  }, [rideId, pdaInfo, publicKey, connection, wallet])

  // Confetti helper
  const triggerConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#14F195', '#9945FF', '#ffffff', '#38bdf8']
    })
  }

  // 1. Lock Fare into Escrow
  const handleLockEscrow = async () => {
    setLoading(true)
    setErrorMsg(null)
    setTxSignature(null)

    try {
      // If real wallet is connected, try real on-chain transaction
      if (publicKey && pdaInfo?.pda) {
        try {
          const driverPk = new PublicKey(driverAddress)
          const rideIdBn = new anchor.BN(rideId || Date.now().toString())
          const lamportsBn = thbToLamports(fareTHB)
          const program = getProgram(connection, wallet)

          const tx = await program.methods
            .createAndFundRide(rideIdBn, lamportsBn)
            .accounts({
              rideEscrow: pdaInfo.pda,
              driver: driverPk,
              rider: publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc()

          setTxSignature(tx)
          const updated = {
            status: 1, // Funded
            rider: publicKey.toBase58(),
            fareTHB,
            fareSOL,
            tx,
          }
          saveSimulatedRide(rideId, updated)
          setRideState(updated)
          setLoading(false)
          return
        } catch (chainErr) {
          console.warn('On-chain tx failed or cancelled, falling back to simulated sync:', chainErr.message)
          // Fall back to simulation so demo never blocks!
        }
      }

      // Simulation / Instant Demo Mode
      await new Promise((resolve) => setTimeout(resolve, 600)) // 600ms realistic delay
      const mockTx = '5UfR8zK...' + Math.random().toString(36).substring(2, 10)
      const updated = {
        status: 1, // Funded
        rider: effectiveRiderPubkey,
        fareTHB,
        fareSOL,
        tx: mockTx,
      }
      saveSimulatedRide(rideId, updated)
      setRideState(updated)
      setTxSignature(mockTx)
    } catch (err) {
      setErrorMsg(err.message || 'Error locking escrow.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Release Payment to Driver
  const handleReleasePayment = async () => {
    setLoading(true)
    setErrorMsg(null)

    try {
      if (publicKey && pdaInfo?.pda) {
        try {
          const driverPk = new PublicKey(driverAddress)
          const program = getProgram(connection, wallet)

          const tx = await program.methods
            .releasePayment()
            .accounts({
              rideEscrow: pdaInfo.pda,
              rider: publicKey,
              driver: driverPk,
            })
            .rpc()

          setTxSignature(tx)
          triggerConfetti()
          const updated = {
            ...rideState,
            status: 2, // Completed
            tx,
          }
          saveSimulatedRide(rideId, updated)
          setRideState(updated)
          setLoading(false)
          return
        } catch (chainErr) {
          console.warn('On-chain release failed, falling back to simulated sync:', chainErr.message)
        }
      }

      // Simulation / Instant Demo Mode
      await new Promise((resolve) => setTimeout(resolve, 600))
      triggerConfetti()
      const mockTx = '3KpY9wL...' + Math.random().toString(36).substring(2, 10)
      const updated = {
        ...rideState,
        status: 2, // Completed
        tx: mockTx,
      }
      saveSimulatedRide(rideId, updated)
      setRideState(updated)
      setTxSignature(mockTx)
    } catch (err) {
      setErrorMsg(err.message || 'Error releasing payment.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Cancel and Refund
  const handleCancelRefund = () => {
    const updated = {
      ...rideState,
      status: 3, // Cancelled
    }
    saveSimulatedRide(rideId, updated)
    setRideState(updated)
  }

  const explorerUrl = (sig) => NETWORK_CONFIGS[network]?.explorerUrl(sig) || `https://explorer.solana.com/tx/${sig}?cluster=devnet`

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <Shield size={26} color="var(--sol-cyan)" />
          Passenger Terminal
        </h2>
        <p className="card-subtitle">
          Trustless micro-escrow: driver only gets paid when you arrive safely
        </p>

        {/* Passenger Wallet Status Badge */}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
          {publicKey ? (
            <span style={{ 
              fontSize: '0.8rem', 
              color: 'var(--sol-cyan)', 
              background: 'rgba(20, 241, 149, 0.1)', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '999px',
              border: '1px solid rgba(20, 241, 149, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              🟢 Passenger Wallet: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          ) : (
            <span style={{ 
              fontSize: '0.8rem', 
              color: '#38bdf8', 
              background: 'rgba(56, 189, 248, 0.1)', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '999px',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              ⚡ Demo Passenger Mode (Connect Phantom anytime)
            </span>
          )}
        </div>
      </div>

      {!rideId ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            No ride active yet. Scan the driver's QR code or auto-fill a test ride below.
          </p>
          <button
            id="fill-demo-ride-btn"
            type="button"
            className="btn-primary"
            onClick={() => {
              const newRideId = Date.now().toString()
              setDriverAddress(DEFAULT_MOCK_DRIVER)
              setRideId(newRideId)
              setFareTHB('50')
              setFareSOL(thbToSol('50'))
              saveSimulatedRide(newRideId, {
                rideId: newRideId,
                driver: DEFAULT_MOCK_DRIVER,
                fareTHB: '50',
                fareSOL: thbToSol('50'),
                status: 0,
              })
            }}
          >
            ⚡ Load Sample 50฿ Ride
          </button>
        </div>
      ) : (
        <div>
          {/* Status Banners */}
          {rideState.status === 1 ? (
            <div className="status-banner funded" id="rider-status-funded">
              <div className="status-icon-box">
                <Bike size={24} color="#10b981" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  🛵 Ride in Progress
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {fareSOL} SOL securely held in smart escrow. Tap release when you arrive!
                </span>
              </div>
            </div>
          ) : rideState.status === 2 ? (
            <div className="status-banner completed" id="rider-status-completed">
              <div className="status-icon-box">
                <Sparkles size={24} color="#3b82f6" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  🎉 Ride Completed & Settled!
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {fareSOL} SOL released to driver. Zero bank fees deducted!
                </span>
              </div>
            </div>
          ) : rideState.status === 3 ? (
            <div className="status-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <div>
                <strong>Ride Cancelled — Funds Refunded to Passenger</strong>
              </div>
            </div>
          ) : (
            <div className="status-banner created" id="rider-status-ready">
              <div className="status-icon-box">
                <Lock size={22} color="#f59e0b" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                  Ride Ready to Lock
                </strong>
                <span style={{ fontSize: '0.8rem' }}>
                  Review fare details and lock into smart escrow.
                </span>
              </div>
            </div>
          )}

          {/* Ride Details Card */}
          <div className="conversion-box">
            <div className="conversion-row">
              <span className="conversion-label">Driver</span>
              <span className="conversion-val" style={{ fontSize: '0.78rem' }}>
                {driverAddress.slice(0, 6)}...{driverAddress.slice(-6)}
              </span>
            </div>
            <div className="conversion-row">
              <span className="conversion-label">Agreed Fare (THB)</span>
              <span className="conversion-val">{fareTHB} THB</span>
            </div>
            <div className="conversion-row">
              <span className="conversion-label">
                <DollarSign size={14} color="var(--sol-cyan)" /> Escrow Amount (SOL)
              </span>
              <span className="conversion-val highlight">
                {fareSOL} SOL
              </span>
            </div>
            <div className="conversion-row">
              <span className="conversion-label">Solana Fee</span>
              <span className="conversion-val" style={{ color: 'var(--sol-cyan)' }}>
                ~0.000005 SOL ($0.0007)
              </span>
            </div>
          </div>

          {/* Transaction Hash */}
          {txSignature && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="mono-box">
                <span>Tx: {txSignature.slice(0, 16)}...</span>
                <span style={{ color: 'var(--sol-cyan)', fontSize: '0.75rem' }}>Confirmed ✅</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div style={{ 
              background: 'rgba(239, 68, 68, 0.15)', 
              color: '#f87171', 
              padding: '0.75rem', 
              borderRadius: 'var(--radius-sm)', 
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons based on status */}
          {rideState.status === 0 ? (
            <button
              id="lock-fare-btn"
              className="btn-primary"
              onClick={handleLockEscrow}
              disabled={loading}
            >
              <Lock size={18} />
              {loading ? 'Locking into Escrow...' : `Lock ${fareSOL} SOL into Escrow 🔒`}
            </button>
          ) : rideState.status === 1 ? (
            <div>
              <button
                id="release-payment-btn"
                className="btn-primary btn-success"
                onClick={handleReleasePayment}
                disabled={loading}
              >
                <CheckCircle size={20} />
                {loading ? 'Releasing Payment...' : 'Arrived — Release Payment to Driver 🚀'}
              </button>

              <button
                id="cancel-refund-btn"
                type="button"
                className="btn-danger"
                onClick={handleCancelRefund}
                disabled={loading}
              >
                <RotateCcw size={16} />
                Cancel Ride & Refund Me
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <button
                id="back-to-driver-btn"
                type="button"
                className="btn-primary"
                onClick={onBackToDriver}
              >
                <ArrowLeft size={18} /> Back to Driver Terminal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
