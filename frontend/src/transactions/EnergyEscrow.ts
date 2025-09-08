// minimal energy escrow with a meter path and a buyer refund path
// meterRelease: meter key signs the tx preimage, enforces readingTime within the window,
// and binds seller payout while allowing other outputs
// buyerRefund: after windowEnd, buyer can refund to self; wallet ui enforces payout target
// kept small for clarity and to make future extension easy

import type { ByteString } from 'scrypt-ts'
import {
  SmartContract,
  method,
  prop,
  assert,
  PubKey,
  Sig,
  hash256,
  hash160,
  Utils
} from 'scrypt-ts'

export class EnergyEscrow extends SmartContract {
  // immutable params
  @prop() readonly buyerKey: PubKey
  @prop() readonly sellerKey: PubKey
  @prop() readonly meterKey: PubKey
  @prop() readonly termsHash: ByteString
  @prop() readonly windowStart: bigint     // unix seconds
  @prop() readonly windowEnd: bigint       // unix seconds and refund time

  constructor(
    buyerKey: PubKey,
    sellerKey: PubKey,
    meterKey: PubKey,
    termsHash: ByteString,
    windowStart: bigint,
    windowEnd: bigint
  ) {
    super(...arguments)
    this.buyerKey = buyerKey
    this.sellerKey = sellerKey
    this.meterKey = meterKey
    this.termsHash = termsHash
    this.windowStart = windowStart
    this.windowEnd = windowEnd
  }

  // path 1: meter proves delivery within the window and pays seller
  // meterSig signs the current input preimage
  // readingTime must lie within the window
  // amountForSeller plus otherOutputs must match the final outputs
  @method()
  public meterRelease(
    meterSig: Sig,
    readingTime: bigint,
    amountForSeller: bigint,
    otherOutputs: ByteString
  ) {
    // enforce time window
    assert(readingTime >= this.windowStart, 'reading before window start')
    assert(readingTime <= this.windowEnd, 'reading after window end')

    // meter must sign the tx preimage
    assert(this.checkSig(meterSig, this.meterKey), 'invalid meter signature')

    // enforce that vout0 pays the seller; allow remaining outputs as bytes
    const sellerPkh = hash160(this.sellerKey)
    const vout0 = Utils.buildPublicKeyHashOutput(sellerPkh, amountForSeller)

    // bind the exact outputs set: seller payout plus otherOutputs
    assert(this.ctx.hashOutputs === hash256(vout0 + otherOutputs), 'unexpected outputs')
  }

  // path 2: buyer refund after windowEnd as a timeout fallback
  // requires a non-final sequence and nLocktime at least windowEnd
  // buyer must sign the tx preimage
  @method()
  public buyerRefund(buyerSig: Sig) {
    // sequence must be non-final to enable nLocktime
    assert(this.ctx.sequence === 0xfffffffen, 'sequence must be non-final')
    // absolute locktime must not be a block height when using unix seconds
    assert(this.ctx.locktime >= this.windowEnd, 'refund before windowEnd')
    assert(this.checkSig(buyerSig, this.buyerKey), 'invalid buyer signature')
  }
}
