// one flow row: [Order] → [Commitment] → [Contract] → [Proof]
// - shows tiles
// - opens HistoryModal for details
// - opens CreateContractModal to build a funding tx
// - can send a demo "meter proof" tx (wallet-funded) so the Proof tile appears

import { useState } from 'react'
import type { FlowRow, TxDoc } from './HistoryApi'
import HistoryModal from './HistoryModal'
import CreateContractModal, { type CreateContractValues } from './CreateContractModal'

// tx helpers
import { createEscrowFundingTx } from '../../../transactions/createEscrowFundingTx'
import { submitTx } from '../../../transactions/submitTx'
import { buildMeterUnlockTx } from '../../../transactions/createUnlockTx'

// strict equality helper that treats null/undefined as non-matching
function eq<T>(a: T | null | undefined, b: T | null | undefined) {
  return a !== null && a !== undefined && b !== null && b !== undefined && a === b
}

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

  // base tile style – blue border & glow only when it's mine
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
        {/* actor key — shortened + ellipsis, same styling as other fields */}
        <div style={{ wordBreak: 'break-all' }}>
          <strong>Actor:</strong> {doc.actorKey.length > 16 ? `${doc.actorKey.slice(0, 12)}…` : doc.actorKey}
        </div>
      </div>
    </div>
  )
}

type Props = { row: FlowRow; myKey: string | null }

// derive buyer/seller keys depending on offer vs demand
function deriveParties(order?: TxDoc, commitment?: TxDoc): { buyerKey: string; sellerKey: string } {
  const buyerSellerFallback = { buyerKey: commitment?.actorKey ?? '', sellerKey: order?.actorKey ?? '' }
  if (!order || !commitment) return buyerSellerFallback
  if (order.kind === 'demand') return { buyerKey: order.actorKey, sellerKey: commitment.actorKey }
  if (order.kind === 'offer') return { buyerKey: commitment.actorKey, sellerKey: order.actorKey }
  return buyerSellerFallback
}

export default function HistoryRow({ row, myKey }: Props) {
  const [open, setOpen] = useState<TxDoc | null>(null)
  const [openCreate, setOpenCreate] = useState(false)

  const matchOK = orderAndCommitmentMatch(row.order, row.commitment)
  const parties = deriveParties(row.order, row.commitment)

  const arrow: React.CSSProperties = { alignSelf: 'center', opacity: 0.7 }
  const okArrow: React.CSSProperties = { alignSelf: 'center', color: '#29c467', fontWeight: 700 }
  const badArrow: React.CSSProperties = { alignSelf: 'center', color: '#ff5252', fontWeight: 700 }

  const canCreateContract =
    !!open && !!row.commitment && open.txid === row.commitment.txid && matchOK

  // handle confirm from CreateContractModal
  async function handleConfirm(values: CreateContractValues) {
    try {
      if (!row.order || !row.commitment) {
        alert('missing order/commitment context')
        return
      }

      const unsigned = await createEscrowFundingTx({
        buyerPubKey: parties.buyerKey,
        sellerPubKey: parties.sellerKey,
        meterPubKey: values.meterPubKey,
        quantityKWh: row.order.quantity ?? row.commitment.quantity ?? 0,
        windowStartISO: values.windowStartISO,
        windowEndISO: values.windowEndISO,
        topic: row.order.topic,
        commitmentTxid: row.commitment.txid,
        price: row.order.price ?? 0,
        currency: (row.order.currency as 'GBP' | 'SATS') ?? 'GBP',
        amountSats: 1
      })

      const { txid } = await submitTx(unsigned)
      console.log('[HistoryRow] contract broadcasted', txid)
      alert('contract submitted. use Refresh to see the new tile if it does not appear automatically.')
    } catch (e) {
      console.error('[HistoryRow] create contract failed', e)
      alert('contract submission failed. check console for details')
    } finally {
      setOpenCreate(false)
      setOpen(null)
    }
  }

  // send a *demo* proof tx (wallet-funded; not spending the escrow yet)
  async function handleSendProof() {
    try {
      if (!row.contract || !row.order || !row.commitment) return
      const { buyerKey, sellerKey } = parties

      const encrypted = {
        ciphertext: `dummy-proof::${row.contract.txid}`,
        boxForBuyer: 'dev-box',
        sha256: '00'.repeat(32)
      }

      const unsigned = await buildMeterUnlockTx(
        { txid: row.contract.txid, vout: 0 }, // demo; not the real escrow spend yet
        {
          sellerKey,
          buyerKey,
          topic: row.order.topic,
          quantity: row.order.quantity ?? 0,
          price: row.order.price ?? 0,
          currency: (row.order.currency as 'GBP' | 'SATS') ?? 'GBP'
        },
        'dev-meter-privkey',
        encrypted
      )

      const { txid } = await submitTx(unsigned)
      console.log('[HistoryRow] send proof broadcasted', txid)
      alert('proof submitted. use Refresh to see the new tile if it does not appear automatically.')
    } catch (e) {
      console.error('[HistoryRow] send proof failed', e)
      alert('proof submission failed. check console for details')
    } finally {
      setOpen(null)
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

      {/* details modal + contextual actions */}
      {open && (
        <HistoryModal
          doc={open}
          onClose={() => setOpen(null)}
          canCreateContract={canCreateContract}
          onCreateContract={() => setOpenCreate(true)}
          onSendProof={open.kind === 'contract' ? handleSendProof : undefined}
        />
      )}

      {/* create contract modal */}
      {openCreate && row.order && row.commitment && (
        <CreateContractModal
          order={row.order}
          commitment={row.commitment}
          onClose={() => setOpenCreate(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}
