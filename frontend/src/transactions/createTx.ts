// Generic transaction creator (concise).
// - Converts UI label -> topic
// - Adds actor, createdAt, expiresAt, and default parent='null' if empty
// - Encodes ALL fields in the single shared order
// - Builds a PushDrop locking script using protocolID [0, 'energy']
// - Returns an unsigned tx with one PushDrop output (1 sat)

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { OVERLAY_MAP } from './types'
import type { TxForm } from './types' // type-only import because verbatimModuleSyntax is on
import { normalizeLocalDateTime, toPushDropFieldsOrdered } from './utils'

// Protocol tuple is required by the SDK: [SecurityLevel, protocolString]
const PROTOCOL_ID: [0, string] = [0, 'energy'] // simple namespace tag

export async function createTx(form: TxForm, actorIdentityKey: string): Promise<Transaction> {
  // Resolve topic from UI label
  const topic = OVERLAY_MAP[form.overlay]?.topic
  if (!topic) throw new Error(`Unknown overlay: ${form.overlay}`)

  // Bring all fields into a single, uniform object keyed by FIELD_ORDER
  const payload: Record<string, string | number> = {
    type: form.type,                 // 'offer' | 'demand' | 'commitment' | 'contract' | 'proof'
    topic,                           // embed topic (not the human label)
    actor: actorIdentityKey,         // identity public key (hex)
    parent: form.parent ?? 'null',   // orders default to 'null'
    createdAt: new Date().toISOString(),
    expiresAt: normalizeLocalDateTime(form.expiryDate),
    quantity: form.quantity,
    price: form.price,
    currency: form.currency
  }

  // Build PushDrop locking script (also appends a signature as the last field)
  const wallet = new WalletClient('auto', 'localhost')
  const pushdrop = new PushDrop(wallet, 'localhost')
  const pdFields = toPushDropFieldsOrdered(payload)
  const lockingScript = await pushdrop.lock(
    pdFields,
    PROTOCOL_ID,
    'default',   // keyID
    'self',      // counterparty
    false,       // forSelf
    true,        // include signature
    'before'     // lock (pubkey+CHECKSIG) before data
  )

  // Assemble a bare unsigned tx; fee, inputs & change will be handled later.
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })
  // keep topic & type in metadata so submitTx can route without decoding
  tx.updateMetadata({ topic, type: form.type })
  return tx
}
