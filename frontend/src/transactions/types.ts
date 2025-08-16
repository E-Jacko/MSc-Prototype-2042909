// simple, shared types and constants for ALL energy transactions
// every tx (offer, demand, commitment, contract, proof) uses the same 9 pushdrop fields

export type TxType = 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'
export type Currency = 'GBP' | 'SATS'

// ui label -> topic on-chain
export const OVERLAY_MAP: Record<string, { topic: string }> = {
  'Cardiff – Cathays': { topic: 'tm_cathays' }
}

// generic order/commitment/proof form shape
export interface TxForm {
  type: TxType
  quantity: number
  price: number
  currency: Currency
  expiryDate: string
  overlay: string
  parent?: string
}

// pushdrop field order (single source of truth)
export const FIELD_ORDER = [
  'type', 'topic', 'actor', 'parent', 'createdAt', 'expiresAt',
  'quantity', 'price', 'currency'
] as const

// ---- escrow types ----

export type FundingMode = 'dummy' | 'calculated'

export interface EscrowParams {
  buyerPubKey: string
  sellerPubKey: string
  meterPubKey: string
  quantityKWh: number
  price: number
  currency: 'SATS' | 'GBP'
  windowStart: string  // ISO
  windowEnd: string    // ISO
  timeout: string      // ISO
  termsHash: string
  amountSats: number   // 1 for demo
  topic: string
  commitmentTxid: string
  contractTxid?: string
}
