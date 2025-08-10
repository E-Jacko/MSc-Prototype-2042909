// OrdersTab.tsx
// Minimal + robust: works whether createTx returns { unsigned } or a Transaction directly.

import { useEffect, useState } from 'react'
import { PushDrop, Transaction, Utils } from '@bsv/sdk'

import OrderList from './OrderList'
import OrderModal from './OrderModal'
import type { UIOrder } from './OrderItem'
import CreateOrderForm, { type OrderFormData as CreateFormData } from './CreateOrderForm'

// ✅ Your tx builders export *named* functions
import { createTx } from '../../../transactions/createTx'
import { submitTx } from '../../../transactions/submitTx'

const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// Map overlay topic → label shown in UI
function topicToOverlayLabel(topic: string): string {
  if (topic === 'tm_cathays') return 'Cardiff – Cathays'
  return 'Cardiff – Cathays'
}

// Decode a single output from an overlay lookup row into a UIOrder.
function decodeOrderFromBEEF(row: { beef: number[]; outputIndex?: number }): UIOrder | null {
  try {
    const tx = Transaction.fromBEEF(row.beef)
    const out = tx.outputs[row.outputIndex ?? 0]

    const { fields } = PushDrop.decode(out.lockingScript)
    const text = fields.map((f) => Utils.toUTF8(f))

    // helpers
    const findTopic = () => text.find(t => /^tm_/.test(t)) ?? ''
    const findType = () => {
      const t = text.find(t => t === 'offer' || t === 'demand')
      return (t as UIOrder['type']) ?? undefined
    }
    const findCurrency = () => (text.find(t => t === 'GBP' || t === 'SATS') as 'GBP' | 'SATS') ?? 'GBP'
    const findISO = () => text.filter(t => /\d{4}-\d{2}-\d{2}T/.test(t))
    const findHexKey = () => {
      const hexish = text.filter(t => /^[0-9a-fA-F]{66,}$/.test(t))
      return hexish.sort((a, b) => b.length - a.length)[0] ?? ''
    }
    const findNums = () =>
      text.map((t) => Number(t)).filter((n) => Number.isFinite(n)) as number[]

    // Attempt "strict" layout
    let type = text[0] as UIOrder['type']
    let topic = text[1]
    let quantity = Number(text[2])
    let price = Number(text[3])
    let currency = (text[4] as 'GBP' | 'SATS') ?? 'GBP'
    let expiryISO = text[5]
    let createdISO = text[6]
    let parent = text[7]
    let creatorKey = text[8]

    const looksStrict =
      (type === 'offer' || type === 'demand') &&
      /^tm_/.test(topic ?? '') &&
      (currency === 'GBP' || currency === 'SATS') &&
      /\d{4}-\d{2}-\d{2}T/.test(expiryISO ?? '')

    if (!looksStrict) {
      // Fallback to loose detection for older txs
      type = findType() ?? 'offer'
      topic = findTopic()
      currency = findCurrency()

      const isos = findISO()
      expiryISO = isos[0] ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      createdISO = isos[1] ?? new Date().toISOString()

      creatorKey = findHexKey()
      parent = text.find(t => t === 'null' || /^[0-9a-fA-F]{64}$/.test(t)) ?? 'null'

      const nums = findNums()
      quantity = Number.isFinite(nums[0]) ? nums[0] : 0
      price = Number.isFinite(nums[1]) ? nums[1] : 0
    }

    if (!(type === 'offer' || type === 'demand')) return null

    return {
      txid: tx.id('hex'),
      type,
      quantity: Number.isFinite(quantity) ? quantity : 0,
      price: Number.isFinite(price) ? price : 0,
      currency,
      expiryISO,
      overlayLabel: topicToOverlayLabel(topic),
      topic,
      createdISO,
      creatorKey,
      parent: parent === 'null' ? null : parent
    }
  } catch {
    return null
  }
}

export default function OrdersTab() {
  const [orders, setOrders] = useState<UIOrder[]>([])
  const [selected, setSelected] = useState<UIOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastCount, setLastCount] = useState(0)

  async function loadFromOverlay() {
    try {
      setLoading(true)
      const res = await fetch(`${OVERLAY_API}/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'ls_cathays', query: { limit: 25 } })
      })
      const body = await res.json()
      const list = Array.isArray(body?.outputs) ? body.outputs : []

      const decoded: UIOrder[] = list
        .map((o: any) => decodeOrderFromBEEF({ beef: o.beef, outputIndex: o.outputIndex ?? 0 }))
        .filter((x: UIOrder | null): x is UIOrder => Boolean(x))

      decoded.sort(
        (a, b) => (new Date(b.createdISO).getTime() || 0) - (new Date(a.createdISO).getTime() || 0)
      )

      setOrders(decoded)
      setLastCount(decoded.length)
    } catch (e) {
      console.error('[OrdersTab] lookup failed', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFromOverlay()
  }, [])

  const handleCreateOrder = async (data: CreateFormData) => {
    try {
      // 🔧 Be lenient about the return shape of createTx
      // Your current createTx expects 2 args; pass a benign second arg.
      const built: any = await createTx(data as any, '' as any)
      const unsigned: Transaction = (built?.unsigned ?? built) as Transaction

      // Broadcast with your existing submitter
      const { txid } = await submitTx(unsigned as any)

      // Optimistic UI using whatever the form supplies
      const expiryISO =
        (data as any).expiryISO ??
        (data as any).expiry ??
        (data as any).expiryDate ??
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const overlayLabel =
        (data as any).overlayLabel ?? (data as any).overlay ?? topicToOverlayLabel('tm_cathays')

      const optimistic: UIOrder = {
        txid,
        type: (data as any).type ?? 'offer',
        quantity: Number((data as any).quantity ?? 0),
        price: Number((data as any).price ?? 0),
        currency: ((data as any).currency ?? 'GBP') as 'GBP' | 'SATS',
        expiryISO,
        overlayLabel,
        topic: 'tm_cathays',
        createdISO: new Date().toISOString(),
        creatorKey: '',
        parent: null
      }

      setOrders(prev => [optimistic, ...prev])

      // Replace with canonical from overlay
      await loadFromOverlay()
    } catch (e) {
      console.error('[OrdersTab] create/submit failed', e)
    }
  }

  const handleCommit = (o: UIOrder) => {
    console.log('Commit to order:', o)
    setSelected(null)
  }

  return (
    <div style={{ display: 'flex', gap: '4rem', alignItems: 'flex-start', paddingTop: '2rem' }}>
      {/* Left: form */}
      <div style={{ flex: 1 }}>
        <h2>Create Order</h2>
        <CreateOrderForm onSubmit={handleCreateOrder} />
        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
          Last: loaded {lastCount} order(s)
        </div>
      </div>

      {/* Right: list + refresh */}
      <div style={{ flex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, flex: 1 }}>Active Orders</h2>
          <button onClick={() => void loadFromOverlay()} disabled={loading} title="Reload from overlay">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <OrderList orders={orders} onSelect={setSelected} />
        </div>
      </div>

      {selected && (
        <OrderModal order={selected} onClose={() => setSelected(null)} onCommit={handleCommit} />
      )}
    </div>
  )
}
