// src/components/WalletBadge.tsx
import { useState, useRef } from 'react'
import { useIdentity } from '../context/IdentityContext'

export default function WalletBadge() {
  const { identityKey, connectToWallet } = useIdentity()
  const [showTip, setShowTip] = useState(false)
  const labelRef = useRef<HTMLDivElement | null>(null)

  const clearSavedIdentity = () => {
    localStorage.removeItem('identityKey')
    window.location.reload()
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: '#ddd'
      }}
    >
      {identityKey ? (
        <>
          {/* green dot */}
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#0bd36f',
              display: 'inline-block'
            }}
          />

          {/* Two-line label (same size/weight), hover shows popover */}
          <div
            ref={labelRef}
            onMouseEnter={() => setShowTip(true)}
            onMouseLeave={() => setShowTip(false)}
            title="Hover to see wallet key"
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1.1,
              cursor: 'default',
              userSelect: 'none'
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>Wallet</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Connected</span>

            {/* Popover (absolute, so it won't resize the navbar) */}
            {showTip && (
              <div
                role="tooltip"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#111',
                  color: '#eee',
                  border: '1px solid #444',
                  borderRadius: 8,
                  padding: '6px 8px',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
                  zIndex: 1000
                }}
              >
                <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {identityKey}
                </code>
                {/* little arrow */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderBottom: '6px solid #444'
                  }}
                />
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -5,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderBottom: '5px solid #111'
                  }}
                />
              </div>
            )}
          </div>

          <button
            onClick={clearSavedIdentity}
            style={{
              padding: '2px 6px',
              background: '#222',
              border: '1px solid #444',
              color: '#fff',
              borderRadius: 6,
              cursor: 'pointer'
            }}
            title="Forces a fresh identity fetch next time"
          >
            Clear
          </button>
        </>
      ) : (
        <>
          {/* amber dot */}
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ffab00',
              display: 'inline-block'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Wallet</span>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Not connected</span>
          </div>
          <button
            onClick={connectToWallet}
            style={{
              padding: '2px 6px',
              background: '#222',
              border: '1px solid #444',
              color: '#fff',
              borderRadius: 6,
              cursor: 'pointer'
            }}
          >
            Connect
          </button>
        </>
      )}
    </div>
  )
}
