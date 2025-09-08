import type { Db } from 'mongodb'
import WocClient from './WocClient.js'
import { Beef, Transaction, MerklePath } from '@bsv/sdk'
import type { WocTxProof, WocBlockHeader } from './WocClient.js'

type ParentCheck = 'match' | 'mismatch' | 'unknown'

export type SpvStatus =
  | { state: 'pending';   parent: ParentCheck; cached: boolean; updated: boolean; message?: string }
  | { state: 'confirmed'; parent: ParentCheck; cached: boolean; updated: boolean; height: number; blockHash: string; branchLen: number }
  | { state: 'invalid';   parent: ParentCheck; cached: boolean; updated: boolean; message: string }
  | { state: 'error';     parent: ParentCheck; cached: boolean; updated: boolean; message: string }

type MongoSpv = {
  state: 'pending'|'confirmed'|'invalid'
  parent?: ParentCheck
  blockHash?: string
  height?: number
  branchLen?: number
  header?: any
  proof?: any
  checkedAt?: Date
}

export default class SpvEnricher {
  private woc: WocClient
  constructor(private db: Db, network: 'main' | 'test' = 'main') {
    this.woc = new WocClient(network)
  }
  private records() { return this.db.collection('cathaysEnergyRecords') }

  async hydrateAndCache(txid: string, parentTxid?: string): Promise<SpvStatus> {
    try {
      const existing = await this.records().findOne(
        { txid },
        { projection: { spv: 1, hydrated_BEEF: 1 } }
      )
      if (existing?.spv?.state === 'confirmed' && existing?.hydrated_BEEF) {
        return {
          state: 'confirmed',
          parent: existing.spv.parent ?? 'unknown',
          cached: true,
          updated: false,
          height: existing.spv.height,
          blockHash: existing.spv.blockHash,
          branchLen: existing.spv.branchLen ?? 0
        }
      }

      // new: figure out which vouts on the contract we expect the proof to spend
      const expectedContractVouts = await this.lookupContractVouts(parentTxid)

      const proof = await this.woc.getTxProof(txid)

      // if pending, still compute the strict parent check from the child hex
      if (typeof proof === 'number') {
        let parent: ParentCheck = 'unknown'
        try {
          const childHex = await this.woc.getTxHex(txid)
          parent = this.parentCheckFromHex(childHex, parentTxid, expectedContractVouts)
        } catch { /* keep unknown */ }

        await this.cacheSpv(txid, { state: 'pending', parent })
        return { state: 'pending', parent, cached: false, updated: false, message: `WOC proof(${proof})` }
      }

      const header = await this.woc.getBlockHeaderByHash(proof.blockhash)
      if (!header?.height || !header?.merkleroot) {
        let parent: ParentCheck = 'unknown'
        try {
          const childHex = await this.woc.getTxHex(txid)
          parent = this.parentCheckFromHex(childHex, parentTxid, expectedContractVouts)
        } catch { /* keep unknown */ }

        await this.cacheSpv(txid, { state: 'invalid', parent })
        return { state: 'invalid', parent, cached: false, updated: false, message: 'Header missing height/merkleroot' }
      }

      // confirmed: build beef and compute strict parent check using txid and vout set
      const txHex = await this.woc.getTxHex(txid)
      const parent = this.parentCheckFromHex(txHex, parentTxid, expectedContractVouts)

      const bump = this.buildBumpFromWoc(txid, proof, header)
      const tx = Transaction.fromHex(txHex)
      ;(tx as any).merklePath = bump

      const beef = new Beef()
      beef.mergeTransaction(tx)
      const beefBuf = beef.toBinary()

      const branchLen = Array.isArray((proof as any).merkle) ? (proof as any).merkle.length : 0

      const upd = await this.records().updateOne(
        { txid },
        {
          $set: {
            'spv.state': 'confirmed',
            'spv.blockHash': header.hash,
            'spv.height': header.height,
            'spv.branchLen': branchLen,
            'spv.header': header,
            'spv.proof': proof,
            'spv.parent': parent,
            'spv.checkedAt': new Date(),
            hydrated_BEEF: beefBuf,
            beefUpdatedAt: new Date()
          }
        }
      )

      return {
        state: 'confirmed',
        parent,
        cached: false,
        updated: upd.modifiedCount > 0,
        height: header.height,
        blockHash: header.hash,
        branchLen
      }
    } catch (e: any) {
      return { state: 'error', parent: 'unknown', cached: false, updated: false, message: String(e?.message ?? e) }
    }
  }

