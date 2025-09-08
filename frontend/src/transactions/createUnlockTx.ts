// proof transaction builder with one pushdrop output
// fields order (first 9 unchanged):
// [0] type, [1] topic, [2] actor, [3] parent,
// [4] createdAt, [5] expiresAt, [6] quantity, [7] price, [8] currency
// then append extras:
// [9] sha256, [10] cipher, [11] meterKey

import { WalletClient, Transaction, PushDrop, Utils } from '@bsv/sdk'
import { submitTx } from './submitTx'
import { toPushDropFieldsOrdered, DEV_METER_PUBKEY } from './utils'

// pushdrop protocol tag
const PROTOCOL_ID: [0, string] = [0, 'energy']

export type ProofEncrypted = {
  ciphertext: string
  sha256: string
  boxFor: 'buyer' | 'seller' | 'both' // kept for future use; not serialized
}

/**
 * build an unsigned proof transaction with a single pushdrop output
 */
export async function createUnlockTx(
  source: { txid: string; vout: number },
  meta: {
    sellerKey: string
    buyerKey: string
    topic: string
    quantity: number
    price: number
    currency: 'GBP' | 'SATS'
  },
  _meterPrivKey: string,
  encrypted: ProofEncrypted
): Promise<Transaction> {
  const wallet = new WalletClient('auto', 'localhost')
  const pd = new PushDrop(wallet, 'localhost')

  // timestamps: created now and expiry plus 60 minutes
  const createdISO = new Date().toISOString()
  const expiresISO = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  // base 9 fields that other tx types expect
  const baseFields = toPushDropFieldsOrdered({
    type: 'proof',
    topic: meta.topic,
    actor: meta.sellerKey,     // tag seller as actor
    parent: source.txid,       // link back to contract tx
    createdAt: createdISO,
    expiresAt: expiresISO,
    quantity: meta.quantity,
    price: meta.price,
    currency: meta.currency
  })

  // append extras in a stable order: sha256, cipher, and meterKey
  const extraFields: number[][] = [
    Utils.toArray(encrypted.sha256, 'utf8') as number[],
    Utils.toArray(encrypted.ciphertext, 'utf8') as number[],
    Utils.toArray(DEV_METER_PUBKEY, 'utf8') as number[]
  ]

  const allFields = baseFields.concat(extraFields)

  // one pushdrop output only
  const lockingScript = await pd.lock(
    allFields,
    PROTOCOL_ID,
    'default',
    'self',
    false,   // not for self
    true,    // include signature
    'before' // p2pk before pushdrop
  )

  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })      // vout0 is the proof pushdrop
  tx.updateMetadata({ topic: meta.topic, type: 'proof' })

  return tx
}

/**
 * convenience wrapper to build, have the wallet fund and sign, then submit
 */
export async function buildAndSubmitProof(
  source: { txid: string; vout: number },
  meta: {
    sellerKey: string
    buyerKey: string
    topic: string
    quantity: number
    price: number
    currency: 'GBP' | 'SATS'
  },
  meterPrivKey: string,
  encrypted: ProofEncrypted
): Promise<{ txid: string }> {
  const unsigned = await createUnlockTx(source, meta, meterPrivKey, encrypted)
  const { txid } = await submitTx(unsigned)
  return { txid }
}
