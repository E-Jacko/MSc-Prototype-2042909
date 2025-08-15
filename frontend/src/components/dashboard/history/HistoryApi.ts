// frontend/src/components/dashboard/history/HistoryApi.ts
// fetch + shape helpers for the history tab
// change: expand each head (order/commitment) into its full flow via custom lookups

import { Transaction, PushDrop, Utils } from '@bsv/sdk'

export type TxKind = 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'

export type TxDoc = {
  txid: string
  kind: TxKind
  topic: string
  actorKey: string
  createdISO: string
  expiryISO?: string
  quantity?: number
  price?: number
  currency?: 'GBP' | 'SATS'
  parentTxid?: string | null
  flowId: string
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

const isKind = (s: unknown): s is TxKind =>
  typeof s === 'string' &&
  (s === 'offer' || s === 'demand' || s === 'commitment' || s === 'contract' || s === 'proof')

function buildDoc(text: string[], txid: string): TxDoc | null {
  const kindRaw = text[0]
  if (!isKind(kindRaw)) return null

  const topic = text[1] || ''
  const actorKey = text[2] || ''
  const parent = text[3] && text[3] !== 'null' ? text[3] : null
  const createdISO = text[4] || new Date().toISOString()
  const expiryISO = text[5] || undefined
  const quantity = asNum(text[6])
  const price = asNum(text[7])
  const currency =
    (text[8] === 'SATS' ? 'SATS' : text[8] === 'GBP' ? 'GBP' : undefined) as
      | 'GBP' | 'SATS' | undefined

  const kind = kindRaw
  const flowId = (kind === 'offer' || kind === 'demand') ? txid : (parent ?? txid)

  return { txid, kind, topic, actorKey, createdISO, expiryISO, quantity, price, currency, parentTxid: parent, flowId }
}

function decodeDoc(row: LookupOutput): TxDoc | null {
  try {
    const tx = Transaction.fromBEEF(row.beef)
    const txid = tx.id('hex')

    const tryAt = (i: number): TxDoc | null => {
      try {
        const out = tx.outputs[i]
        if (!out) return null
        const text = PushDrop.decode(out.lockingScript).fields.map(Utils.toUTF8)
        return buildDoc(text, txid)
      } catch {
        return null
      }
    }

    // prefer the provided outputIndex
    if (row.outputIndex != null) {
      const d = tryAt(row.outputIndex)
      if (d) return d
    }

    // try output 0, then scan the rest (commitments are often at vout 1)
    const d0 = tryAt(0)
    if (d0) return d0

    for (let i = 1; i < tx.outputs.length; i++) {
      const d = tryAt(i)
      if (d) return d
    }

    return null
  } catch {
    return null
  }
}

// -- small helpers to call the custom lookup endpoints ---------------------

async function postLookup(apiBase: string, query: any) {
  const res = await fetch(`${apiBase}/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service: 'ls_cathays', query })
  })
  if (!res.ok) throw new Error(`lookup failed: ${res.status}`)
  return res.json()
}

async function expandByOrder(apiBase: string, txid: string): Promise<FlowRow> {
  const body = await postLookup(apiBase, { kind: 'flow-by-order', txid })
  const outs: LookupOutput[] = Array.isArray(body?.outputs) ? body.outputs : []
  const docs = outs.map(decodeDoc).filter(Boolean) as TxDoc[]

  const row: FlowRow = { latestISO: '1970-01-01T00:00:00.000Z' }
  for (const d of docs) {
    if (d.kind === 'offer' || d.kind === 'demand') row.order = d
    else if (d.kind === 'commitment') row.commitment = d
    else if (d.kind === 'contract') row.contract = d
    else if (d.kind === 'proof') row.proof = d
    if (new Date(d.createdISO) > new Date(row.latestISO)) row.latestISO = d.createdISO
  }
  return row
}

async function expandByCommitment(apiBase: string, txid: string): Promise<FlowRow> {
  const body = await postLookup(apiBase, { kind: 'flow-by-commitment', txid })
  const outs: LookupOutput[] = Array.isArray(body?.outputs) ? body.outputs : []
  const docs = outs.map(decodeDoc).filter(Boolean) as TxDoc[]

  const row: FlowRow = { latestISO: '1970-01-01T00:00:00.000Z' }
  for (const d of docs) {
    if (d.kind === 'offer' || d.kind === 'demand') row.order = d
    else if (d.kind === 'commitment') row.commitment = d
    else if (d.kind === 'contract') row.contract = d
    else if (d.kind === 'proof') row.proof = d
    if (new Date(d.createdISO) > new Date(row.latestISO)) row.latestISO = d.createdISO
  }
  return row
}

// -- main export -----------------------------------------------------------

export async function fetchFlows(params: {
  apiBase: string
  mode: 'all' | 'my-orders' | 'my-commitments'
  limit?: number
  actorKey?: string | null
  sort?: 'recent' | 'oldest'
}): Promise<FlowRow[]> {
  const { apiBase, mode, actorKey, limit = 50, sort = 'recent' } = params

  // step 1: fetch recent heads (orders + sometimes commitments)
  const recent = await postLookup(apiBase, { kind: 'recent', limit })
  const recentOuts: LookupOutput[] = Array.isArray(recent?.outputs) ? recent.outputs : []
  const heads = recentOuts.map(decodeDoc).filter(Boolean) as TxDoc[]

  // step 2: expand each head into a full flow using the *flow-by-* queries
  const flowMap = new Map<string, FlowRow>() // de-dup by flowId
  for (const h of heads) {
    const expanded =
      (h.kind === 'offer' || h.kind === 'demand')
        ? await expandByOrder(apiBase, h.txid)
        : (h.kind === 'commitment')
          ? await expandByCommitment(apiBase, h.txid)
          : { latestISO: h.createdISO } as FlowRow

    // pick a stable flow key: order txid if present, else commitment parent/txid
    const key =
      expanded.order?.txid ??
      expanded.commitment?.flowId ??
      h.flowId

    const prev = flowMap.get(key)
    if (!prev) flowMap.set(key, expanded)
    else {
      // keep the most complete + newest
      const newer = new Date(expanded.latestISO) > new Date(prev.latestISO) ? expanded : prev
      flowMap.set(key, newer)
    }
  }

  let rows = Array.from(flowMap.values())

  // step 3: apply filter
  if (mode === 'my-orders' && actorKey) {
    rows = rows.filter(r => r.order && r.order.actorKey === actorKey)
  } else if (mode === 'my-commitments' && actorKey) {
    rows = rows.filter(r => r.commitment && r.commitment.actorKey === actorKey)
  }

  // step 4: sort
  rows.sort((a, b) =>
    sort === 'recent'
      ? new Date(b.latestISO).getTime() - new Date(a.latestISO).getTime()
      : new Date(a.latestISO).getTime() - new Date(b.latestISO).getTime()
  )

  return rows
}
