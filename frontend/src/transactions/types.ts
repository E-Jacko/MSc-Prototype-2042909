// Simple, shared types and constants for ALL energy transactions.
// Every tx (offer, demand, commitment, contract, proof) uses the SAME fields:
// [type, topic, actor, parent, createdAt, expiresAt, quantity, price, currency]

export type TxType = 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'
export type Currency = 'GBP' | 'SATS'

// UI label -> topic on-chain.
// Add more overlays here; UI can keep showing labels.
export const OVERLAY_MAP: Record<string, { topic: string }> = {
  'Cardiff – Cathays': { topic: 'tm_cathays' }
}

// One form interface for now (Orders tab uses it already).
// When you later add Commitment/Contract/Proof forms, reuse these same fields;
// 'parent' will be the previous txid in the DAG (orders can omit it).
export interface TxForm {
  // 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'
  type: TxType
  // kWh and price apply to all for now (you can refine later if you want)
  quantity: number
  price: number
  currency: Currency
  // 'YYYY-MM-DDTHH:MM' from <input type="datetime-local">
  expiryDate: string
  // UI label; we convert it to a topic before encoding
  overlay: string
  // parent txid (orders can omit; we'll default to 'null')
  parent?: string
}

// PushDrop field order (shared by ALL types). Keep this as the single source of truth.
// We'll encode values in THIS exact order into number[][] for PushDrop.lock().
export const FIELD_ORDER = [
  'type', 'topic', 'actor', 'parent', 'createdAt', 'expiresAt',
  'quantity', 'price', 'currency'
] as const
