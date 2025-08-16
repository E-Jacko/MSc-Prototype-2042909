// small helpers used by tx builders + dev shims for the prototype

import { Utils } from '@bsv/sdk'
import { FIELD_ORDER } from './types'

// normalize 'YYYY-MM-DDTHH:MM' to include seconds + z
export function normalizeLocalDateTime(local: string): string {
  if (!local) return ''
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return withSeconds.endsWith('Z') ? withSeconds : `${withSeconds}Z`
}

// convert iso like '2025-08-12T10:15:30.000Z' to 'YYYY-MM-DDTHH:MM'
export function isoToLocalMinute(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 16)
}

// build pushdrop fields in the exact FIELD_ORDER
export function toPushDropFieldsOrdered(obj: Record<string, string | number>): number[][] {
  return (FIELD_ORDER as readonly string[]).map((k) =>
    Utils.toArray(String(obj[k]), 'utf8') as number[]
  )
}

/* ---------- meter key stubs for dev ---------- */

const DEFAULT_DEV_METER_PUBKEY =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798'

export const DEV_METER_PUBKEY: string =
  ((import.meta as any)?.env?.VITE_DEV_METER_PUBKEY as string) || DEFAULT_DEV_METER_PUBKEY

// in future: look up from certificates by actor; for now return a dev key
export function getMeterPubKeyForActor(_actorKey?: string): string {
  return DEV_METER_PUBKEY
}

// in future: real ECDSA over payload with meter key; for now return empty stub
export async function signMeterPayload(
  _payload: Uint8Array | string
): Promise<{ sigHex: string; pubKeyHex: string }> {
  return { sigHex: '', pubKeyHex: getMeterPubKeyForActor() }
}

/* ---------- stable “terms hash” helper ---------- */
// stringifies a fixed object, hashes with SHA-256, and returns hex
export async function buildTermsHash(input: {
  orderTxid?: string | null
  commitTxid: string
  topic: string
  quantityKWh: number
  price: number
  currency: 'GBP' | 'SATS'
  windowStart: string
  windowEnd: string
  meterPubKey: string
}): Promise<string> {
  const obj = {
    orderTxid: input.orderTxid ?? null,
    commitTxid: input.commitTxid,
    topic: input.topic,
    quantityKWh: input.quantityKWh,
    price: input.price,
    currency: input.currency,
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    meterPubKey: input.meterPubKey
  }
  const text = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
