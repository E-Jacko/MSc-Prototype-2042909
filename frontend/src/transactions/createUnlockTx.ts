// build a *demo* "meter unlock" transaction that carries (a) a PushDrop proof doc
// and (b) an OP_RETURN with the encrypted proof package.
// note: this does NOT spend the escrow yet — it is wallet funded like orders/commitments
// so you can test the History flow end to end right now.

import { WalletClient, Transaction, PushDrop, Utils, Script } from '@bsv/sdk'

// small shared protocol id like other energy txs
const PROTOCOL_ID: [0, string] = [0, 'energy']

export type EncryptedPackage = {
  ciphertext: string
  boxForBuyer: string
  sha256: string
}

// 4-arg signature used by HistoryRow
export async function buildMeterUnlockTx(
  // kept for future real spend of the escrow output (unused in demo)
  escrowOutpoint: { txid: string; vout: number },
  params: {
    sellerKey: string
    buyerKey: string
    topic: string
    quantity: number
    price: number
    currency: 'GBP' | 'SATS'
  },
  // reserved for later contract path, not used in the demo flow
  _meterPrivKey: string,
  encrypted: EncryptedPackage
): Promise<Transaction> {
  // talk to wallet for PushDrop signature like other tx builders
  const wallet = new WalletClient('auto', 'localhost')

  // 1) build the PushDrop "proof" doc at vout 0
  const fields: string[] = [
    'proof',                    // type
    params.topic,               // topic
    params.sellerKey,           // actor = seller
    escrowOutpoint.txid,        // parent = contract txid
    new Date().toISOString(),   // createdAt
    '',                         // expiresAt (optional)
    String(params.quantity),
    String(params.price),
    params.currency
  ]

  const pd = new PushDrop(wallet, 'localhost')
  const lockingScript = await pd.lock(
    fields.map(s => Utils.toArray(s, 'utf8') as number[]),
    PROTOCOL_ID,
    'default',
    'self',
    false,
    true,
    'before'
  )

  // 2) add OP_RETURN with JSON of the encrypted package at vout 1
  //    important: give it 1 sat because MetaNet Desktop rejects 0 sat outputs
  const payloadJson = JSON.stringify(encrypted)
  const dataHex = Utils.toHex(Utils.toArray(payloadJson, 'utf8'))
  const opReturn = Script.fromASM(`OP_FALSE OP_RETURN ${dataHex}`)

  // 3) assemble unsigned tx with the two outputs above
  //    submitTx() will fund, sign and broadcast without changing output order
  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript })           // pushdrop proof doc
  tx.addOutput({ satoshis: 1, lockingScript: opReturn }) // op_return now 1 sat

  // optional hint to overlay for routing
  tx.updateMetadata({ topic: params.topic, type: 'proof' })

  return tx
}
