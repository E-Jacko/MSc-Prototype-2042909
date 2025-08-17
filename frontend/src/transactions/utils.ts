// small helpers shared by tx builders

import { Utils, Script } from '@bsv/sdk'
import { FIELD_ORDER } from './types'

/* ------------------------------------------------------------------ */
/*  Dev meter key (used to prefill meter pubkey until cert hookup)    */
/* ------------------------------------------------------------------ */

export const DEV_METER_PUBKEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcd2dce28d959f2815b16f81798'

export async function getMeterPubKeyForActor(_actorKey: string): Promise<string> {
  return DEV_METER_PUBKEY
}

/* ------------------------------------------------------------------ */
/*  Date / encoding helpers                                           */
/* ------------------------------------------------------------------ */

// normalize 'YYYY-MM-DDTHH:MM' to include seconds + 'Z'
export function normalizeLocalDateTime(local: string): string {
  if (!local) return ''
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return withSeconds.endsWith('Z') ? withSeconds : `${withSeconds}Z`
}

// convert ISO to 'YYYY-MM-DDTHH:MM'
export function isoToLocalMinute(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

// encode fields for PushDrop in one canonical order
export function toPushDropFieldsOrdered(obj: Record<string, string | number>): number[][] {
  return (FIELD_ORDER as readonly string[]).map(k =>
    Utils.toArray(String(obj[k] ?? ''), 'utf8') as number[]
  )
}

// browser-safe sha256 → hex
export async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// stable contract "terms" hash (binds order+commit+window+meter)
export async function buildTermsHash(args: {
  orderTxid: string | null
  commitTxid: string
  topic: string
  quantityKWh: number
  price: number
  currency: 'GBP' | 'SATS'
  windowStart: string
  windowEnd: string
  meterPubKey: string
}): Promise<string> {
  const payload = {
    orderTxid: args.orderTxid ?? null,
    commitTxid: args.commitTxid,
    topic: args.topic,
    quantityKWh: Number(args.quantityKWh || 0),
    price: Number(args.price || 0),
    currency: args.currency,
    windowStart: args.windowStart,
    windowEnd: args.windowEnd,
    meterPubKey: args.meterPubKey
  }
  const canon = JSON.stringify(payload)
  return sha256Hex(canon)
}

/* ------------------------------------------------------------------ */
/*  Compact OP_RETURN “notes” that the lookup service indexes         */
/* ------------------------------------------------------------------ */

export type BaseNote = {
  kind: 'contract' | 'proof'
  parent: string        // txid we attach to (commitment for contracts, contract for proofs)
  topic: string
  sha256: string        // hash of terms/proof package
}

export type ContractNote = BaseNote & { kind: 'contract' }
export type ProofNote = BaseNote & { kind: 'proof'; boxFor: 'buyer' | 'seller' }

// Build OP_FALSE OP_RETURN <json> script for a *contract* note.
// Only the fields the indexer expects are allowed.
export function buildContractOpReturn(note: ContractNote): Script {
  const json = JSON.stringify({
    kind: 'contract',
    parent: note.parent,
    topic: note.topic,
    sha256: note.sha256
  })
  const hex = Utils.toHex(Utils.toArray(json, 'utf8'))
  return Script.fromASM(`OP_FALSE OP_RETURN ${hex}`)
}

// Build OP_FALSE OP_RETURN <json> script for a *proof* note.
// Proofs additionally record who the encrypted box is intended for.
export function buildProofOpReturn(note: ProofNote): Script {
  const json = JSON.stringify({
    kind: 'proof',
    parent: note.parent,
    topic: note.topic,
    sha256: note.sha256,
    boxFor: note.boxFor
  })
  const hex = Utils.toHex(Utils.toArray(json, 'utf8'))
  return Script.fromASM(`OP_FALSE OP_RETURN ${hex}`)
}
