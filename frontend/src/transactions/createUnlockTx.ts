import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { toPushDropFieldsOrdered, buildOpReturnJson } from './utils'

// PushDrop protocol tag
const PROTOCOL_ID: [0, string] = [0, 'energy']

export type ProofEncrypted = {
  ciphertext: string
  sha256: string
  boxFor: 'buyer' | 'seller' | 'both'
}

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

  // 1) PushDrop metadata (overlay indexes this)
  const pdFields = toPushDropFieldsOrdered({
    type: 'proof',
    topic: meta.topic,
    actor: meta.sellerKey,          // or meter identity when wired
    parent: source.txid,
    createdAt: new Date().toISOString(),
    expiresAt: '',
    quantity: meta.quantity,
    price: meta.price,
    currency: meta.currency,
    sha256: encrypted.sha256
  })
  const pdScript = await pd.lock(pdFields, PROTOCOL_ID, 'default', 'self', false, true, 'before')

  // 2) OP_RETURN sidecar (full ciphertext)
  const opret = buildOpReturnJson({
    kind: 'proof',
    parent: source.txid,
    topic: meta.topic,
    sha256: encrypted.sha256,
    boxFor: encrypted.boxFor,
    cipher: encrypted.ciphertext
  })

  // 3) Unsigned tx
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript: pdScript }) // vout0
  tx.addOutput({ satoshis: 0, lockingScript: opret })    // vout1 (ciphertext)
  tx.updateMetadata({ topic: meta.topic, type: 'proof' })

  return tx
}
