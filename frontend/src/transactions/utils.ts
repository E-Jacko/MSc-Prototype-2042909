// small helpers used by tx builders

import { Utils } from '@bsv/sdk'
import { FIELD_ORDER } from './types'

// normalize 'YYYY-MM-DDTHH:MM' to include seconds + z
export function normalizeLocalDateTime(local: string): string {
  if (!local) return ''
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return withSeconds.endsWith('Z') ? withSeconds : `${withSeconds}Z`
}

// convert iso like '2025-08-12T10:15:30.000Z' to 'YYYY-MM-DDTHH:MM' for createTx
export function isoToLocalMinute(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  // note: we use utc slice which is fine because normalizeLocalDateTime appends z
  return d.toISOString().slice(0, 16)
}

// build pushdrop fields in the exact FIELD_ORDER
export function toPushDropFieldsOrdered(obj: Record<string, string | number>): number[][] {
  return (FIELD_ORDER as readonly string[]).map((k) => Utils.toArray(String(obj[k]), 'utf8') as number[])
}
