import './App.css'
import { useIdentity } from './context/IdentityContext'
import Dashboard from './components/dashboard/Dashboard'

function App() {
  const { identityKey, connectToWallet } = useIdentity()

  // If identityKey not found, show connect screen
  if (!identityKey) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h1>Welcome</h1>
        <p>Click below to connect to MetaNet Desktop.</p>
        <button onClick={connectToWallet}>Connect to Wallet</button>
      </div>
    )
  }

  // If identityKey exists, show the dashboard
  return <Dashboard />
}

export default App
