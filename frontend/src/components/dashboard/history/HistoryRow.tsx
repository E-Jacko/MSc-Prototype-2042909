// one flow row: [Order] → [Commitment] → [Contract] → [Proof]
// includes the CreateContractModal flow + submit handler

import { useState } from 'react'
import type { FlowRow, TxDoc } from './HistoryApi'
import HistoryModal from './HistoryModal'
import CreateContractModal, { type CreateContractValues } from './CreateContractModal'
import { submitTx } from '../../../transactions/submitTx'
import { createEscrowFundingTx } from '../../../transactions/createEscrowFundingTx'
import { buildTermsHash } from '../../../transactions/utils'
import type { EscrowParams } from '../../../transactions/types'

type Props = { row: FlowRow; myKey: string | null }

// strict equality helper that treats null/undefined as non-matching
const eq = <T,>(a: T | null | undefined, b: T | null | undefined) =>
  a !== null && a !== undefined && b !== null && b !== undefined && a === b

// decide whether an order and a commitment match at the data level
function orderAndCommitmentMatch(order?: TxDoc, commitment?: TxDoc): boolean {
  if (!order || !commitment) return false
  if (!eq(order.topic, commitment.topic)) return false
  if (!eq(order.currency, commitment.currency)) return false
  if (!eq(order.price, commitment.price)) return false
  if (!eq(order.quantity, commitment.quantity)) return false
  if (order.expiryISO && commitment.expiryISO) {
    if (new Date(order.expiryISO).getTime() !== new Date(commitment.expiryISO).getTime()) return false
  }
  return true
}

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

  // base tile
  const base: React.CSSProperties = {
    width: 180,
    minHeight: 110,
    borderRadius: 10,
    background: '#333',
    color: '#f1f1f1',
    border: `2px solid ${hasDoc && isMine ? '#0b69ff' : '#111'}`,
    boxShadow: hasDoc && isMine
      ? '0 8px 22px rgba(11,105,255,0.25)'
      : (hasDoc ? '0 2px 10px rgba(0,0,0,0.25)' : 'none'),
    padding: 10,
    cursor: hasDoc ? 'pointer' : 'default',
    display: 'flex',
    flexDirection: 'column',
    ...(hasDoc ? { gap: 6 } : { justifyContent: 'space-between' })
  }

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
        <div style={{ wordBreak: 'break-all' }}>
          <strong>Actor:</strong> {doc.actorKey.length > 16 ? `${doc.actorKey.slice(0, 12)}…` : doc.actorKey}
        </div>
      </div>
    </div>
  )
}

// derive buyer/seller roles from the pair (order, commitment)
function deriveRoles(order?: TxDoc, commitment?: TxDoc): { buyer: string | null, seller: string | null } {
  if (!order || !commitment) return { buyer: null, seller: null }
  if (order.kind === 'demand') {
    return { buyer: order.actorKey, seller: commitment.actorKey }
  }
  if (order.kind === 'offer') {
    return { buyer: commitment.actorKey, seller: order.actorKey }
  }
  return { buyer: null, seller: null }
}

export default function HistoryRow({ row, myKey }: Props) {
  const [open, setOpen] = useState<TxDoc | null>(null)
  const [openCreate, setOpenCreate] = useState(false)

  const matchOK = orderAndCommitmentMatch(row.order, row.commitment)
  const { buyer: buyerKeyRaw, seller: sellerKeyRaw } = deriveRoles(row.order, row.commitment)

  // dev-friendly fallbacks so single-actor testing still works
  const buyerKey = buyerKeyRaw ?? myKey ?? ''
  const sellerKey = sellerKeyRaw ?? buyerKey

  const arrow: React.CSSProperties = { alignSelf: 'center', opacity: 0.7 }
  const okArrow: React.CSSProperties = {
    alignSelf: 'center',
    color: '#29c467',
    fontWeight: 700
  }
  const badArrow: React.CSSProperties = {
    alignSelf: 'center',
    color: '#ff5252',
    fontWeight: 700
  }

  const canCreateContract =
    !!open && !!row.commitment && open.txid === row.commitment.txid && matchOK

  async function handleConfirm(values: CreateContractValues) {
    try {
      if (!row.commitment) return

      // build terms hash (binds window + qty/price + meter key)
      const termsHash = await buildTermsHash({
        orderTxid: row.order?.txid ?? null,
        commitTxid: row.commitment.txid,
        topic: row.commitment.topic,
        quantityKWh: row.commitment.quantity ?? row.order?.quantity ?? 0,
        price: row.commitment.price ?? row.order?.price ?? 0,
        currency: (row.commitment.currency ?? row.order?.currency ?? 'GBP') as 'GBP' | 'SATS',
        windowStart: values.windowStart,
        windowEnd: values.windowEnd,
        meterPubKey: values.meterPubKey
      })

      // amount for the placeholder escrow
      const amountSats = values.fundingMode === 'dummy' ? 1 : 1 // calculated later

      const params: EscrowParams = {
        buyerPubKey: buyerKey,
        sellerPubKey: sellerKey,
        meterPubKey: values.meterPubKey,
        quantityKWh: row.commitment.quantity ?? row.order?.quantity ?? 0,
        price: row.commitment.price ?? row.order?.price ?? 0,
        currency: (row.commitment.currency ?? row.order?.currency ?? 'GBP') as 'GBP' | 'SATS',
        windowStart: values.windowStart,
        windowEnd: values.windowEnd,
        timeout: values.timeout, // equals windowEnd for now
        termsHash,
        amountSats,
        topic: row.commitment.topic,
        commitmentTxid: row.commitment.txid
      }

      // build and submit
      const unsigned = await createEscrowFundingTx(params)
      const { txid } = await submitTx(unsigned)
      console.log('[HistoryRow] contract broadcasted', txid)

      setOpenCreate(false)
      alert('Contract submitted. Use Refresh to see the new tile if it does not appear automatically.')
    } catch (e) {
      console.error('[HistoryRow] create contract failed', e)
      alert('contract creation failed. check console for details')
    }
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, auto)', columnGap: 10, alignItems: 'center' }}>
        <Tile label="Order"       doc={row.order}       myKey={myKey} onOpen={() => setOpen(row.order!)} />
        <div style={arrow}>→</div>
        <Tile label="Commitment"  doc={row.commitment}  myKey={myKey} onOpen={() => setOpen(row.commitment!)} />
        <div
          style={matchOK ? okArrow : badArrow}
          title={matchOK ? 'Fields match – ready to contract' : 'Fields differ – not ready'}
          aria-label={matchOK ? 'ready to contract' : 'not ready'}
        >
          {matchOK ? '✓' : '✗'}
        </div>
        <Tile label="Contract"    doc={row.contract}    myKey={myKey} onOpen={() => setOpen(row.contract!)} />
        <div style={arrow}>→</div>
        <Tile label="Proof"       doc={row.proof}       myKey={myKey} onOpen={() => setOpen(row.proof!)} />
      </div>

      {open && (
        <HistoryModal
          doc={open}
          onClose={() => setOpen(null)}
          canCreateContract={canCreateContract}
          onCreate={() => setOpenCreate(true)}
        />
      )}

      {openCreate && row.commitment && (
        <CreateContractModal
          order={row.order}
          commitment={row.commitment}
          buyerKey={buyerKey}
          onClose={() => setOpenCreate(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
