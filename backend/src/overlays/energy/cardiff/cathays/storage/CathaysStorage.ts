// cathays storage
// - persists two collections in mongo: orders (offer|demand) and records (commitment|contract|proof)
// - computes + installs linking fields used by the history page
// - provides small query helpers used by the custom lookup service

import { Collection, Db, IndexDescription } from 'mongodb'
import { UTXOReference } from '../../../../../types.ts'

// ---------- document shapes ----------
// note: we keep "fields" exactly as decoded so the ui can read the raw payload.
//       we add a few denormalised fields that speed up history lookups.

export type CathaysOrderDoc = {
  txid: string
  outputIndex: number
  fields: string[]
  type: 'offer' | 'demand'
  topic: string
  actorKey: string | null
  createdAt: Date
}

export type CathaysRecordDoc = {
  txid: string
  outputIndex: number
  fields: string[]
  type: 'commitment' | 'contract' | 'proof'
  topic: string
  // link fields for history flows
  parentTxid: string | null          // immediate parent txid if present in fields
  flowId: string | null              // root order txid for the whole flow
  actorKey: string | null            // actor who posted this tx, if present in fields
  createdAt: Date
}

// ---------- storage class ----------

export class CathaysStorage {
  private readonly orders: Collection<CathaysOrderDoc>
  private readonly records: Collection<CathaysRecordDoc>

  constructor(db: Db) {
    // note: collection names are stable so frontends can query them directly
    this.orders = db.collection<CathaysOrderDoc>('cathaysEnergyOrders')
    this.records = db.collection<CathaysRecordDoc>('cathaysEnergyRecords')
  }

  // ---------- indexes (run once per boot; no-op if already present) ----------
  // - unique (txid, outputIndex) protects against duplicate inserts
  // - createdAt descending gives fast "recent" views
  // - actorKey + createdAt lets us filter "my stuff" efficiently
  // - flowId + parentTxid power the history graph

  async ensureIndexes(): Promise<void> {
    const orderIndexes: IndexDescription[] = [
      { key: { txid: 1, outputIndex: 1 }, name: 'txid_1_outputIndex_1', unique: true },
      { key: { type: 1, createdAt: -1 },  name: 'type_1_createdAt_-1' },
      { key: { actorKey: 1, createdAt: -1 }, name: 'actorKey_1_createdAt_-1' },
      { key: { createdAt: -1 }, name: 'by_time' },
    ]
    const recordIndexes: IndexDescription[] = [
      { key: { txid: 1, outputIndex: 1 }, name: 'txid_1_outputIndex_1', unique: true },
      { key: { type: 1, createdAt: -1 },  name: 'type_1_createdAt_-1' },
      { key: { parentTxid: 1, createdAt: -1 }, name: 'parent_1_createdAt_-1' },
      { key: { flowId: 1, createdAt: -1 }, name: 'flow_1_createdAt_-1' },
      { key: { actorKey: 1, createdAt: -1 }, name: 'actorKey_1_createdAt_-1' },
      { key: { createdAt: -1 }, name: 'by_time' },
    ]
    await this.orders.createIndexes(orderIndexes)
    await this.records.createIndexes(recordIndexes)
  }

  // ---------- upsert helpers (used by the lookup service on new outputs) ----------
  // note: we upsert (not insert) so re-orgs / retries don't explode with dup-key errors

  async upsertOrder(
    txid: string,
    outputIndex: number,
    fields: string[],
    topic: string,
    actorKey: string | null
  ): Promise<void> {
    await this.orders.updateOne(
      { txid, outputIndex },
      {
        // only create createdAt once
        $setOnInsert: { createdAt: new Date() },
        // always refresh shape (safe if a previous partial doc exists)
        $set: {
          txid,
          outputIndex,
          fields,
          type: (fields[0] as 'offer' | 'demand') ?? 'offer',
          topic,
          actorKey: actorKey ?? null,
        },
      },
      { upsert: true }
    )
  }

