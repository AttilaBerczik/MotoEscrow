import React, { useState, useEffect } from 'react'
import { WalletContextProvider } from './components/WalletContextProvider'
import { Navbar } from './components/Navbar'
import { DriverView } from './components/DriverView'
import { RiderView } from './components/RiderView'
import { thbToSol } from './utils/solana'

export function App() {
  const [network, setNetwork] = useState('devnet')
  const [currentRole, setCurrentRole] = useState('driver')
  const [rideParams, setRideParams] = useState(null)

  // Parse URL query parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roleParam = params.get('role')
    const driverParam = params.get('driver')
    const rideIdParam = params.get('rideId')
    const fareTHBParam = params.get('fareTHB')
    const fareSOLParam = params.get('fareSOL')

    if (driverParam || roleParam === 'rider') {
      setCurrentRole('rider')
      setRideParams({
        driver: driverParam,
        rideId: rideIdParam,
        fareTHB: fareTHBParam || '50',
        fareSOL: fareSOLParam || thbToSol(fareTHBParam || '50'),
      })
    }
  }, [])

  return (
    <WalletContextProvider network={network}>
      <div className="app-container">
        <Navbar
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          network={network}
          onNetworkChange={setNetwork}
        />

        <main className="main-content">
          {currentRole === 'driver' ? (
            <DriverView
              network={network}
            />
          ) : (
            <RiderView
              rideParams={rideParams}
              network={network}
            />
          )}
        </main>
      </div>
    </WalletContextProvider>
  )
}

export default App
