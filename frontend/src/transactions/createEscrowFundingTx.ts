// escrow contract funding helper

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import { toPushDropFieldsOrdered, buildTermsHash } from './utils'

// pushdrop protocol tag
const PROTOCOL_ID: [0, string] = [0, 'energy']

export type EscrowFundingParams = {
  buyerPubKey: string
  sellerPubKey: string
  meterPubKey: string
  quantityKWh: number
  windowStartISO: string
  windowEndISO: string
  termsHash: string
  amountSats: number
  topic: string
  commitmentTxid: string
  price: number
  currency: 'GBP' | 'SATS'
}

export async function createEscrowFundingTx(p: EscrowFundingParams): Promise<Transaction> {
  const wallet = new WalletClient('auto', 'localhost')
  const pd = new PushDrop(wallet, 'localhost')

  const fields = toPushDropFieldsOrdered({
    type: 'contract',
    topic: p.topic,
    actor: p.sellerPubKey,       // who posts the contract
    parent: p.commitmentTxid,    // link to commitment
    createdAt: new Date().toISOString(),
    expiresAt: p.windowEndISO,   // set expiry to window end
    quantity: p.quantityKWh,
    price: p.price,
    currency: p.currency,
    termsHash: p.termsHash        // binds window, parties, and meter
  })

  const lockingScript = await pd.lock(fields, PROTOCOL_ID, 'default', 'self', false, true, 'before')

  const tx = new Transaction()
  // placeholder pushdrop output; real escrow locking output can replace this later
  tx.addOutput({ satoshis: 1, lockingScript })

  tx.updateMetadata({ topic: p.topic, type: 'contract' })
  return tx
}

// convenience to compute termshash consistently
export async function computeTermsHash(args: {
  orderTxid: string | null
  commitTxid: string
  topic: string
  quantityKWh: number
  price: number
  currency: 'GBP' | 'SATS'
  windowStartISO: string
  windowEndISO: string
  meterPubKey: string
}) {
  return buildTermsHash({
    orderTxid: args.orderTxid,
    commitTxid: args.commitTxid,
    topic: args.topic,
    quantityKWh: args.quantityKWh,
    price: args.price,
    currency: args.currency,
    windowStart: args.windowStartISO,
    windowEnd: args.windowEndISO,
    meterPubKey: args.meterPubKey
  })
}
