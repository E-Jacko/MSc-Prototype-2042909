// modal for creating a contract funding tx from an order and commitment
// fields: funding mode, window start, length in minutes, derived window end, meter pubkey
// timeout equals window end for the prototype

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import type { TxDoc } from './HistoryApi'

export type FundingMode = 'dummy' | 'calculated'

export type CreateContractValues = {
  fundingMode: FundingMode
  windowStartISO: string
  windowEndISO: string
  meterPubKey: string
}

type Props = {
  order: TxDoc
  commitment: TxDoc
  onClose: () => void
  onConfirm: (values: CreateContractValues) => Promise<void> | void
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid #ccc',
  background: '#fff',
  color: '#000',
  fontSize: 14
}

export default function CreateContractModal({ order, commitment, onClose, onConfirm }: Props) {
  // reference commitment so ts does not warn (reserved for future validation)
  void commitment

  // initial window start equals now rounded to minute
  const nowISO = useMemo(() => {
    const d = new Date()
    d.setSeconds(0, 0)
    return d.toISOString()
  }, [])

  const [fundingMode, setFundingMode] = useState<FundingMode>('dummy')
  const [windowStartISO, setWindowStartISO] = useState(nowISO)
  const [lengthMins, setLengthMins] = useState<number>(60)
  const [meterPubKey, setMeterPubKey] = useState<string>(
    // dev default meter pubkey (replace later with certificate lookup)
    '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'
  )

  // derive window end from start and length
  const windowEndISO = useMemo(() => {
    const start = new Date(windowStartISO)
    const end = new Date(start.getTime() + (Number.isFinite(lengthMins) ? lengthMins : 0) * 60_000)
    return end.toISOString()
  }, [windowStartISO, lengthMins])

  // close on esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // stop click bubbling
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // compact display helpers for the header
  const headerLine = `Order: ${order.kind === 'demand' ? 'Demand' : 'Offer'} · ${order.quantity ?? 0} kWh @ ${order.currency === 'SATS' ? `${order.price} sats/kWh` : `£${order.price}/kWh`}`

  async function handleConfirm() {
    await onConfirm({
      fundingMode,
      windowStartISO,
      windowEndISO,
      meterPubKey
    })
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 9999 }}
      data-commitment-txid={commitment.txid}
    >
      <div onClick={stop} style={{ background: '#fff', color: '#000', padding: '1.5rem 2rem', borderRadius: 12, width: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Create Contract</h3>

        <div style={{ textAlign: 'center', marginBottom: 10, fontWeight: 600 }}>{headerLine}</div>
        <div style={{ textAlign: 'center', marginBottom: 14, color: '#333' }}>Topic: {order.topic}</div>

        {/* funding mode */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Funding mode</div>
          <select
            value={fundingMode}
            onChange={e => setFundingMode(e.target.value as FundingMode)}
            style={inputBase}
          >
            <option value="dummy">Dummy (1 sat)</option>
            <option value="calculated" disabled>Calculated (qty × price)</option>
          </select>
        </div>

        {/* window start and length row */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, marginBottom: 6, textAlign: 'center' }}>Window start</div>
              <input
                type="datetime-local"
                value={new Date(windowStartISO).toISOString().slice(0,16)}
                onChange={(e) => setWindowStartISO(`${e.target.value}:00Z`)}
                style={inputBase}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, marginBottom: 6, textAlign: 'center' }}>Length (mins)</div>
              <input
                type="number"
                value={lengthMins}
                min={1}
                onChange={(e) => setLengthMins(Number(e.target.value) || 0)}
                style={inputBase}
              />
            </div>
          </div>
        </div>

        {/* window end derived from inputs */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Window end (derived)</div>
          <input value={new Date(windowEndISO).toLocaleString()} readOnly style={{ ...inputBase, background: '#eee' }} />
        </div>

        {/* meter pubkey */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Meter public key (dev)</div>
          <input
            value={meterPubKey}
            onChange={(e) => setMeterPubKey(e.target.value)}
            style={inputBase}
          />
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
          <button
            onClick={handleConfirm}
            style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}
            title="create contract funding transaction"
          >
            ✅ Confirm
          </button>
          <button onClick={onClose} style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}>
            ❌ Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
