import React from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Bike, Shield, Radio } from 'lucide-react'

export const Navbar = ({ 
  currentRole, 
  onRoleChange, 
  network, 
  onNetworkChange 
}) => {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-icon">
          <Bike size={24} color="#0c0f17" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="brand-title">MotoEscrow</span>
            <span className="brand-tag">Solana MVP</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Instant Micro-Escrow for Moto-Taxis
          </p>
        </div>
      </div>

      <div className="nav-actions">
        {/* Role Switcher */}
        <div className="role-switcher">
          <button
            id="tab-driver"
            className={`role-tab ${currentRole === 'driver' ? 'active' : ''}`}
            onClick={() => onRoleChange('driver')}
          >
            🛵 Driver Mode
          </button>
          <button
            id="tab-rider"
            className={`role-tab ${currentRole === 'rider' ? 'active' : ''}`}
            onClick={() => onRoleChange('rider')}
          >
            🎒 Rider Mode
          </button>
        </div>

        {/* Network Toggle */}
        <button
          id="network-toggle-btn"
          className="network-badge"
          onClick={() => onNetworkChange(network === 'devnet' ? 'localnet' : 'devnet')}
          title="Click to toggle Devnet / Localnet"
          style={{ cursor: 'pointer', border: 'none' }}
        >
          <span className="dot-indicator" />
          <span>{network === 'devnet' ? 'Devnet' : 'Localnet'}</span>
        </button>

        {/* Wallet Connect Button */}
        <div id="wallet-connect-wrapper">
          <WalletMultiButton />
        </div>
      </div>
    </header>
  )
}
