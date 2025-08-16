// orders tab with filters, sorting, decoding; dev flag allows self-commit so you can test with one funded profile

import { useEffect, useMemo, useState } from 'react'
import { PushDrop, Transaction, Utils } from '@bsv/sdk'

import OrderList from './OrderList'
import OrderModal from './OrderModal'
import type { UIOrder } from './OrderItem'
import CreateOrderForm, { type OrderFormData as CreateFormData } from './CreateOrderForm'

// tx helpers
import { createTx } from '../../../transactions/createTx'
import { submitTx } from '../../../transactions/submitTx'
import { isoToLocalMinute } from '../../../transactions/utils'

// identity context (already fetched at login)
import { useIdentity } from '../../../context/IdentityContext'

// dev toggle: set to false again once you can fund a second profile
const ALLOW_SELF_COMMIT_FOR_DEV = true

const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// map overlay topic -> label
function topicToOverlayLabel(topic: string): string {
  if (topic === 'tm_cathays') return 'Cardiff – Cathays'
  return 'Cardiff – Cathays'
}

// small safe number parser
function num(n: unknown, d = 0): number {
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) ? v : d
}

// decode beef row into ui shape (offers and demands only for this list)
function decodeOrderFromBEEF(row: { beef: number[]; outputIndex?: number }): UIOrder | null {
  try {
    const tx = Transaction.fromBEEF(row.beef)
    const out = tx.outputs[row.outputIndex ?? 0]
    const { fields } = PushDrop.decode(out.lockingScript)
    const text = fields.map((f) => Utils.toUTF8(f))

    // expect shared 9-field layout
    const type = text[0] as UIOrder['type']
    const topic = text[1] || ''
    const actor = text[2] || ''
    const parent = text[3] || 'null'
    const createdISO = text[4] || new Date().toISOString()
    const expiryISO = text[5] || new Date(Date.now() + 3600_000).toISOString()
    const quantity = num(text[6])
    const price = num(text[7])
    const currency = (text[8] === 'SATS' ? 'SATS' : 'GBP') as 'GBP' | 'SATS'

    if (!(type === 'offer' || type === 'demand')) return null

    return {
      txid: tx.id('hex'),
      type,
      quantity,
      price,
      currency,
      expiryISO,
      overlayLabel: topicToOverlayLabel(topic),
      topic,
      createdISO,
      creatorKey: actor,
      parent: parent === 'null' ? null : parent
    }
  } catch {
    return null
  }
}

