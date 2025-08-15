// frontend/src/components/dashboard/history/HistoryRow.tsx
// one flow row: [Order] → [Commitment] → [Contract] → [Proof]

import { useState } from 'react'
import type { FlowRow, TxDoc } from './HistoryApi'
import HistoryModal from './HistoryModal'

type Props = { row: FlowRow; myKey: string | null }

function priceTxt(doc: TxDoc | undefined): string | undefined {
  if (!doc || doc.price == null || doc.currency == null) return undefined
  return doc.currency === 'SATS' ? `${doc.price} sats/kWh` : `£${doc.price}/kWh`
}

function Tile({ doc, label, myKey, onOpen }: {
  doc?: TxDoc
  label: 'Order' | 'Commitment' | 'Contract' | 'Proof'
  myKey: string | null
  onOpen: () => void
}) {
  const hasDoc = !!doc
  const isMine = !!doc && !!myKey && doc.actorKey === myKey

  // Base tile style – compact vertical spacing for real tiles; keep space-between for pending
  const base: React.CSSProperties = {
    width: 180,
    minHeight: 110, // a touch more rectangular
    borderRadius: 10,
    background: '#333',
    color: '#f1f1f1',
    border: `2px solid ${hasDoc && isMine ? '#0b69ff' : '#111'}`,
    boxShadow: hasDoc ? '0 8px 22px rgba(11,105,255,0.25)' : '0 2px 10px rgba(0,0,0,0.25)',
    padding: 10,
    cursor: hasDoc ? 'pointer' : 'default',
    display: 'flex',
    flexDirection: 'column',
    ...(hasDoc ? { gap: 6 } : { justifyContent: 'space-between' }) // compact vs. pending layout
  }

  // Pending: dashed border, no colored shadow
  if (!doc) {
    return (
      <div style={{ ...base, opacity: 0.65, borderStyle: 'dashed', borderColor: '#555', boxShadow: 'none' }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Pending…</div>
      </div>
    )
  }

  const header =
    label === 'Order'
      ? (doc.kind.charAt(0).toUpperCase() + doc.kind.slice(1)) // Offer / Demand
      : label

  const price = priceTxt(doc)

  return (
    <div style={base} onClick={onOpen} title="view details">
      <div style={{ fontWeight: 700 }}>{header}</div>
      <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
        {doc.quantity != null && <div><strong>Qty:</strong> {doc.quantity} kWh</div>}
        {price && <div><strong>Price:</strong> {price}</div>}
        {doc.expiryISO && <div><strong>Expiry:</strong> {new Date(doc.expiryISO).toLocaleString()}</div>}
      </div>
    </div>
  )
}

export default function HistoryRow({ row, myKey }: Props) {
  const [open, setOpen] = useState<TxDoc | null>(null)

  const arrow: React.CSSProperties = { alignSelf: 'center', opacity: 0.7 }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, auto)', columnGap: 10, alignItems: 'center' }}>
        <Tile label="Order"       doc={row.order}       myKey={myKey} onOpen={() => setOpen(row.order!)} />
        <div style={arrow}>→</div>
        <Tile label="Commitment"  doc={row.commitment}  myKey={myKey} onOpen={() => setOpen(row.commitment!)} />
        <div style={arrow}>→</div>
        <Tile label="Contract"    doc={row.contract}    myKey={myKey} onOpen={() => setOpen(row.contract!)} />
        <div style={arrow}>→</div>
        <Tile label="Proof"       doc={row.proof}       myKey={myKey} onOpen={() => setOpen(row.proof!)} />
      </div>

      {open && <HistoryModal doc={open} onClose={() => setOpen(null)} />}
    </>
  )
}
