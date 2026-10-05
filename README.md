# 🏍️ MotoEscrow — Instant Solana Escrow for Moto-Taxis

> **Hackathon MVP**: Trustless, zero-fee micro-escrow on Solana designed for motorcycle rides and street micropayments where traditional banking fees (25–30%) are too costly.

---

## ⚡ The Problem & The Solana Solution

- **The Problem:** In Southeast Asia (Bangkok, Jakarta, Ho Chi Minh), a moto-taxi ride costs 30–50 THB (~$1). Traditional credit cards and app aggregators take 25–30% commissions + merchant terminal fees. Drivers are forced to deal exclusively with physical cash, which is slow, risky, and hard to manage while driving.
- **The Solana Solution:** With Solana's 400ms finality and ~$0.0008 network transaction fees, **MotoEscrow** turns any motorbike driver into a digital merchant using a simple QR code.
  - Passenger locks fare into a program-derived escrow PDA before riding.
  - Driver sees immediate cryptographic proof that the ride is funded.
  - Passenger taps **"Release Payment"** on arrival → Driver receives SOL instantly.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Vite + React + Tailwind-free Vanilla CSS)        │
│  • Solana Wallet Adapter (Phantom, Solflare)                │
│  • Driver View: Fare in THB → live SOL conversion → QR code │
│  • Passenger View: Lock SOL into Escrow → Release on arrival│
└──────────────────────────────┬──────────────────────────────┘
                               │ @coral-xyz/anchor & @solana/web3.js
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Solana Anchor Program (moto_escrow)                        │
│  Program ID: 6H3xC9yvLTM8YX8ruRDHbqmGySGTuQmdKSH8oW9jjhLF   │
│  • create_ride(ride_id, fare_lamports)                      │
│  • fund_ride()                                              │
│  • create_and_fund_ride(ride_id, fare_lamports) [1-tx QR]   │
│  • release_payment() [Transfers funds from PDA to driver]   │
│  • cancel_ride() [Instant refund to passenger if cancelled] │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Live Demo & Quick Start

### 1. Run the Frontend Locally
```bash
npm run dev
# Running on http://localhost:5173/
```

### 2. Public HTTPS Tunnel (for Real Phone Camera Scanning)
```bash
cloudflared tunnel --url http://localhost:5173
```
*Current Active Public URL:* **`https://bali-conditions-adjusted-spice.trycloudflare.com`**

### 3. Run Smart Contract Integration Tests
```bash
anchor test
```
All 3 automated integration tests cover the full ride lifecycle:
- ✔ Driver creates ride, Rider funds, Rider releases payment
- ✔ Instant QR flow: Rider creates and funds in 1 tx, then releases
- ✔ Cancel & refund mechanism

---

## 📱 Live Pitch Flow (3-Minute Hackathon Demo)

1. **Driver Terminal:** Driver enters `50 ฿` (~0.01111 SOL) → Clicks **Generate Ride Link & QR**.
2. **Passenger Phone:** Passenger scans QR with phone camera → Connects Phantom → Clicks **Lock into Escrow**.
3. **Driver Screen:** Updates in real-time to **"✅ RIDE IS FUNDED"**.
4. **Destination Reached:** Passenger taps **"Release Payment"** → Confetti celebration 🎉 → Funds land in driver wallet.
