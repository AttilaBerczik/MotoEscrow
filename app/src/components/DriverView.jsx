import React, { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { QRCodeSVG } from 'qrcode.react'
import { 
  Bike, 
  QrCode, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Zap, 
  RefreshCw,
  Clock,
  ArrowRight,
  Wallet,
  Play
} from 'lucide-react'
import { 
  thbToSol, 
  findRidePda, 
  getProgram, 
  NETWORK_CONFIGS,
  DEFAULT_MOCK_DRIVER,
  saveSimulatedRide,
  getSimulatedRide,
  subscribeToRideUpdates
} from '../utils/solana'
import * as anchor from '@coral-xyz/anchor'

export const DriverView = ({ network, onSwitchToRider }) => {
  const { connection } = useConnection()
  const wallet = useWallet()
  const { publicKey } = wallet

  const [fareTHB, setFareTHB] = useState('50')
  const [activeRide, setActiveRide] = useState(null)
  const [rideStatus, setRideStatus] = useState(null)
  const [copied, setCopied] = useState(false)

  const quickFares = ['30', '50', '80', '120']
  const solEquivalent = thbToSol(fareTHB)
  const effectiveDriverPubkey = publicKey ? publicKey.toBase58() : DEFAULT_MOCK_DRIVER

  // Handle ride creation
  const handleCreateRide = () => {
    const rideId = Date.now().toString()
    const ridePdaInfo = findRidePda(effectiveDriverPubkey, rideId)

    const rideUrl = `${window.location.origin}/?role=rider&driver=${effectiveDriverPubkey}&rideId=${rideId}&fareTHB=${fareTHB}&fareSOL=${solEquivalent}`

    const rideData = {
      rideId,
      driver: effectiveDriverPubkey,
      fareTHB,
      fareSOL: solEquivalent,
      status: 0, // Created
      pda: ridePdaInfo?.pda?.toBase58 ? ridePdaInfo.pda.toBase58() : 'EscrowPDA',
      url: rideUrl,
    }

    // Save to shared store so Rider tab sees it immediately
    saveSimulatedRide(rideId, rideData)

    setActiveRide(rideData)
    setRideStatus({ status: 0 })
  }

  // Listen to both on-chain account AND cross-tab sync store
  useEffect(() => {
    if (!activeRide) return

    // 1. Cross-tab real-time listener (syncs across tabs and windows instantly)
    const unsubscribe = subscribeToRideUpdates(activeRide.rideId, (updatedData) => {
      if (updatedData) {
        setRideStatus({
          status: updatedData.status,
          rider: updatedData.rider,
          fareLamports: updatedData.fareLamports,
          tx: updatedData.tx,
        })
      }
    })

    // Also check initial local store
    const initialSim = getSimulatedRide(activeRide.rideId)
    if (initialSim) {
      setRideStatus({
        status: initialSim.status,
        rider: initialSim.rider,
        fareLamports: initialSim.fareLamports,
        tx: initialSim.tx,
      })
    }

    // 2. On-chain polling (if real wallet and on-chain account exists)
    let isMounted = true
    const checkOnChain = async () => {
      if (!publicKey) return
      try {
        const rideIdBn = new anchor.BN(activeRide.rideId)
        const { pda } = findRidePda(publicKey, rideIdBn)
        const accountInfo = await connection.getAccountInfo(pda)
        if (!accountInfo) return

        const program = getProgram(connection, wallet)
        const escrowData = await program.account.rideEscrow.fetch(pda)
        if (isMounted && escrowData) {
          const updated = {
            status: escrowData.status,
            rider: escrowData.rider.toBase58(),
            fareLamports: escrowData.fareLamports.toString(),
          }
          setRideStatus(updated)
          saveSimulatedRide(activeRide.rideId, updated)
        }
      } catch (err) {
        // Ignored if account not yet created on chain
      }
    }

    const interval = setInterval(checkOnChain, 3000)
    return () => {
      isMounted = false
      unsubscribe()
      clearInterval(interval)
    }
  }, [activeRide, publicKey, connection, wallet])

  const handleCopyLink = () => {
    if (!activeRide) return
    navigator.clipboard.writeText(activeRide.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleResetRide = () => {
    setActiveRide(null)
    setRideStatus(null)
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          <Bike size={28} color="var(--sol-cyan)" />
          Driver Terminal
        </h2>
        <p className="card-subtitle">
          Create an instant escrow ride & receive direct Solana settlement
        </p>

        {/* Wallet Connection Status Badge */}
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
              🟢 Wallet Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          ) : (
            <span style={{ 
              fontSize: '0.8rem', 
              color: '#f59e0b', 
              background: 'rgba(245, 158, 11, 0.1)', 
              padding: '0.25rem 0.75rem', 
              borderRadius: '999px',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}>
              ⚡ Demo Driver Mode Active (Connect Phantom anytime)
            </span>
          )}
        </div>
      </div>

      {!activeRide ? (
        <div>
          {/* Fare Input */}
          <div className="input-group">
            <label className="input-label" htmlFor="fare-thb-input">
              Enter Ride Fare (THB)
            </label>
            <div className="fare-input-wrapper">
              <input
                id="fare-thb-input"
                type="number"
                className="fare-input"
                value={fareTHB}
                onChange={(e) => setFareTHB(e.target.value)}
                min="10"
                step="5"
                placeholder="50"
              />
              <span className="fare-currency">THB</span>
            </div>

            {/* Quick Fare Presets */}
            <div className="quick-fares">
              {quickFares.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`quick-fare-btn ${fareTHB === preset ? 'active' : ''}`}
                  onClick={() => setFareTHB(preset)}
                >
                  {preset} ฿
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Crypto Conversion Box */}
          <div className="conversion-box">
            <div className="conversion-row">
              <span className="conversion-label">
                <Zap size={15} color="var(--sol-purple)" /> SOL Amount
              </span>
              <span className="conversion-val highlight">
                {solEquivalent} SOL
              </span>
            </div>
            <div className="conversion-row">
              <span className="conversion-label">
                <Clock size={15} /> Settlement Speed
              </span>
              <span className="conversion-val" style={{ color: 'var(--sol-cyan)' }}>
                ~400 ms (Instant)
              </span>
            </div>
            <div className="fee-comparison">
              <span>⚡ Traditional Taxi Fees: ~25-30% | Solana Escrow: &lt; $0.001</span>
            </div>
          </div>

          {/* Create Ride Button */}
          <button
            id="create-ride-btn"
            className="btn-primary"
            onClick={handleCreateRide}
            disabled={!fareTHB || parseFloat(fareTHB) <= 0}
          >
            <QrCode size={20} />
            Generate Ride Link & QR
          </button>
        </div>
      ) : (
        <div>
          {/* Live Status Header */}
          {rideStatus?.status === 1 ? (
            <div className="status-banner funded" id="ride-status-funded">
              <div className="status-icon-box">
                <ShieldCheck size={24} color="#10b981" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>
                  ✅ RIDE IS FUNDED!
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {activeRide.fareSOL} SOL locked safely in escrow. Safe to start driving!
                </span>
              </div>
            </div>
          ) : rideStatus?.status === 2 ? (
            <div className="status-banner completed" id="ride-status-completed">
              <div className="status-icon-box">
                <Check size={24} color="#3b82f6" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.1rem' }}>
                  🎉 PAYMENT RECEIVED!
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  +{activeRide.fareSOL} SOL deposited directly into your driver wallet!
                </span>
              </div>
            </div>
          ) : rideStatus?.status === 3 ? (
            <div className="status-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
              <div>
                <strong>Ride Cancelled & Refunded</strong>
              </div>
            </div>
          ) : (
            <div className="status-banner created" id="ride-status-waiting">
              <div className="status-icon-box radar-pulse">
                <RefreshCw size={20} color="#f59e0b" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '0.95rem' }}>
                  Waiting for Passenger to Lock Fare...
                </strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Show this QR code to the passenger to scan.
                </span>
              </div>
            </div>
          )}

          {/* QR Code Container */}
          <div className="qr-container">
            <QRCodeSVG
              id="ride-qr-code"
              value={activeRide.url}
              size={200}
              level="M"
              includeMargin={true}
            />
            <div className="qr-caption">
              Scan to Lock {activeRide.fareTHB} THB ({activeRide.fareSOL} SOL)
            </div>
          </div>

          {/* Ride Details */}
          <div className="conversion-box">
            <div className="conversion-row">
              <span className="conversion-label">Ride ID</span>
              <span className="conversion-val">#{activeRide.rideId.slice(-6)}</span>
            </div>
            <div className="conversion-row">
              <span className="conversion-label">Driver Address</span>
              <span className="conversion-val" style={{ fontSize: '0.75rem' }}>
                {activeRide.driver.slice(0, 6)}...{activeRide.driver.slice(-6)}
              </span>
            </div>
            {rideStatus?.rider && (
              <div className="conversion-row">
                <span className="conversion-label">Passenger</span>
                <span className="conversion-val" style={{ fontSize: '0.75rem', color: 'var(--sol-cyan)' }}>
                  {rideStatus.rider.slice(0, 6)}...{rideStatus.rider.slice(-6)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              id="copy-ride-link-btn"
              className="btn-primary"
              style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
              onClick={handleCopyLink}
            >
              {copied ? <Check size={18} color="var(--sol-cyan)" /> : <Copy size={18} />}
              {copied ? 'Ride Link Copied!' : 'Copy Ride Link'}
            </button>

            {/* Direct switch to Passenger to test */}
            <button
              id="test-as-rider-btn"
              className="btn-primary"
              onClick={() => onSwitchToRider(activeRide)}
            >
              Test as Passenger (Lock & Release) <ArrowRight size={18} />
            </button>

            <button
              id="reset-ride-btn"
              type="button"
              className="btn-danger"
              onClick={handleResetRide}
            >
              Start Another Ride
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
