// Minimal React UI to show MetaNet Desktop identity key
import { useState } from 'react'
import './App.css'
import { getIdentityKey } from './auth/authFetch'

function App() {
  const [identityKey, setIdentityKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    try {
      const key = await getIdentityKey()
      setIdentityKey(key)
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Failed to connect to MetaNet Desktop.')
      setIdentityKey(null)
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>🔐 MetaNet Identity Viewer</h1>
      <button onClick={handleConnect}>Connect to Wallet</button>

      {identityKey && (
        <div style={{ marginTop: '1rem' }}>
          <h3>🆔 Identity Key</h3>
          <pre style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{identityKey}</pre>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', color: 'red' }}>
          <h3>❌ Error</h3>
          <p>{error}</p>
        </div>
      )}
    </div>
  )
}

export default App
