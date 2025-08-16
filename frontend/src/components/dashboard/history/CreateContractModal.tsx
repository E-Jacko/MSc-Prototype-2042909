// modal to collect contract params only (no tx build here)
// timeout is set equal to windowEnd; ui field removed

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TxDoc } from './HistoryApi'
import { getMeterPubKeyForActor } from '../../../transactions/utils'

type FundingMode = 'dummy' | 'calculated'

export type CreateContractValues = {
  fundingMode: FundingMode
  windowStart: string      // iso
  windowEnd: string        // iso
  timeout: string          // iso (equal to windowEnd for now)
  meterPubKey: string
}

type Props = {
  order?: TxDoc
  commitment: TxDoc
  buyerKey: string
  onClose: () => void
  onConfirm: (values: CreateContractValues) => void
}

// build YYYY-MM-DDTHH:MM from a date
function toLocalMinute(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// normalize 'YYYY-MM-DDTHH:MM' to iso with seconds + z
function normalizeLocal(local: string): string {
  if (!local) return ''
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return withSeconds.endsWith('Z') ? withSeconds : `${withSeconds}Z`
}

const labelStyle: React.CSSProperties = {
  marginBottom: '0.35rem',
  fontWeight: 500,
  textAlign: 'center'
}
const inputStyle: React.CSSProperties = {
  padding: '0.6rem',
  fontSize: '1rem',
  backgroundColor: '#fff',
  border: '1px solid #ccc',
  color: '#000',
  borderRadius: 8,
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box'
}
const inputStyleDisabled: React.CSSProperties = { ...inputStyle, backgroundColor: '#eee', color: '#555' }

export default function CreateContractModal({ order, commitment, buyerKey, onClose, onConfirm }: Props) {
  // prefill times
  const now = useMemo(() => new Date(), [])
  const [fundingMode, setFundingMode] = useState<FundingMode>('dummy')
  const [startLocal, setStartLocal] = useState<string>(() => toLocalMinute(now))
  const [lengthMins, setLengthMins] = useState<number>(60)          // default 1h

  // prefill meter key for dev
  const [meterPubKey, setMeterPubKey] = useState<string>(() =>
    getMeterPubKeyForActor(buyerKey || commitment.actorKey)
  )

  // derived end (and refund timeout = end)
  const endLocal = useMemo(() => {
    const d = new Date(startLocal)
    if (!isNaN(d.getTime())) d.setMinutes(d.getMinutes() + Number(lengthMins || 0))
    return toLocalMinute(d)
  }, [startLocal, lengthMins])

  // validation
  const startDate = new Date(startLocal)
  const endDate = new Date(endLocal)
  const badWindow = isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate <= startDate
  const badMeter = !meterPubKey || meterPubKey.length < 66

  const esc = useCallback((e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }, [onClose])
  useEffect(() => { window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc) }, [esc])

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // confirm payload (timeout = windowEnd)
  function confirm() {
    const values: CreateContractValues = {
      fundingMode,
      windowStart: normalizeLocal(startLocal),
      windowEnd: normalizeLocal(endLocal),
      timeout: normalizeLocal(endLocal), // set refund timelock equal to window end
      meterPubKey: meterPubKey.trim()
    }
    onConfirm(values)
  }

  // field wrapper with spacing
  function Field({ label, children, mt = 14 }: { label: string; children: React.ReactNode; mt?: number }) {
    return (
      <div style={{ display: 'grid', marginTop: mt }}>
        <label style={labelStyle}>{label}</label>
        {children}
      </div>
    )
  }

  // title-case helper
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

  const summary = order
    ? `Order: ${cap(order.kind)} · ${order.quantity ?? '-'} kWh @ ${order.currency === 'SATS' ? `${order.price} sats/kWh` : `£${order.price}/kWh`}`
    : `Commitment · ${commitment.quantity ?? '-'} kWh @ ${commitment.currency === 'SATS' ? `${commitment.price} sats/kWh` : `£${commitment.price}/kWh`}`

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center', zIndex: 10000 }}>
      <div onClick={stop} style={{ background: '#fff', color: '#000', padding: '1.6rem 2rem', borderRadius: 12, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.35)' }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Create Contract</h3>

        {/* compact context */}
        <div style={{ display: 'grid', rowGap: 4, marginBottom: 8 }}>
          <p style={{ margin: 0 }}><strong>{summary}</strong></p>
          <p style={{ margin: 0, opacity: 0.9 }}><strong>Topic:</strong> {commitment.topic}</p>
        </div>

        {/* funding mode */}
        <Field label="Funding mode" mt={10}>
          <select
            value={fundingMode}
            onChange={(e) => setFundingMode(e.target.value as FundingMode)}
            style={inputStyle}
          >
            <option value="dummy">Dummy (1 sat)</option>
            <option value="calculated" disabled>Calculated (qty × price) — coming soon</option>
          </select>
        </Field>

        {/* window start + length */}
        <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={labelStyle}>Window start</label>
            <input
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              style={{ ...inputStyle, minWidth: 0 }}
            />
          </div>
          <div style={{ width: 130 }}>
            <label style={labelStyle}>Length (mins)</label>
            <input
              type="number"
              min={1}
              step={1}
              value={lengthMins}
              onChange={(e) => setLengthMins(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* derived end (also used as timeout) */}
        <Field label="Window end (derived)" mt={16}>
          <input type="datetime-local" value={endLocal} disabled style={inputStyleDisabled} />
        </Field>

        {/* meter key */}
        <Field label="Meter public key (dev)" mt={16}>
          <input
            type="text"
            value={meterPubKey}
            onChange={(e) => setMeterPubKey(e.target.value)}
            spellCheck={false}
            style={inputStyle}
          />
        </Field>

        {(badWindow || badMeter) && (
          <div style={{ color: '#c62828', fontSize: 12, marginTop: 10 }}>
            {badWindow && <div>window end must be after start</div>}
            {badMeter && <div>meter pubkey looks invalid</div>}
          </div>
        )}

        {/* actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
          <button onClick={confirm} disabled={badWindow || badMeter}
                  style={{ background: '#111', color: '#fff', padding: '0.5rem 1rem', borderRadius: 8 }}>
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
