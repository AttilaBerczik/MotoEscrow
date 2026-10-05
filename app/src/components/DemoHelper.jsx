import React from 'react'
import { PROGRAM_ID, NETWORK_CONFIGS } from '../utils/solana'
import { ExternalLink, Info, PlayCircle } from 'lucide-react'

export const DemoHelper = ({ network, onQuickDemo }) => {
  const explorerUrl = NETWORK_CONFIGS[network]?.accountUrl(PROGRAM_ID.toBase58())

  return (
    <div className="demo-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Info size={18} color="var(--sol-purple)" />
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Hackathon Live Pitch Helper
          </div>
          <div className="demo-bar-text">
            Program ID:{' '}
            <a 
              href={explorerUrl} 
              target="_blank" 
              rel="noreferrer" 
              style={{ color: 'var(--sol-cyan)', textDecoration: 'none' }}
            >
              {PROGRAM_ID.toBase58().slice(0, 6)}...{PROGRAM_ID.toBase58().slice(-4)} ↗
            </a>
          </div>
        </div>
      </div>

      <button
        id="quick-demo-pitch-btn"
        className="demo-btn"
        onClick={onQuickDemo}
        title="Populates driver and rider with demo parameters"
      >
        <PlayCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
        Demo 50฿ Ride
      </button>
    </div>
  )
}
