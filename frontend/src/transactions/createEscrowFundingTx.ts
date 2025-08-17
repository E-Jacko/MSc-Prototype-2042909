// Creates the *funding* transaction for an energy escrow.
// vout0: PushDrop document describing the contract
// vout1: OP_RETURN “contract” note (compact) that the lookup service indexes

import { WalletClient, Transaction, PushDrop } from '@bsv/sdk'
import {
  toPushDropFieldsOrdered,
  buildTermsHash,
  buildContractOpReturn
} from './utils'

export type EscrowFundingParams = {
  buyerPubKey: string
  sellerPubKey: string
  meterPubKey: string
  quantityKWh: number
  windowStartISO: string
  windowEndISO: string
  topic: string
  commitmentTxid: string
  price: number
  currency: 'GBP' | 'SATS'
  amountSats: number
}

const PROTOCOL_ID: [0, string] = [0, 'energy']

export async function createEscrowFundingTx(params: EscrowFundingParams) {
  const wallet = new WalletClient('auto', 'localhost')

  // Derive a stable “terms” hash to bind contract semantics
  const termsHash = await buildTermsHash({
    orderTxid: null,
    commitTxid: params.commitmentTxid,
    topic: params.topic,
    quantityKWh: params.quantityKWh,
    price: params.price,
    currency: params.currency,
    windowStart: params.windowStartISO,
    windowEnd: params.windowEndISO,
    meterPubKey: params.meterPubKey
  })

  // vout0: PushDrop contract record (human/overlay readable)
  const pd = new PushDrop(wallet, 'localhost')
  const contractDoc = toPushDropFieldsOrdered({
    kind: 'contract',
    topic: params.topic,
    buyer: params.buyerPubKey,
    seller: params.sellerPubKey,
    meter: params.meterPubKey,
    quantityKWh: String(params.quantityKWh),
    windowStart: params.windowStartISO,
    windowEnd: params.windowEndISO,
    price: String(params.price),
    currency: params.currency,
    parent: params.commitmentTxid,
    termsHash
  })
  const contractLocking = await pd.lock(
    contractDoc,
    PROTOCOL_ID,
    'default',
    'self',
    false,
    true,
    'before'
  )

  // vout1: compact indexable “contract” note for the lookup service
  const contractNote = buildContractOpReturn({
    kind: 'contract',
    parent: params.commitmentTxid,
    topic: params.topic,
    sha256: termsHash
  })

  const tx = new Transaction()
  tx.addOutput({ satoshis: 1, lockingScript: contractLocking }) // vout0
  tx.addOutput({ satoshis: 1, lockingScript: contractNote })    // vout1  ⬅️ 1 sat (not 0)
  tx.updateMetadata({ topic: params.topic, type: 'contract' })

  return tx
}
