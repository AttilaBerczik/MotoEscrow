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
  ArrowRight
} from 'lucide-react'
import { 
  thbToSol, 
  thbToLamports, 
  findRidePda, 
  getProgram, 
  NETWORK_CONFIGS,
  RIDE_STATUS 
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
  const [checkingOnChain, setCheckingOnChain] = useState(false)

  const quickFares = ['30', '50', '80', '120']
  const solEquivalent = thbToSol(fareTHB)

  // Handle ride creation
  const handleCreateRide = () => {
    if (!publicKey) return
    const rideId = Date.now().toString()
    const ridePdaInfo = findRidePda(publicKey, rideId)

    const rideUrl = `${window.location.origin}/?role=rider&driver=${publicKey.toBase58()}&rideId=${rideId}&fareTHB=${fareTHB}&fareSOL=${solEquivalent}`

    setActiveRide({
      rideId,
      fareTHB,
      fareSOL: solEquivalent,
      pda: ridePdaInfo.pda.toBase58(),
      url: rideUrl,
    })
    setRideStatus(null)
  }

  // Poll escrow account state on-chain
  useEffect(() => {
    if (!activeRide || !publicKey) return

    let isMounted = true
    const checkStatus = async () => {
      try {
        setCheckingOnChain(true)
        const rideIdBn = new anchor.BN(activeRide.rideId)
        const { pda } = findRidePda(publicKey, rideIdBn)
        
        // Fetch account data
        const accountInfo = await connection.getAccountInfo(pda)
        if (!accountInfo) {
          if (isMounted) setRideStatus(null)
          return
        }

        const program = getProgram(connection, wallet)
        const escrowData = await program.account.rideEscrow.fetch(pda)
        if (isMounted && escrowData) {
          setRideStatus({
            status: escrowData.status,
            rider: escrowData.rider.toBase58(),
            fareLamports: escrowData.fareLamports.toString(),
          })
        }
      } catch (err) {
        console.log('Account not initialized or error fetching:', err.message)
      } finally {
        if (isMounted) setCheckingOnChain(false)
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 3000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [activeRide, publicKey, connection])

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
      </div>

      {!publicKey ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{ 
            fontSize: '3rem', 
            marginBottom: '1rem',
            animation: 'radar-pulse 2s infinite' 
          }}>
            🔌
          </div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Connect Your Driver Wallet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Connect Phantom or Solflare to set fares and receive ride payments directly.
          </p>
        </div>
      ) : !activeRide ? (
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
                placeholder="40"
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
                <ShieldCheck size={22} color="#10b981" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  ✅ RIDE IS FUNDED!
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {activeRide.fareSOL} SOL locked in escrow. Safe to start ride!
                </span>
              </div>
            </div>
          ) : rideStatus?.status === 2 ? (
            <div className="status-banner completed" id="ride-status-completed">
              <div className="status-icon-box">
                <Check size={22} color="#3b82f6" />
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  🎉 PAYMENT RECEIVED!
                </strong>
                <span style={{ fontSize: '0.85rem' }}>
                  {activeRide.fareSOL} SOL transferred directly to your wallet!
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
                  Waiting for Rider to Lock Fare...
                </strong>
                <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                  Show this QR code to the passenger.
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
              <span className="conversion-label">Escrow PDA</span>
              <span className="conversion-val" style={{ fontSize: '0.75rem' }}>
                {activeRide.pda.slice(0, 6)}...{activeRide.pda.slice(-6)}
              </span>
            </div>
            {rideStatus?.rider && (
              <div className="conversion-row">
                <span className="conversion-label">Passenger Wallet</span>
                <span className="conversion-val" style={{ fontSize: '0.75rem', color: 'var(--sol-cyan)' }}>
                  {rideStatus.rider.slice(0, 6)}...{rideStatus.rider.slice(-6)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              id="copy-ride-link-btn"
              className="btn-primary"
              style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
              onClick={handleCopyLink}
            >
              {copied ? <Check size={18} color="var(--sol-cyan)" /> : <Copy size={18} />}
              {copied ? 'Ride Link Copied!' : 'Copy Ride Link'}
            </button>

            <button
              id="open-rider-sim-btn"
              className="btn-primary"
              onClick={() => onSwitchToRider(activeRide)}
            >
              Open as Passenger in Demo <ArrowRight size={18} />
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
