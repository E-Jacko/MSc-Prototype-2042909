// frontend/src/transactions/createUnlockTx.ts
// Proof tx builder:
//  - vout0: PushDrop (type/topic/parent/sha256/actor/boxFor if desired)
//  - vout1: OP_RETURN { cipher, sha256 }

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { submitTx } from './submitTx'
import { toPushDropFieldsOrdered, buildOpReturnJson } from './utils'

// PushDrop protocol tag
const PROTOCOL_ID: [0, string] = [0, 'energy']

export type ProofEncrypted = {
  ciphertext: string
  sha256: string
  boxFor: 'buyer' | 'seller' | 'both'
}

/**
 * Build (unsigned) proof transaction.
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

  // vout0: PushDrop metadata (overlay indexes this)
  const pdFields = toPushDropFieldsOrdered({
    type: 'proof',
    topic: meta.topic,
    actor: meta.sellerKey,          // for now we tag the seller as the actor
    parent: source.txid,
    // minimal fields for proof:
    sha256: encrypted.sha256
    // keep these out of PushDrop unless you really need them:
    // createdAt: new Date().toISOString(),
    // expiresAt: '',
    // quantity: meta.quantity,
    // price: meta.price,
    // currency: meta.currency,
  })
  const pdScript = await pd.lock(
    pdFields,
    PROTOCOL_ID,
    'default',    // MND key alias
    'self',
    false,
    true,
    'before'
  )

  // vout1: OP_RETURN sidecar with *only* ciphertext + sha256
  const opret = buildOpReturnJson({
    cipher: encrypted.ciphertext,
    sha256: encrypted.sha256
  })

  // assemble unsigned tx
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript: pdScript }) // vout0
  tx.addOutput({ satoshis: 0, lockingScript: opret })    // vout1
  tx.updateMetadata({ topic: meta.topic, type: 'proof' })

  return tx
}

/**
 * Convenience wrapper used by some call-sites:
 * builds -> funds+signs -> submits via overlay.
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
