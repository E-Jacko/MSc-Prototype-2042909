// two collections: lean orders and richer records with lineage and spv cache

import { Collection, Db, IndexDescription } from 'mongodb'
import { UTXOReference } from '../../../../../types.ts'

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
  parentTxid: string | null
  flowId: string | null
  actorKey: string | null
  createdAt: Date

  // optional spv cache for history views
  spv?: {
    state: 'pending' | 'confirmed' | 'invalid'
    parent?: 'match' | 'mismatch' | 'unknown'
    blockHash?: string
    height?: number
    branchLen?: number
    header?: any
    proof?: any
    checkedAt?: Date
  }

  // optional hydrated payloads for later use
  hydrated_BEEF?: number[] | string | Buffer
  beefUpdatedAt?: Date

  // legacy or optional
  beefFull?: number[] | string
}

export class CathaysStorage {
  private readonly orders: Collection<CathaysOrderDoc>
  public readonly records: Collection<CathaysRecordDoc>

  constructor(db: Db) {
    // two-collection split: lean orders vs richer lifecycle records
    this.orders  = db.collection<CathaysOrderDoc>('cathaysEnergyOrders')
    this.records = db.collection<CathaysRecordDoc>('cathaysEnergyRecords')
  }

  async ensureIndexes(): Promise<void> {
    // small, hot indexes for the orders list
    const orderIdx: IndexDescription[] = [
      { key: { txid: 1, outputIndex: 1 }, unique: true, name: 'uniq' },
      { key: { createdAt: -1 }, name: 'by_time' },
      { key: { type: 1, createdAt: -1 }, name: 'type_time' },
      { key: { actorKey: 1, createdAt: -1 }, name: 'actor_time' },
    ]

    // richer indexes for lineage and spv on records
    const recordIdx: IndexDescription[] = [
      { key: { txid: 1, outputIndex: 1 }, unique: true, name: 'uniq' },
      { key: { createdAt: -1 }, name: 'by_time' },
      { key: { type: 1, createdAt: -1 }, name: 'type_time' },
      { key: { parentTxid: 1, createdAt: -1 }, name: 'parent_time' },
      { key: { flowId: 1, createdAt: -1 }, name: 'flow_time' },
      { key: { actorKey: 1, createdAt: -1 }, name: 'actor_time' },
      { key: { 'spv.state': 1, createdAt: -1 }, name: 'spv_state_time' },
      { key: { txid: 1, 'spv.checkedAt': -1 }, name: 'spv_checked_time' },
      { key: { beefUpdatedAt: -1 }, name: 'beefUpdatedAt_-1' },
      { key: { 'spv.state': 1, 'spv.checkedAt': -1 }, name: 'spv.state_1_spv.checkedAt_-1' }
    ]

    await this.orders.createIndexes(orderIdx)
    await this.records.createIndexes(recordIdx)
  }