export default function OrdersTab() {
  // identity key available if you want to log who is acting
  const { identityKey } = useIdentity()

  // raw orders from overlay
  const [orders, setOrders] = useState<UIOrder[]>([])
  const [selected, setSelected] = useState<UIOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastCount, setLastCount] = useState(0)

  // filters and sort state
  const [typeFilter, setTypeFilter] = useState<'all' | 'offer' | 'demand'>('all')
  const [overlayFilter, setOverlayFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'expiry' | 'created'>('expiry')

  // fetch from overlay-express
  async function loadFromOverlay() {
    try {
      setLoading(true)
      const res = await fetch(`${OVERLAY_API}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'ls_cathays', query: { limit: 50 } })
      })
      const body = await res.json()
      const list: any[] = Array.isArray(body?.outputs) ? body.outputs : []

      const decoded: UIOrder[] = list
        .map((o) => decodeOrderFromBEEF({ beef: o.beef, outputIndex: o.outputIndex ?? 0 }))
        .filter((x: UIOrder | null): x is UIOrder => Boolean(x))

      setOrders(decoded)
      setLastCount(decoded.length)
      console.debug('[OrdersTab] loaded orders', decoded.length)
    } catch (e) {
      console.error('[OrdersTab] lookup failed', e)
    } finally {
      setLoading(false)
    }
  }

  // initial load
  useEffect(() => { void loadFromOverlay() }, [])

  // derive overlay options from current data
  const overlayOptions = useMemo(() => {
    const set = new Set<string>()
    orders.forEach(o => set.add(o.overlayLabel))
    return ['all', ...Array.from(set)]
  }, [orders])

  // apply filters and sort
  const visible = useMemo(() => {
    let list = orders.slice()

    if (typeFilter !== 'all') list = list.filter(o => o.type === typeFilter)
    if (overlayFilter !== 'all') list = list.filter(o => o.overlayLabel === overlayFilter)

    if (sortBy === 'expiry') {
      list.sort((a, b) => new Date(a.expiryISO).getTime() - new Date(b.expiryISO).getTime())
    } else {
      list.sort((a, b) => new Date(b.createdISO).getTime() - new Date(a.createdISO).getTime())
    }
    return list
  }, [orders, typeFilter, overlayFilter, sortBy])

  // handle create flow
  const handleCreateOrder = async (data: CreateFormData) => {
    try {
      console.debug('[OrdersTab] creating order', data)
      const built = await createTx({
        type: data.type,
        quantity: data.quantity,
        price: data.price,
        currency: data.currency,
        expiryDate: data.expiryDate,
        overlay: data.overlay
      })

      const unsigned: Transaction = built.unsigned
      const creatorKey = built.creatorKey

      const { txid } = await submitTx(unsigned)
      console.log('[OrdersTab] order broadcasted', txid)

      const optimistic: UIOrder = {
        txid,
        type: data.type,
        quantity: Number(data.quantity),
        price: Number(data.price),
        currency: data.currency,
        expiryISO: data.expiryDate ? `${data.expiryDate}:00Z` : new Date(Date.now() + 3600_000).toISOString(),
        overlayLabel: data.overlay,
        topic: 'tm_cathays',
        createdISO: new Date().toISOString(),
        creatorKey: creatorKey || '',
        parent: null
      }

      setOrders(prev => [optimistic, ...prev])
      await loadFromOverlay()
    } catch (e) {
      console.error('[OrdersTab] create/submit failed', e)
    }
  }

  // build and submit a commitment using the existing createTx + submitTx
  const handleCommit = async (o: UIOrder) => {
    try {
      // optional self-commit guard controlled by dev flag
      if (!ALLOW_SELF_COMMIT_FOR_DEV && identityKey && identityKey === o.creatorKey) {
        alert('you cannot commit to your own order')
        return
      }

      // log what we will commit to
      console.debug('[OrdersTab] committing to order', { txid: o.txid, qty: o.quantity, price: o.price, currency: o.currency })

      // create a commitment by reusing the generic createTx flow
      const built = await createTx({
        type: 'commitment',
        quantity: o.quantity,
        price: o.price,
        currency: o.currency,
        expiryDate: isoToLocalMinute(o.expiryISO),
        overlay: o.overlayLabel,
        parent: o.txid
      })

      const { unsigned } = built
      console.debug('[OrdersTab] commitment built via createTx')

      // sign + broadcast via the existing submitter
      const { txid } = await submitTx(unsigned)
      console.log('[OrdersTab] commitment broadcasted', txid)

      // close modal and refresh view
      setSelected(null)
      await loadFromOverlay()
    } catch (e: any) {
      console.error('[OrdersTab] commit failed', e)
      const msg = String(e?.message || e)

      if (msg.includes('409')) {
        alert('this order has already been taken')
        return
      }
      alert('commit failed. check console for details')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '4rem', alignItems: 'flex-start', paddingTop: '1rem' }}>
      {/* left: create form */}
      <div style={{ flex: 1 }}>
        <h2>Create Order</h2>
        <CreateOrderForm onSubmit={handleCreateOrder} />
      </div>

      {/* right: list, filters, and refresh */}
      <div style={{ flex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <h2 style={{ margin: 15, flex: 1 }}>Active Orders</h2>
          <button onClick={() => void loadFromOverlay()} disabled={loading} title="Reload from overlay">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* status line right-aligned */}
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7, textAlign: 'right' }}>
          Last: loaded {lastCount} order(s)
        </div>

        {/* filter + sort controls */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Type</span>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option value="all">All</option>
              <option value="offer">Offer</option>
              <option value="demand">Demand</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Overlay</span>
            <select value={overlayFilter} onChange={(e) => setOverlayFilter(e.target.value)}>
              {overlayOptions.map(o => <option key={o} value={o}>{o === 'all' ? 'All' : o}</option>)}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="expiry">Expiry soonest first</option>
              <option value="created">Created newest first</option>
            </select>
          </label>
        </div>

        {/* list */}
        <div style={{ marginTop: 16 }}>
          <OrderList orders={visible} onSelect={setSelected} />
        </div>
      </div>

      {selected && (
        <OrderModal order={selected} onClose={() => setSelected(null)} onCommit={handleCommit} />
      )}
    </div>
  )
}
