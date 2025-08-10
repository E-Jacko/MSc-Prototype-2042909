// Tiny helpers: normalize datetime and turn a key-value object into PushDrop bytes.

import { Utils } from '@bsv/sdk'
import { FIELD_ORDER } from './types'

// Convert 'YYYY-MM-DDTHH:MM' -> 'YYYY-MM-DDTHH:MM:00Z'
// (Explicit seconds + Z keeps comparisons consistent server-side.)
export function normalizeLocalDateTime(local: string): string {
  if (!local) return ''
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local
  return withSeconds.endsWith('Z') ? withSeconds : `${withSeconds}Z`
}

// Given an object whose keys match FIELD_ORDER, produce number[][]
// using the SDK's UTF8 conversion (minimally encoded by PushDrop later).
export function toPushDropFieldsOrdered(obj: Record<string, string | number>): number[][] {
  return FIELD_ORDER.map((k) => Utils.toArray(String(obj[k]), 'utf8') as number[])
}
