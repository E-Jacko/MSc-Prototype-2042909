// generic transaction creator for 'offer' / 'demand' / 'commitment'
// -> builds a 1-sat PushDrop output and tags tx metadata with { topic, type }

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { FIELD_ORDER, type TxForm, topicForOverlay } from './types'
import { normalizeLocalDateTime, toPushDropFieldsOrdered } from './utils'

const PROTOCOL_ID: [0, string] = [0, 'energy']

export type CreateTxResult = {
  unsigned: Transaction
  creatorKey: string
}

async function getCreatorKeyHex(wallet: any): Promise<string> {
  try {
    const r = await wallet.getPublicKey?.({
      keyID: 'default',
      counterparty: 'self',
      forSelf: true
    })
    if (r?.publicKey) return String(r.publicKey)
  } catch {}
  try {
    const r = await wallet.getPublicKey?.({ identityKey: 'default' })
    if (r?.publicKey) return String(r.publicKey)
  } catch {}
  try {
    const r = await wallet.exportPublicKey?.({ keyId: 'default' })
    if (r?.hex) return String(r.hex)
  } catch {}
  return ''
}

export async function createTx(form: TxForm): Promise<CreateTxResult> {
  const topic = topicForOverlay(form.overlay) ?? 'tm_cathays'
  const wallet = new WalletClient('auto', 'localhost')
  const creatorKey = await getCreatorKeyHex(wallet)

  // IMPORTANT: keep 'type' then 'topic' first to match TopicManager expectations
  const payload: Record<(typeof FIELD_ORDER)[number], string | number> = {
    type: form.type,                  // [0]
    topic,                            // [1]
    actor: creatorKey,
    parent: form.parent ?? 'null',
    createdAt: new Date().toISOString(),
    expiresAt: normalizeLocalDateTime(form.expiryDate),
    quantity: form.quantity,
    price: form.price,
    currency: form.currency
  }

  const pd = new PushDrop(wallet, 'localhost')
  const fields = toPushDropFieldsOrdered(payload)
  const lockingScript = await pd.lock(
    fields,
    PROTOCOL_ID,
    'default',
    'self',
    false,         // lock forSelf
    true,          // includeSignature
    'before'       // P2PK before pushdrop
  )

  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })
  tx.updateMetadata({ topic, type: form.type })

  return { unsigned: tx, creatorKey }
}
