// global identity context

import { createContext, useContext, useEffect, useState } from 'react'
import { getIdentityKey } from '../auth/authFetch'

interface IdentityContextType {
  identityKey: string | null
  connectToWallet: () => Promise<void>
}

// minimal default to allow useIdentity() before provider mounts
const IdentityContext = createContext<IdentityContextType>({
  identityKey: null,
  connectToWallet: async () => {}
})

// provider: owns identity state and persistence
export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const [identityKey, setIdentityKey] = useState<string | null>(null)

  // restore from localStorage on first render
  useEffect(() => {
    const saved = localStorage.getItem('identityKey')
    if (saved) setIdentityKey(saved)
  }, [])

  // connect to wallet and fetch public identity key
  const connectToWallet = async () => {
    const key = await getIdentityKey()
    setIdentityKey(key) // update runtime state
    localStorage.setItem('identityKey', key) // persist public identifier
  }

  // expose value to descendants
  return (
    <IdentityContext.Provider value={{ identityKey, connectToWallet }}>
      {children}
    </IdentityContext.Provider>
  )
}

// hook for consuming components
export function useIdentity() {
  return useContext(IdentityContext)
}
