// minimal energy escrow (option 2 shape) — meter path + buyer refund
// - meterRelease: meter key co-signs the tx preimage; enforces readingTime in [windowStart, windowEnd]
//                 and binds seller payout (vout 0) while allowing arbitrary "otherOutputs"
// - buyerRefund: after windowEnd, buyer can refund to self (we only require the signature; payout target is enforced by wallet UX)
// note: we keep it intentionally small so it compiles cleanly and is easy to extend later.
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
    @prop() readonly windowEnd: bigint       // unix seconds (also acts as refund-time)
  
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
  
    // path 1: meter proves delivery within window; pays seller
    // - meterSig is a standard tx signature over the current input preimage
    // - readingTime is included by the unlocker and must lie within the window
    // - amountForSeller + otherOutputs must exactly match the final outputs layout
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
  
      // meter must sign the tx preimage (no wallet needed for this check)
      assert(this.checkSig(meterSig, this.meterKey), 'invalid meter signature')
  
      // enforce that vout0 pays the seller; allow caller to specify remaining outputs as bytes
      const sellerPkh = hash160(this.sellerKey)
      const vout0 = Utils.buildPublicKeyHashOutput(sellerPkh, amountForSeller)
  
      // bind exact outputs set: [seller payout] + otherOutputs (pushdrop, proof hash, payload, etc.)
      assert(this.ctx.hashOutputs === hash256(vout0 + otherOutputs), 'unexpected outputs')
    }
  
    // path 2: buyer refund after windowEnd (acts as timeout fallback)
    // - requires a non-final sequence + nLocktime >= windowEnd (standard absolute lock)
    // - buyer must sign the tx preimage
    @method()
    public buyerRefund(buyerSig: Sig) {
      // sequence must be non-final to enable nLocktime
      assert(this.ctx.sequence === 0xfffffffen, 'sequence must be non-final')
      // absolute locktime must not be a block height if we stored unix seconds (>= 500,000,000)
      assert(this.ctx.locktime >= this.windowEnd, 'refund before windowEnd')
      assert(this.checkSig(buyerSig, this.buyerKey), 'invalid buyer signature')
    }
  }
  