// frontend/src/components/dashboard/history/HistoryItem.tsx
// square card for a node; highlights blue if created by me

import React from 'react'
import type { TxDoc } from './HistoryApi'

type Props = {
  label: string
  doc?: TxDoc
  myKey?: string | null
  onClick?: (doc: TxDoc) => void
}

function priceText(doc: TxDoc): string | null {
  if (doc.price == null || doc.currency == null) return null
  return doc.currency === 'SATS' ? `${doc.price} sats/kWh` : `£${doc.price}/kWh`
}

export default function HistoryItem({ label, doc, myKey, onClick }: Props) {
  const clickable = !!doc && !!onClick
  const mine = !!doc && !!myKey && doc.actorKey === myKey

  const box: React.CSSProperties = {
    width: 200,
    minHeight: 140,
    borderRadius: 10,
    padding: '0.75rem',
    background: doc ? '#333' : '#2a2a2a',
    color: '#f2f2f2',
    border: mine ? '2px solid #1e90ff' : (doc ? '1px solid #555' : '1px dashed #555'),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: clickable ? 'pointer' : 'default',
    boxShadow: mine ? '0 0 0 3px rgba(30,144,255,0.15)' : 'none'
  }

  // Pending look unchanged
  if (!doc) {
    return (
      <div style={box} title={`${label} (pending)`}>
        <div style={{ fontWeight: 700, opacity: 0.85 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>Pending…</div>
      </div>
    )
  }

  const price = priceText(doc)
  const header =
    label.toLowerCase() === 'order'
      ? (doc.kind.charAt(0).toUpperCase() + doc.kind.slice(1)) // Offer / Demand
      : label

  return (
    <div style={box} onClick={() => clickable && onClick!(doc)}>
      <div style={{ fontWeight: 700 }}>{header}</div>
      <div style={{ fontSize: 12, lineHeight: 1.35, marginTop: 6 }}>
        {doc.quantity != null && <div><strong>Qty:</strong> {doc.quantity} kWh</div>}
        {price && <div><strong>Price:</strong> {price}</div>}
        {doc.expiryISO && <div><strong>Expiry:</strong> {new Date(doc.expiryISO).toLocaleString()}</div>}
      </div>
    </div>
  )
}
