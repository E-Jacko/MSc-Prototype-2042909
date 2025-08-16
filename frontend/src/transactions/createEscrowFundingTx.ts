// builds an *unsigned* funding ("contract") tx
// vout 0: placeholder escrow (OP_TRUE) with amountSats
// vout 1: 1-sat PushDrop doc { type='contract', topic, actor=<buyer>, parent=<commitment.txid>, ... }
// later we swap OP_TRUE for the real EnergyEscrow locking script

import { WalletClient, Transaction, PushDrop, Script } from '@bsv/sdk'
import { toPushDropFieldsOrdered } from './utils'
import type { EscrowParams } from './types'

// simple namespace tag for pushdrop
const PROTOCOL_ID: [0, string] = [0, 'energy']

export async function createEscrowFundingTx(params: EscrowParams): Promise<Transaction> {
  const {
    buyerPubKey,
    topic,
    commitmentTxid,
    quantityKWh,
    price,
    currency,
    windowEnd,
    amountSats = 1
  } = params

  // build vout 1 pushdrop (this is what history decodes)
  const wallet = new WalletClient('auto', 'localhost')
  const pd = new PushDrop(wallet, 'localhost')

  const payload = {
    type: 'contract',
    topic,
    actor: buyerPubKey,
    parent: commitmentTxid,
    createdAt: new Date().toISOString(),
    expiresAt: windowEnd,
    quantity: quantityKWh,
    price,
    currency
  }

  const fields = toPushDropFieldsOrdered(payload)
  const pdLocking = await pd.lock(
    fields,
    PROTOCOL_ID,
    'default',
    'self',
    false,
    true,
    'before'
  )

  // build tx
  const tx = new Transaction()

  // vout 0: placeholder escrow (OP_TRUE) – spendable by anyone – demo only
  // later: replace with compiled EnergyEscrow locking script
  const opTrue = Script.fromHex('51') // OP_TRUE
  tx.addOutput({ satoshis: amountSats, lockingScript: opTrue })

  // vout 1: pushdrop doc (1 sat)
  tx.addOutput({ satoshis: 1, lockingScript: pdLocking })

  // metadata for debug
  tx.updateMetadata({ topic, type: 'contract' })

  return tx
}
