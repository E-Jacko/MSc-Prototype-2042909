// small helpers shared by tx builders

import { Utils, OP, LockingScript } from '@bsv/sdk'
import { FIELD_ORDER } from './types'

// --- dev meter key ----------------------------------------------------------
// note: this is a temporary key used to prefill the "meter public key" field.
// when you wire certificates, replace the function below to fetch from a cert.
export const DEV_METER_PUBKEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcd2dce28d959f2815b16f81798'

// expose a single place the UI calls to prefill the meter key
export async function getMeterPubKeyForActor(_actorKey: string): Promise<string> {
  // in future: look up actor's certificate -> extract meter pubkey
  return DEV_METER_PUBKEY
}

// --- date / encoding helpers ------------------------------------------------

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

// --- OP_RETURN helper -------------------------------------------------------
// Build a single-chunk OP_RETURN that contains a UTF-8 JSON note.
export function buildOpReturnJson(note: Record<string, unknown>): LockingScript {
  const json = JSON.stringify(note)
  const bytes = Utils.toArray(json, 'utf8') as number[]
  // one chunk: OP_RETURN + unformatted data (SDK will write raw after OP_RETURN)
  return new LockingScript([{ op: OP.OP_RETURN, data: bytes }])
}
