// Demo “meter unlock” tx carrying (a) a PushDrop proof doc and (b) an OP_RETURN
// note with the proof hash. Wallet-funded for now (doesn’t spend the escrow).

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { buildProofOpReturn, toPushDropFieldsOrdered } from './utils'

const PROTOCOL_ID: [0, string] = [0, 'energy']

export type EncryptedPackage = {
  ciphertext: string
  boxForBuyer: string
  sha256: string
}

export async function buildMeterUnlockTx(
  escrowOutpoint: { txid: string; vout: number }, // kept for future spend
  params: {
    sellerKey: string
    buyerKey: string
    topic: string
    quantity: number
    price: number
    currency: 'GBP' | 'SATS'
  },
  _meterPrivKey: string,
  encrypted: EncryptedPackage
): Promise<Transaction> {
  const wallet = new WalletClient('auto', 'localhost')

  // vout0: PushDrop "proof" document
  const fields = toPushDropFieldsOrdered({
    kind: 'proof',
    topic: params.topic,
    actor: params.sellerKey,
    parent: escrowOutpoint.txid,
    createdAt: new Date().toISOString(),
    expiresAt: '',
    quantityKWh: String(params.quantity),
    price: String(params.price),
    currency: params.currency
  })
  const pd = new PushDrop(wallet, 'localhost')
  const lockingScript = await pd.lock(
    fields,
    PROTOCOL_ID,
    'default',
    'self',
    false,
    true,
    'before'
  )

  // vout1: compact indexable “proof” note
  const opret = buildProofOpReturn({
    kind: 'proof',
    parent: escrowOutpoint.txid,
    topic: params.topic,
    sha256: encrypted.sha256,
    boxFor: 'buyer'
  })

  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })        // vout0
  tx.addOutput({ satoshis: 1, lockingScript: opret }) // vout1  ⬅️ 1 sat (not 0)
  tx.updateMetadata({ topic: params.topic, type: 'proof' })

  return tx
}
