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

// returns (unsigned tx, creatorKey) for an offer/demand/commitment
export async function createTx(form: TxForm): Promise<CreateTxResult> {
  // resolve overlay topic from the selected label (defaults to cathays)
  const topic = topicForOverlay(form.overlay) ?? 'tm_cathays'

  // talk to the local wallet substrate
  const wallet = new WalletClient('auto', 'localhost')

  // capture the actor/public key to embed in the payload
  const creatorKey = await getCreatorKeyHex(wallet)

  // keep indexes 0..1 as [type, topic] to match TopicManager admission rules
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

  // encode the payload as ordered PushDrop fields and build a 1-sat output
  const pd = new PushDrop(wallet, 'localhost')
  const fields = toPushDropFieldsOrdered(payload)
  const lockingScript = await pd.lock(
    fields,            // ordered pushdata list
    PROTOCOL_ID,       // protocol tag used by the wallet
    'default',         // key id
    'self',            // counterparty
    false,             // not "forSelf" (use P2PK before PushDrop)
    true,              // include signature
    'before'           // P2PK placed before PushDrop data
  )

  // construct the unsigned transaction and attach a tiny output
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })

  // tag helpful metadata so submit can find the topic without decoding
  tx.updateMetadata({ topic, type: form.type })

  // hand back the unsigned tx; the wallet will fund/sign in submitTx
  return { unsigned: tx, creatorKey }
}
