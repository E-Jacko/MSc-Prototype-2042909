// generic transaction creator for all energy messages
// gets signer pubkey from mnd via walletclient and embeds it as actor
// returns { unsigned, creatorKey }

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { OVERLAY_MAP, FIELD_ORDER, type TxForm } from './types'
import { normalizeLocalDateTime, toPushDropFieldsOrdered } from './utils'

// simple namespace tag for pushdrop
const PROTOCOL_ID: [0, string] = [0, 'energy']

export type CreateTxResult = {
  unsigned: Transaction
  creatorKey: string
}

// try a few api shapes to get the pubkey hex
async function getCreatorKeyHex(wallet: any): Promise<string> {
  // preferred: keyID alias on modern sdk/mnd
  try {
    const r = await wallet.getPublicKey?.({ keyID: 'default', counterparty: 'self', forSelf: true })
    if (r?.publicKey) return String(r.publicKey)
  } catch {}
  // alt: identityKey alias as string (some mnd notes use this)
  try {
    const r = await wallet.getPublicKey?.({ identityKey: 'default' })
    if (r?.publicKey) return String(r.publicKey)
  } catch {}
  // alt: exportPublicKey variant on older builds
  try {
    const r = await wallet.exportPublicKey?.({ keyId: 'default' })
    if (r?.hex) return String(r.hex)
  } catch {}
  return ''
}

export async function createTx(form: TxForm): Promise<CreateTxResult> {
  // resolve overlay label -> topic
  const topic = OVERLAY_MAP[form.overlay]?.topic
  if (!topic) throw new Error(`unknown overlay: ${form.overlay}`)

  // talk to mnd via walletclient
  const wallet = new WalletClient('auto', 'localhost')
  const creatorKey = await getCreatorKeyHex(wallet)

  // shape payload in our shared field order
  const payload: Record<(typeof FIELD_ORDER)[number], string | number> = {
    type: form.type,
    topic,
    actor: creatorKey,
    parent: form.parent ?? 'null',
    createdAt: new Date().toISOString(),
    expiresAt: normalizeLocalDateTime(form.expiryDate),
    quantity: form.quantity,
    price: form.price,
    currency: form.currency
  }

  // build pushdrop locking script (includes signature)
  const pd = new PushDrop(wallet, 'localhost')
  const fields = toPushDropFieldsOrdered(payload)
  const lockingScript = await pd.lock(
    fields,
    PROTOCOL_ID,
    'default',   // key alias in mnd
    'self',
    false,
    true,
    'before'
  )

  // make unsigned tx with a single 1-sat output
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })
  tx.updateMetadata({ topic, type: form.type })

  return { unsigned: tx, creatorKey }
}
