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
  DollarSign
} from 'lucide-react'
import { 
  findRidePda, 
  getProgram, 
  thbToLamports, 
  thbToSol, 
  lamportsToSol,
  NETWORK_CONFIGS,
  PROGRAM_ID 
} from '../utils/solana'
import * as anchor from '@coral-xyz/anchor'
import { PublicKey, SystemProgram } from '@solana/web3.js'

export const RiderView = ({ rideParams, network }) => {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey } = wallet

  const [driverAddress, setDriverAddress] = useState(rideParams?.driver || '')
  const [rideId, setRideId] = useState(rideParams?.rideId || '')
  const [fareTHB, setFareTHB] = useState(rideParams?.fareTHB || '50')
  const [fareSOL, setFareSOL] = useState(rideParams?.fareSOL || '0.01111')

  const [escrowAccount, setEscrowAccount] = useState(null)
  const [loading, setLoading] = useState(false)
  const [txSignature, setTxSignature] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  // Update state when props change
  useEffect(() => {
    if (rideParams) {
      if (rideParams.driver) setDriverAddress(rideParams.driver)
      if (rideParams.rideId) setRideId(rideParams.rideId)
      if (rideParams.fareTHB) setFareTHB(rideParams.fareTHB)
      if (rideParams.fareSOL) setFareSOL(rideParams.fareSOL)
    }
  }, [rideParams])

  // Derive PDA if driver and rideId are valid
  const pdaInfo = React.useMemo(() => {
    if (!driverAddress || !rideId) return null
    try {
      const driverPk = new PublicKey(driverAddress)
      const rideIdBn = new anchor.BN(rideId)
      return findRidePda(driverPk, rideIdBn)
    } catch {
      return null
    }
  }, [driverAddress, rideId])

  // Poll escrow account state
  useEffect(() => {
    if (!pdaInfo?.pda) return

    let isMounted = true
    const fetchEscrow = async () => {
      try {
        const accountInfo = await connection.getAccountInfo(pdaInfo.pda)
        if (!accountInfo) {
          if (isMounted) setEscrowAccount(null)
          return
        }

        const program = getProgram(connection, wallet)
        const data = await program.account.rideEscrow.fetch(pdaInfo.pda)
        if (isMounted) {
          setEscrowAccount(data)
        }
      } catch (err) {
        console.log('Error fetching rider escrow:', err.message)
      }
    }

    fetchEscrow()
    const timer = setInterval(fetchEscrow, 2500)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [pdaInfo, connection, wallet])

  // Trigger celebration confetti
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#14F195', '#9945FF', '#ffffff', '#38bdf8']
    })
  }

  // 1. Lock Fare into Escrow
  const handleLockEscrow = async () => {
    if (!publicKey || !driverAddress || !rideId) return
    setLoading(true)
    setErrorMsg(null)
    setTxSignature(null)

    try {
      const driverPk = new PublicKey(driverAddress)
      const rideIdBn = new anchor.BN(rideId)
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
      console.log('Ride locked in escrow:', tx)
    } catch (err) {
      console.error('Lock escrow failed:', err)
      setErrorMsg(err.message || 'Failed to lock escrow.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Release Payment to Driver
  const handleReleasePayment = async () => {
    if (!publicKey || !driverAddress || !escrowAccount) return
    setLoading(true)
    setErrorMsg(null)

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
      console.log('Payment released to driver:', tx)
    } catch (err) {
      console.error('Release payment failed:', err)
      setErrorMsg(err.message || 'Failed to release payment.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Cancel and Refund
  const handleCancelRefund = async () => {
    if (!publicKey || !driverAddress || !escrowAccount) return
    setLoading(true)
    setErrorMsg(null)

    try {
      const driverPk = new PublicKey(driverAddress)
      const program = getProgram(connection, wallet)

      const tx = await program.methods
        .cancelRide()
        .accounts({
          rideEscrow: pdaInfo.pda,
          caller: publicKey,
          rider: publicKey,
          driver: driverPk,
        })
        .rpc()

      setTxSignature(tx)
      console.log('Ride cancelled & refunded:', tx)
    } catch (err) {
      console.error('Cancel failed:', err)
      setErrorMsg(err.message || 'Failed to cancel.')
    } finally {
      setLoading(false)
    }
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
      </div>

      {!publicKey ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'radar-pulse 2s infinite' }}>
            🎒
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Connect Your Passenger Wallet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Connect your wallet to lock the fare into Solana escrow.
          </p>
        </div>
      ) : !driverAddress ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            No ride active yet. Scan the driver's QR code or switch to Driver Mode to create one.
          </p>
          <div className="demo-bar" style={{ margin: '0 auto', textAlign: 'left' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Quick Demo Ride</div>
              <div className="demo-bar-text">Auto-fill mock ride parameters for judging</div>
            </div>
            <button
              id="fill-demo-ride-btn"
              type="button"
              className="demo-btn"
              onClick={() => {
                setDriverAddress(publicKey.toBase58())
                setRideId(Date.now().toString())
                setFareTHB('50')
                setFareSOL(thbToSol('50'))
              }}
            >
              Fill Sample Ride ⚡
            </button>
          </div>
        </div>
      ) : (
        <div>
          {/* Status Banners */}
          {escrowAccount?.status === 1 ? (
            <div className="status-banner funded" id="rider-status-funded">
              <div className="status-icon-box">
                <Bike size={22} color="#10b981" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  🛵 Ride in Progress
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {fareSOL} SOL safely secured in escrow. Tap release when you arrive.
                </span>
              </div>
            </div>
          ) : escrowAccount?.status === 2 ? (
            <div className="status-banner completed" id="rider-status-completed">
              <div className="status-icon-box">
                <Sparkles size={22} color="#3b82f6" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  🎉 Ride Completed & Settled!
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  Payment released to driver. Zero banking fees deducted!
                </span>
              </div>
            </div>
          ) : escrowAccount?.status === 3 ? (
            <div className="status-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <div>
                <strong>Ride Cancelled — Funds Refunded to Your Wallet</strong>
              </div>
            </div>
          ) : (
            <div className="status-banner created" id="rider-status-ready">
              <div className="status-icon-box">
                <Lock size={20} color="#f59e0b" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                  Ride Ready to Fund
                </strong>
                <span style={{ fontSize: '0.8rem' }}>
                  Review fare below and lock into smart escrow.
                </span>
              </div>
            </div>
          )}

          {/* Ride Details Card */}
          <div className="conversion-box">
            <div className="conversion-row">
              <span className="conversion-label">Driver Public Key</span>
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
              <span className="conversion-label">Solana Network Fee</span>
              <span className="conversion-val" style={{ color: 'var(--sol-cyan)' }}>
                ~0.000005 SOL ($0.0007)
              </span>
            </div>
          </div>

          {/* Transaction Hash / Link if confirmed */}
          {txSignature && (
            <div style={{ marginBottom: '1.25rem' }}>
              <a
                id="solana-explorer-link"
                href={explorerUrl(txSignature)}
                target="_blank"
                rel="noreferrer"
                className="mono-box"
                style={{ textDecoration: 'none', color: 'var(--sol-cyan)' }}
              >
                <span>Tx Confirmed: {txSignature.slice(0, 16)}...</span>
                <ExternalLink size={14} />
              </a>
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
          {!escrowAccount || escrowAccount.status === 0 ? (
            <button
              id="lock-fare-btn"
              className="btn-primary"
              onClick={handleLockEscrow}
              disabled={loading}
            >
              <Lock size={18} />
              {loading ? 'Locking into Escrow...' : `Lock ${fareSOL} SOL into Escrow`}
            </button>
          ) : escrowAccount.status === 1 ? (
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
          ) : escrowAccount.status === 2 ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ color: 'var(--sol-cyan)', fontWeight: 700, marginBottom: '0.5rem' }}>
                ⭐ Thank you for riding with MotoEscrow!
              </div>
              <button
                id="new-ride-btn"
                type="button"
                className="btn-primary"
                onClick={() => {
                  setEscrowAccount(null)
                  setTxSignature(null)
                  setDriverAddress('')
                }}
              >
                Start New Ride
              </button>
            </div>
          ) : (
            <button
              id="new-ride-reset-btn"
              type="button"
              className="btn-primary"
              onClick={() => {
                setEscrowAccount(null)
                setTxSignature(null)
                setDriverAddress('')
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  )
}
