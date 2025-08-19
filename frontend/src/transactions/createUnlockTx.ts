// frontend/src/transactions/createUnlockTx.ts
// Builds & submits the "proof" transaction:
//  - vout0: PushDrop lock with fields (type, topic, parent, sha256, boxFor, actor)
//  - vout1: OP_RETURN with { cipher, sha256 }
// Uses the same submit path as orders/commitments.

import {
    WalletClient,
    Transaction,
    PushDrop,
    LockingScript,
    Utils,
    OP
  } from '@bsv/sdk'
  
  import { submitTx } from './submitTx'
  import { FIELD_ORDER, type TxForm } from './types' // TxForm is unused; kept for uniformity
  import { toPushDropFieldsOrdered, sha256Hex } from './utils'
  
  // Namespace for signatures (same as other tx builders)
  const PROTOCOL_ID: [0, string] = [0, 'energy']
  
  export type BuildProofParams = {
    parentTxid: string               // the contract txid we are proving against
    topic: string                    // overlay topic, e.g. 'tm_cathays'
    cipher: string                   // encrypted meter snapshot (opaque string or base64)
    boxFor?: 'buyer' | 'seller'      // optional routing hint; defaults to 'buyer'
  }
  
  async function getActorKeyHex(wallet: any): Promise<string> {
    // Prefer modern getPublicKey shape
    try {
      const r = await wallet.getPublicKey?.({
        keyID: 'default',
        counterparty: 'self',
        forSelf: true
      })
      if (r?.publicKey) return String(r.publicKey)
    } catch {}
    // Fallbacks for older MNDs (best-effort)
    try {
      const r = await wallet.getPublicKey?.({ identityKey: 'default' })
      if (r?.publicKey) return String(r.publicKey)
    } catch {}
    try {
      const r = await wallet.exportPublicKey?.({ keyId: 'default' })
      if (r?.hex) return String(r.hex)
    } catch {}
    return ''
  }
  
  /**
   * Build + submit a proof tx.
   * vout0: PushDrop (type/topic/parent/sha256/boxFor/actor)
   * vout1: OP_RETURN {"cipher": "...", "sha256": "..."}
   */
  export async function buildAndSubmitProof(params: BuildProofParams): Promise<{ txid: string }> {
    const wallet = new WalletClient('auto', 'localhost')
  
    // actor key (for UI: "Actor: ..."); non-fatal if unavailable
    const actorKey = await getActorKeyHex(wallet)
  
    // hash of the ciphertext (binds OP_RETURN payload to vout0 metadata)
    const sha = await sha256Hex(params.cipher)
  
    // ---- vout0: PushDrop ------------------------------------------------------
    // Compose only the fields we actually need; toPushDropFieldsOrdered will
    // align them to FIELD_ORDER (missing keys become empty strings).
    const pdPayload: Record<(typeof FIELD_ORDER)[number], string | number> = {
      type: 'proof',
      topic: params.topic,
      actor: actorKey,
      parent: params.parentTxid,
      sha256: sha,
      boxFor: params.boxFor ?? 'buyer'
    } as any
  
    const fields = toPushDropFieldsOrdered(pdPayload)
  
    const pd = new PushDrop(wallet, 'localhost')
    const lockingScript = await pd.lock(
      fields,
      PROTOCOL_ID,
      'default',           // MND key alias
      'self',
      false,               // forSelf
      true,                // include signature
      'before'             // CHECKSIG lock before push/drop data
    )
  
    // ---- vout1: OP_RETURN { cipher, sha256 } ----------------------------------
    const opretJSON = JSON.stringify({
      cipher: params.cipher,
      sha256: sha
    })
    const opret = new LockingScript([
      { op: OP.OP_FALSE }, // standard 0 OP_RETURN prefix
      { op: OP.OP_RETURN, data: Utils.toArray(opretJSON, 'utf8') as number[] }
    ])
  
    // ---- assemble unsigned tx -------------------------------------------------
    const tx = new Transaction()
    tx.addOutput({ satoshis: 1, lockingScript }) // vout0: PushDrop
    tx.addOutput({ satoshis: 0, lockingScript: opret }) // vout1: OP_RETURN payload
    tx.updateMetadata({ type: 'proof', topic: params.topic })
  
    // funded + signed by wallet, then submitted to overlay
    const { txid } = await submitTx(tx)
    return { txid }
  }
  