  async upsertOrder(
    txid: string,
    outputIndex: number,
    fields: string[],
    topic: string,
    actorKey: string | null
  ) {
    // single-writer upsert keyed by txid and vout; set createdAt on first insert
    await this.orders.updateOne(
      { txid, outputIndex },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: {
          txid, outputIndex, fields, topic,
          type: (fields[0] as 'offer' | 'demand') ?? 'offer',
          actorKey: actorKey ?? null,
        }
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
  ) {
    // extract optional parent txid from fields[3]
    const parentCandidate = fields[3] && fields[3] !== 'null' ? String(fields[3]) : null
    const parentTxid = parentCandidate && parentCandidate.length === 64 ? parentCandidate : null

    // derive flowId from parent: prefer an existing record.flowId, otherwise the order txid
    let flowId: string | null = null
    if (parentTxid) {
      const parentRecord = await this.records.findOne({ txid: parentTxid })
      if (parentRecord?.flowId) flowId = parentRecord.flowId
      else {
        const parentOrder = await this.orders.findOne({ txid: parentTxid })
        if (parentOrder) flowId = parentOrder.txid
      }
    }

    // upsert this record; set createdAt on first insert
    await this.records.updateOne(
      { txid, outputIndex },
      {
        $setOnInsert: { createdAt: new Date() },
        $set: {
          txid, outputIndex, fields, topic,
          type: (fields[0] as CathaysRecordDoc['type']) ?? 'commitment',
          parentTxid: parentTxid ?? null,
          flowId: flowId ?? null,
          actorKey: actorKey ?? null,
        }
      },
      { upsert: true }
    )

    // if parent existed but lacked flowId, backfill it now
    if (flowId && parentTxid) {
      await this.records.updateOne({ txid: parentTxid, flowId: null }, { $set: { flowId } })
    }
  }

  // lightweight spv cache updates for history pages
  async updateSpvCache(txid: string, spv: CathaysRecordDoc['spv']): Promise<void> {
    if (!spv) return
    const $set: Record<string, any> = {}
    for (const [k, v] of Object.entries(spv)) {
      if (v !== undefined) $set[`spv.${k}`] = v
    }
    if (!$set['spv.checkedAt']) $set['spv.checkedAt'] = new Date()
    await this.records.updateOne({ txid }, { $set })
  }

  // optional full-beef persistence for later hydration or debug
  async storeFullBeef(txid: string, beefFull: number[] | string): Promise<void> {
    await this.records.updateOne({ txid }, { $set: { beefFull } })
  }

  // small query helpers used by the lookup service

  async recentOrders(limit = 50, skip = 0): Promise<UTXOReference[]> {
    const docs = await this.orders
      .find({}, { projection: { txid: 1, outputIndex: 1 } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()
    return docs.map(d => ({ txid: d.txid, outputIndex: d.outputIndex }))
  }

  async myOrders(actorKey: string, limit = 50, skip = 0): Promise<UTXOReference[]> {
    const docs = await this.orders
      .find({ actorKey }, { projection: { txid: 1, outputIndex: 1 } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()
    return docs.map(d => ({ txid: d.txid, outputIndex: d.outputIndex }))
  }

  async myCommitments(actorKey: string, limit = 50, skip = 0): Promise<UTXOReference[]> {
    const docs = await this.records
      .find({ type: 'commitment', actorKey }, { projection: { txid: 1, outputIndex: 1 } })
      .sort({ createdAt: -1 }).skip(skip).limit(limit).toArray()
    return docs.map(d => ({ txid: d.txid, outputIndex: d.outputIndex }))
  }

  async flowByOrderTxid(orderTxid: string): Promise<UTXOReference[]> {
    const order = await this.orders.findOne(
      { txid: orderTxid }, { projection: { txid: 1, outputIndex: 1 } }
    )

    const recs = await this.records.find(
      { $or: [{ flowId: orderTxid }, { parentTxid: orderTxid }] },
      { projection: { txid: 1, outputIndex: 1 } }
    ).sort({ createdAt: 1 }).toArray()

    const list: UTXOReference[] = []
    if (order) list.push({ txid: order.txid, outputIndex: order.outputIndex })
    recs.forEach(r => list.push({ txid: r.txid, outputIndex: r.outputIndex }))
    return list
  }

  async flowByCommitmentTxid(commitTxid: string): Promise<UTXOReference[]> {
    const commit = await this.records.findOne({ txid: commitTxid })
    if (!commit) return []

    const flowId = commit.flowId ?? commit.parentTxid ?? null
    if (!flowId) return [{ txid: commit.txid, outputIndex: commit.outputIndex }]

    const order = await this.orders.findOne(
      { txid: flowId }, { projection: { txid: 1, outputIndex: 1 } }
    )

    const recs = await this.records.find(
      { $or: [{ flowId }, { parentTxid: flowId }] },
      { projection: { txid: 1, outputIndex: 1 } }
    ).sort({ createdAt: 1 }).toArray()

    const list: UTXOReference[] = []
    if (order) list.push({ txid: order.txid, outputIndex: order.outputIndex })
    recs.forEach(r => list.push({ txid: r.txid, outputIndex: r.outputIndex }))
    return list
  }
}