  private async cacheSpv(txid: string, spv: MongoSpv): Promise<void> {
    const $set: Record<string, any> = {}
    Object.entries(spv).forEach(([k, v]) => { if (v !== undefined) $set[`spv.${k}`] = v })
    $set['spv.checkedAt'] = new Date()
    await this.records().updateOne({ txid }, { $set })
  }

  /**
   * return all overlay recorded vouts for the given contract tx
   * prefer rows where fields[0] === 'contract', but include any rows for that txid
   * this defends multi output contracts
   */
  private async lookupContractVouts(parentTxid?: string): Promise<number[]> {
    if (!parentTxid) return []
    const out: number[] = []

    // prefer explicit contract rows
    const cur1 = this.records().find(
      { txid: parentTxid, 'fields.0': 'contract' },
      { projection: { outputIndex: 1 } }
    )
    for await (const doc of cur1) {
      if (typeof doc?.outputIndex === 'number') out.push(doc.outputIndex)
    }

    // if none found or to catch multiple overlay outputs, include any rows for this txid
    if (out.length === 0) {
      const cur2 = this.records().find(
        { txid: parentTxid },
        { projection: { outputIndex: 1 } }
      )
      for await (const doc of cur2) {
        if (typeof doc?.outputIndex === 'number') out.push(doc.outputIndex)
      }
    }

    // de-dupe and sort for stability
    return Array.from(new Set(out)).sort((a, b) => a - b)
  }

  /**
   * strict parent check using only data we already fetch or store
   * steps:
   * - parse child inputs from raw hex
   * - compare to (parentTxid, expectedVouts[])
   * rules:
   * - if expectedVouts has n entries, require at least min(n, 2) matches
   * - if there is no vout info, fall back to txid only
   */
  private parentCheckFromHex(childTxHex: string, declaredParentTxid?: string, expectedVouts: number[] = []): ParentCheck {
    if (!declaredParentTxid) return 'unknown'
    try {
      const child = Transaction.fromHex(childTxHex)
      const wantTxid = declaredParentTxid.toLowerCase()

      // no vout info -> txid only match
      if (expectedVouts.length === 0) {
        const okTxid = child.inputs.some(
          i => typeof i.sourceTXID === 'string' && i.sourceTXID.toLowerCase() === wantTxid
        )
        return okTxid ? 'match' : 'mismatch'
      }

      // with vout list -> count exact outpoint matches
      const voutSet = new Set(expectedVouts)
      let matches = 0
      for (const i of child.inputs) {
        if (
          typeof i.sourceTXID === 'string' &&
          i.sourceTXID.toLowerCase() === wantTxid &&
          voutSet.has(i.sourceOutputIndex)
        ) {
          matches++
        }
      }

      // threshold: require at least min(2, expectedVouts.length)
      const required = Math.min(2, expectedVouts.length)
      return matches >= required ? 'match' : 'mismatch'
    } catch {
      return 'unknown'
    }
  }

  private buildBumpFromWoc(txid: string, proof: Exclude<WocTxProof, number>, header: WocBlockHeader) {
    const pos = (proof as any).pos ?? (proof as any).index ?? 0
    const siblings: string[] = Array.isArray((proof as any).merkle) ? (proof as any).merkle : []
    const treeHeight = siblings.length
    type Leaf = { offset: number; hash?: string; txid?: boolean; duplicate?: boolean }
    const path: Leaf[][] = Array.from({ length: Math.max(1, treeHeight) }, () => [])

    // level 0
    const level0: Leaf[] = [{ offset: pos, hash: txid, txid: true }]
    if (treeHeight > 0) level0.push({ offset: (pos ^ 1), hash: siblings[0] })
    path[0] = level0.sort((a, b) => a.offset - b.offset)

    // upper levels
    let index = pos
    for (let h = 1; h < treeHeight; h++) {
      index >>= 1
      path[h].push({ offset: (index ^ 1), hash: siblings[h] })
    }

    // legalOffsetsOnly=false to tolerate provider differences
    return new MerklePath(header.height, path, false)
  }
}
