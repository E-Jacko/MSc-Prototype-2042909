export type OverlayLabel =
  | 'Cardiff – Cathays'
  | string

export function topicForOverlay(label?: OverlayLabel | null): string | null {
  if (!label) return null
  if (label === 'Cardiff – Cathays') return 'tm_cathays'
  return null
}

export type TxForm = {
  type: 'offer' | 'demand' | 'commitment'
  overlay: OverlayLabel
  parent?: string | null
  expiryDate: string
  quantity: number
  price: number
  currency: 'GBP' | 'SATS'
}

// the canonical field order for our pushdrop payloads
export const FIELD_ORDER = [
  'type',       // index 0
  'topic',      // index 1
  'actor',
  'parent',
  'createdAt',
  'expiresAt',
  'quantity',
  'price',
  'currency'
] as const
