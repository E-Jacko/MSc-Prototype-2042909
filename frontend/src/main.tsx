import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { IdentityProvider } from './context/IdentityContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <IdentityProvider>
      <App />
    </IdentityProvider>
  </React.StrictMode>
)
