// React context to manage identity key globally

import { createContext, useContext, useEffect, useState } from 'react'
import { getIdentityKey } from '../auth/authFetch'

interface IdentityContextType {
  identityKey: string | null
  connectToWallet: () => Promise<void>
}

const IdentityContext = createContext<IdentityContextType>({
  identityKey: null,
  connectToWallet: async () => {}
})

// Provider wraps the app and manages state + persistence
export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identityKey, setIdentityKey] = useState<string | null>(null)

  // Restore identity from localStorage on load
  useEffect(() => {
    const saved = localStorage.getItem('identityKey')
    if (saved) {
      setIdentityKey(saved)
    }
  }, [])

  // Connect to wallet and get identity key
  const connectToWallet = async () => {
    const key = await getIdentityKey()
    setIdentityKey(key)
    localStorage.setItem('identityKey', key)
  }

  return (
    <IdentityContext.Provider value={{ identityKey, connectToWallet }}>
      {children}
    </IdentityContext.Provider>
  )
}

// Access the context in any component
export function useIdentity() {
  return useContext(IdentityContext)
}
