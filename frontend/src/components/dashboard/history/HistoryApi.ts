// frontend/src/components/dashboard/history/HistoryApi.ts
// fetch + shape helpers for the history tab (single POST, client-side grouping)

import { Transaction, PushDrop, Utils } from '@bsv/sdk'

export type TxKind = 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'

export type TxDoc = {
  txid: string
  kind: TxKind
  topic: string                    // <— added so UI can show overlay/topic
  actorKey: string
  createdISO: string
  expiryISO?: string
  quantity?: number
  price?: number
  currency?: 'GBP' | 'SATS'
  parentTxid?: string | null
  flowId: string                   // order txid for the whole flow
}

export type FlowRow = {
  order?: TxDoc
  commitment?: TxDoc
  contract?: TxDoc
  proof?: TxDoc
  latestISO: string
}

type LookupOutput = { beef: number[]; outputIndex?: number }

const asNum = (v: unknown) => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}
const asKind = (s: string): TxKind =>
  (['offer','demand','commitment','contract','proof'] as const).includes(s as any)
    ? (s as TxKind) : 'offer'

function decodeDoc(row: LookupOutput): TxDoc | null {
  try {
    const tx = Transaction.fromBEEF(row.beef)
    const oi = row.outputIndex ?? 0
    const out = tx.outputs[oi]
    const text = PushDrop.decode(out.lockingScript).fields.map(Utils.toUTF8)

    const kind = asKind(text[0] || 'offer')
    const topic = text[1] || ''
    const actorKey = text[2] || ''
    const parent = text[3] && text[3] !== 'null' ? text[3] : null
    const createdISO = text[4] || new Date().toISOString()
    const expiryISO = text[5] || undefined
    const quantity = asNum(text[6])
    const price = asNum(text[7])
    const currency = (text[8] === 'SATS' ? 'SATS' : text[8] === 'GBP' ? 'GBP' : undefined) as
      | 'GBP' | 'SATS' | undefined

    const txid = tx.id('hex')
    const flowId = (kind === 'offer' || kind === 'demand') ? txid : (parent ?? txid)

    return { txid, kind, topic, actorKey, createdISO, expiryISO, quantity, price, currency, parentTxid: parent, flowId }
  } catch {
    return null
  }
}

export async function fetchFlows(params: {
  apiBase: string
  mode: 'all' | 'my-orders' | 'my-commitments'
  limit?: number
  actorKey?: string | null
  sort?: 'recent' | 'oldest'
}): Promise<FlowRow[]> {
  const { apiBase, mode, actorKey, limit = 50, sort = 'recent' } = params

  const res = await fetch(`${apiBase}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'ls_cathays', query: { kind: 'recent', limit } })
  }).then(r => r.json())

  const list: LookupOutput[] = Array.isArray(res?.outputs) ? res.outputs : []

  const byFlow = new Map<string, FlowRow>()
  for (const o of list) {
    const doc = decodeDoc(o)
    if (!doc) continue

    const row = byFlow.get(doc.flowId) ?? { latestISO: doc.createdISO }
    row.latestISO = new Date(doc.createdISO) > new Date(row.latestISO) ? doc.createdISO : row.latestISO

    if (doc.kind === 'offer' || doc.kind === 'demand') row.order = doc
    else if (doc.kind === 'commitment') row.commitment = doc
    else if (doc.kind === 'contract') row.contract = doc
    else if (doc.kind === 'proof') row.proof = doc

    byFlow.set(doc.flowId, row)
  }

  let rows = Array.from(byFlow.values())

  if (mode === 'my-orders' && actorKey) {
    rows = rows.filter(r => r.order && r.order.actorKey === actorKey)
  } else if (mode === 'my-commitments' && actorKey) {
    rows = rows.filter(r => r.commitment && r.commitment.actorKey === actorKey)
  }

  rows.sort((a, b) =>
    sort === 'recent'
      ? new Date(b.latestISO).getTime() - new Date(a.latestISO).getTime()
      : new Date(a.latestISO).getTime() - new Date(b.latestISO).getTime()
  )

  return rows
}
