import React from 'react'
import { PROGRAM_ID, NETWORK_CONFIGS } from '../utils/solana'
import { Info, RotateCcw } from 'lucide-react'

export const DemoHelper = ({ network, onReset }) => {
  const explorerUrl = NETWORK_CONFIGS[network]?.accountUrl(PROGRAM_ID.toBase58())

  return (
    <div className="demo-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <Info size={18} color="var(--sol-cyan)" />
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            💡 Demo Quick Guide
          </div>
          <div className="demo-bar-text">
            <strong>Step 1:</strong> In Driver Terminal, enter 50฿ & click <em>Generate QR</em>.<br />
            <strong>Step 2:</strong> Scan QR with phone or click <em>Test as Passenger</em>.<br />
            <strong>Step 3:</strong> Tap <em>Lock Escrow</em>, then tap <em>Release Payment</em>!
          </div>
        </div>
      </div>

      <button
        id="quick-reset-demo-btn"
        className="demo-btn"
        onClick={onReset}
        title="Reset demo state and return to Driver view"
      >
        <RotateCcw size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
        Reset Demo
      </button>
    </div>
  )
}
