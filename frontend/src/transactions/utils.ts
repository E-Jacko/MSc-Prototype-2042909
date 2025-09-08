// utility helpers for encoding, hashing, and simple data transforms

import { Utils, OP, LockingScript } from '@bsv/sdk'
import { FIELD_ORDER } from './types'

// dev meter key used to prefill the meter public key field for demos
export const DEV_METER_PUBKEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcd2dce28d959f2815b16f81798'

// single place the ui calls to prefill the meter key
export async function getMeterPubKeyForActor(_actorKey: string): Promise<string> {
  // in future: look up actor certificate and extract meter key
  return DEV_METER_PUBKEY
}

// normalize 'YYYY-MM-DDTHH:MM' to include seconds and 'Z'
export function normalizeLocalDateTime(local: string): string {
  if (!local) return ''
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return withSeconds.endsWith('Z') ? withSeconds : `${withSeconds}Z`
}

// convert iso to 'YYYY-MM-DDTHH:MM'
export function isoToLocalMinute(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

// encode fields for pushdrop in the canonical order for the first 9 keys
// proof appends extras itself; other tx types use only these
export function toPushDropFieldsOrdered(obj: Record<string, string | number>): number[][] {
  return (FIELD_ORDER as readonly string[]).map(k =>
    Utils.toArray(String(obj[k] ?? ''), 'utf8') as number[]
  )
}

// browser-safe sha256 to hex
export async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s)
  const buf = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// stable contract terms hash that binds order, commit, window, and meter
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

// simple op_return helper if needed by callers
export function buildOpReturnJson(note: Record<string, unknown>): LockingScript {
  const json = JSON.stringify(note)
  const bytes = Utils.toArray(json, 'utf8') as number[]
  return new LockingScript([{ op: OP.OP_RETURN, data: bytes }])
}