  async upsertRecord(
    txid: string,
    outputIndex: number,
    fields: string[],
    topic: string,
    actorKey: string | null
  ): Promise<void> {
    // try to parse a parent txid if present; many templates place it at fields[3]
    const parentCandidate = fields[3] && fields[3] !== 'null' ? String(fields[3]) : null
    const parentTxid = parentCandidate && parentCandidate.length === 64 ? parentCandidate : null

    // derive flowId:
    // - if parent is an order, flowId = that order
    // - if parent is another record and it already has flowId, reuse it
    // - if unknown, leave null; later records will backfill once parent exists
    let flowId: string | null = null
    if (parentTxid) {
      const parentRecord = await this.records.findOne({ txid: parentTxid })
      if (parentRecord?.flowId) {
        flowId = parentRecord.flowId
      } else {
        const parentOrder = await this.orders.findOne({ txid: parentTxid })
        if (parentOrder) flowId = parentOrder.txid
      }
    }

    await this.records.updateOne(
      { txid, outputIndex },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: {
          txid,
          outputIndex,
          fields,
          type: (fields[0] as CathaysRecordDoc['type']) ?? 'commitment',
          topic,
          parentTxid: parentTxid ?? null,
          flowId: flowId ?? null,
          actorKey: actorKey ?? null,
        },
      },
      { upsert: true }
    )

    // optional tiny backfill:
    // if we just learned the flowId and the parent record exists without it, update the parent
    if (flowId && parentTxid) {
      await this.records.updateOne(
        { txid: parentTxid, flowId: null },
        { $set: { flowId } }
      )
    }
  }

  // ---------- small query helpers (used by custom lookup) ----------

  async recentOrders(limit = 50, skip = 0): Promise<UTXOReference[]> {
    const docs = await this.orders
      .find({}, { projection: { txid: 1, outputIndex: 1 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    return docs.map(({ txid, outputIndex }) => ({ txid, outputIndex }))
  }

  async myOrders(actorKey: string, limit = 50, skip = 0): Promise<UTXOReference[]> {
    const docs = await this.orders
      .find({ actorKey }, { projection: { txid: 1, outputIndex: 1 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    return docs.map(({ txid, outputIndex }) => ({ txid, outputIndex }))
  }

  async myCommitments(actorKey: string, limit = 50, skip = 0): Promise<UTXOReference[]> {
    const docs = await this.records
      .find({ type: 'commitment', actorKey }, { projection: { txid: 1, outputIndex: 1 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()
    return docs.map(({ txid, outputIndex }) => ({ txid, outputIndex }))
  }

  async flowByOrderTxid(orderTxid: string): Promise<UTXOReference[]> {
    // note: returns order + any related records for that flow
    const order = await this.orders.findOne(
      { txid: orderTxid },
      { projection: { txid: 1, outputIndex: 1 } }
    )
    const recs = await this.records
      .find(
        { $or: [{ flowId: orderTxid }, { parentTxid: orderTxid }] },
        { projection: { txid: 1, outputIndex: 1 } }
      )
      .sort({ createdAt: 1 })
      .toArray()
    const list: UTXOReference[] = []
    if (order) list.push({ txid: order.txid, outputIndex: order.outputIndex })
    recs.forEach(r => list.push({ txid: r.txid, outputIndex: r.outputIndex }))
    return list
  }

  async flowByCommitmentTxid(commitTxid: string): Promise<UTXOReference[]> {
    // find the commitment, then follow its flowId (or its parent/order)
    const commit = await this.records.findOne({ txid: commitTxid })
    if (!commit) return []
    const flowId = commit.flowId ?? commit.parentTxid ?? null
    if (!flowId) return [{ txid: commit.txid, outputIndex: commit.outputIndex }]

    const order = await this.orders.findOne(
      { txid: flowId },
      { projection: { txid: 1, outputIndex: 1 } }
    )
    const recs = await this.records
      .find(
        { $or: [{ flowId }, { parentTxid: flowId }] },
        { projection: { txid: 1, outputIndex: 1 } }
      )
      .sort({ createdAt: 1 })
      .toArray()

    const list: UTXOReference[] = []
    if (order) list.push({ txid: order.txid, outputIndex: order.outputIndex })
    recs.forEach(r => list.push({ txid: r.txid, outputIndex: r.outputIndex }))
    return list
  }
}
