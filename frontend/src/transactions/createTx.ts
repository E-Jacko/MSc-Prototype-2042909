// generic transaction creator for offer, demand, and commitment
// builds a 1 sat pushdrop output and tags tx metadata with { topic, type }

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { FIELD_ORDER, type TxForm, topicForOverlay } from './types'
import { normalizeLocalDateTime, toPushDropFieldsOrdered } from './utils'

const PROTOCOL_ID: [0, string] = [0, 'energy']

export type CreateTxResult = {
  unsigned: Transaction
  creatorKey: string
}

// fetch the actor key in a best effort way across wallet interfaces
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
  // resolve overlay topic from the selected label
  const topic = topicForOverlay(form.overlay) ?? 'tm_cathays'

  // connect to the local wallet
  const wallet = new WalletClient('auto', 'localhost')

  // capture the actor key to embed in the payload
  const creatorKey = await getCreatorKeyHex(wallet)

  // keep indexes 0 and 1 as [type, topic] to match topic manager rules
  const payload: Record<(typeof FIELD_ORDER)[number], string | number> = {
    type: form.type,                        // [0]
    topic,                                  // [1]
    actor: creatorKey,
    parent: form.parent ?? 'null',
    createdAt: new Date().toISOString(),
    expiresAt: normalizeLocalDateTime(form.expiryDate),
    quantity: form.quantity,
    price: form.price,
    currency: form.currency
  }

  // encode the payload as ordered pushdrop fields and build a 1 sat output
  const pd = new PushDrop(wallet, 'localhost')
  const fields = toPushDropFieldsOrdered(payload)
  const lockingScript = await pd.lock(
    fields,            // ordered pushdata list
    PROTOCOL_ID,       // protocol tag used by the wallet
    'default',         // key id
    'self',            // counterparty
    false,             // not for self
    true,              // include signature
    'before'           // p2pk comes before pushdrop data
  )

  // construct the unsigned transaction and attach a tiny output
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })

  // tag metadata so submit can find the topic without decoding
  tx.updateMetadata({ topic, type: form.type })

  // return the unsigned tx and the creator key
  return { unsigned: tx, creatorKey }
}
