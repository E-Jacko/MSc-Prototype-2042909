import { useCallback, useEffect, useState } from 'react'
import type { TxDoc } from './HistoryApi'
import { checkSpv, type SpvStatus } from '../../../transactions/spvClient.ts'

type Props = {
  doc: TxDoc
  onClose: () => void
  canCreateContract?: boolean
  onCreateContract?: () => void
  onSendProof?: () => void
}

const woc = (txid: string) => `https://whatsonchain.com/tx/${txid}`

export default function HistoryModal({ doc, onClose, canCreateContract, onCreateContract, onSendProof }: Props) {
  const esc = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => { window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [esc])

  const [spv, setSpv] = useState<SpvStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const title =
    doc.kind === 'offer' ? 'Offer' :
    doc.kind === 'demand' ? 'Demand' :
    doc.kind === 'commitment' ? 'Commitment' :
    doc.kind === 'contract' ? 'Contract' :
    doc.kind === 'proof' ? 'Proof' : 'Transaction'

  const priceTxt =
    doc.currency === 'SATS'
      ? `${doc.price ?? 0} sats/kWh`
      : doc.price != null ? `£${doc.price}/kWh` : undefined

  const cipherPreview = doc.cipher && doc.cipher.length > 120 ? `${doc.cipher.slice(0, 120)}…` : (doc.cipher ?? '')

  // status dot colors
  function spvDotColor(s: SpvStatus | null): string | undefined {
    if (!s) return undefined
    if (s.state === 'confirmed') return '#29c467' // green
    if (s.state === 'invalid' || s.state === 'error') return '#ff5252' // red
    return '#ffb020' // amber
  }
  function parentDotColor(s: SpvStatus | null): string | undefined {
    if (!s) return undefined
    if (s.parent === 'match') return '#29c467'
    if (s.parent === 'mismatch') return '#ff5252'
    return '#9aa0a6' // unknown -> grey
  }

  async function onCheckSpv() {
    try {
      if (!doc.txid) return
      setBusy(true)
      const status = await checkSpv(doc.txid, doc.parentTxid || undefined)
      setSpv(status)
    } catch (e) {
      setSpv({ state: 'error', parent: 'unknown', cached: false, updated: false, message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const showCreateBtn = doc.kind === 'commitment' && !!canCreateContract && !!onCreateContract
  const showSendProofBtn = doc.kind === 'contract' && !!onSendProof

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 9999,
        padding: 10
      }}
    >
      <div
        onClick={stop}
        style={{
          background: '#fff',
          color: '#000',
          padding: '1rem 1.25rem',
          borderRadius: 12,
          width: 560,
          maxWidth: '92vw',
          // remove inner modal scrollbar
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
        }}
      >
        <h3 style={{ margin: '0 0 8px', textAlign: 'center' }}>{title}</h3>

        <div style={{ display: 'grid', rowGap: 4, lineHeight: 1.25 }}>
          <p><strong>Topic:</strong> {doc.topic || 'unknown'}</p>
          <p><strong>Actor key:</strong> <span style={{ wordBreak: 'break-all' }}>{doc.actorKey || 'unknown'}</span></p>
          <p><strong>Created:</strong> {new Date(doc.createdISO).toLocaleString()}</p>
          {doc.expiryISO && <p><strong>Expiry:</strong> {new Date(doc.expiryISO).toLocaleString()}</p>}
          {doc.quantity != null && <p><strong>Quantity:</strong> {doc.quantity} kWh</p>}
          {priceTxt && <p><strong>Price:</strong> {priceTxt}</p>}

          {doc.kind === 'proof' && (
            <>
              {doc.sha256 && <p style={{ wordBreak: 'break-all' }}><strong>SHA-256:</strong> {doc.sha256}</p>}
              {doc.meterKey && <p style={{ wordBreak: 'break-all' }}><strong>Meter key:</strong> {doc.meterKey}</p>}
              {doc.cipher && <p style={{ wordBreak: 'break-all' }}><strong>Cipher:</strong> {cipherPreview}</p>}
            </>
          )}

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

          {spv && (
            <div style={{ display: 'grid', rowGap: 6, marginTop: 6 }}>
              {/* Line 1: SPV */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: spvDotColor(spv) }} />
                <code style={{ fontSize: 12 }}>
                  <strong>SPV:</strong>{' '}
                  {spv.state}
                  {spv.state === 'confirmed' && (
                    <>
                      {' • height '}{'height' in spv ? spv.height : '?'}
                      {' • branch '}{'branchLen' in spv ? spv.branchLen : '?'}
                      {spv.cached ? ' • cached' : ''}
                    </>
                  )}
                  {('message' in spv && spv.message) ? ` • ${spv.message}` : ''}
                </code>
              </div>

              {/* Line 2: Parent */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: parentDotColor(spv) }} />
                <code style={{ fontSize: 12 }}>
                  <strong>Parent:</strong>{' '}
                  {spv.parent ?? 'unknown'}
                </code>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
          <button onClick={onCheckSpv} disabled={busy} style={{ background: '#111', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: 8 }}>
            {busy ? 'Checking…' : 'Check SPV'}
          </button>

          {showCreateBtn && (
            <button onClick={onCreateContract} style={{ background: '#111', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: 8 }}>
              📝 Create Contract
            </button>
          )}
          {showSendProofBtn && (
            <button onClick={onSendProof} style={{ background: '#111', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: 8 }}>
              📤 Send Meter Proof
            </button>
          )}
          <button onClick={onClose} style={{ background: '#111', color: '#fff', padding: '0.45rem 0.9rem', borderRadius: 8 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
