// frontend/src/components/dashboard/history/HistoryModal.tsx
// simple details modal shown when a tile is clicked

import { useCallback, useEffect } from 'react'
import type { TxDoc } from './HistoryApi'

type Props = {
  doc: TxDoc
  onClose: () => void
  canCreateContract?: boolean   // only relevant for commitment docs
}

const woc = (txid: string) => `https://whatsonchain.com/tx/${txid}`

export default function HistoryModal({ doc, onClose, canCreateContract }: Props) {
  const esc = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => { window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [esc])

  const title =
    doc.kind === 'offer' ? 'Offer' :
    doc.kind === 'demand' ? 'Demand' :
    doc.kind === 'commitment' ? 'Commitment' :
    doc.kind === 'contract' ? 'Contract' :
    doc.kind === 'proof' ? 'Proof' :
    'Transaction'

  const priceTxt =
    doc.currency === 'SATS'
      ? `${doc.price ?? 0} sats/kWh`
      : doc.price != null
        ? `£${doc.price}/kWh`
        : undefined

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}>
      <div onClick={stop} style={{ background: '#fff', color: '#000', padding: '1.5rem 2rem', borderRadius: 12, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>{title}</h3>

        <div style={{ display: 'grid', rowGap: 6 }}>
          <p><strong>Topic:</strong> {doc.topic || 'unknown'}</p>
          <p><strong>Actor key:</strong> <span style={{ wordBreak: 'break-all' }}>{doc.actorKey || 'unknown'}</span></p>
          <p><strong>Created:</strong> {new Date(doc.createdISO).toLocaleString()}</p>
          {doc.expiryISO && <p><strong>Expiry:</strong> {new Date(doc.expiryISO).toLocaleString()}</p>}
          {doc.quantity != null && <p><strong>Quantity:</strong> {doc.quantity} kWh</p>}
          {priceTxt && <p><strong>Price:</strong> {priceTxt}</p>}
          {doc.parentTxid && (
            <p><strong>Parent:</strong>{' '}
              <a href={woc(doc.parentTxid)} target="_blank" rel="noreferrer" style={{ color: '#0b69ff', wordBreak: 'break-all' }}>
                {doc.parentTxid}
              </a>
            </p>
          )}
          <p style={{ wordBreak: 'break-all' }}>
            <strong>TXID:</strong>{' '}
            <a href={woc(doc.txid)} target="_blank" rel="noreferrer" style={{ color: '#0b69ff' }}>
              {doc.txid}
            </a>
          </p>
        </div>

        {/* Footer buttons */}
        {doc.kind === 'commitment' && canCreateContract ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
            <button
              onClick={() => {}}
              style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}
              title="Create a contract from this matching order & commitment"
            >
              📝 Create Contract
            </button>
            <button onClick={onClose} style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}>
              ❌ Close
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <button onClick={onClose} style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
