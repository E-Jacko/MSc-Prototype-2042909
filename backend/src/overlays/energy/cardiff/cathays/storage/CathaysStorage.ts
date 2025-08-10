// Persist the fields exactly as seen so the UI can query/filter later.
// We also store derived 'type' (fields[0]) and 'topic' (fields[1]) for convenience.

import { Collection, Db } from 'mongodb'
import { UTXOReference } from '../../../../../types.ts'

export type CathaysEnergyRecord = {
  txid: string
  outputIndex: number
  fields: string[]
  type: string
  topic: string
  createdAt: Date
}

export class CathaysStorage {
  private readonly records: Collection<CathaysEnergyRecord>

  constructor(db: Db) {
    this.records = db.collection<CathaysEnergyRecord>('cathaysEnergyOrders')
  }

  async storeRecord(txid: string, outputIndex: number, fields: string[]) {
    await this.records.insertOne({
      txid,
      outputIndex,
      fields,
      type: fields[0] ?? 'unknown',
      topic: fields[1] ?? 'unknown',
      createdAt: new Date()
    })
  }

  async deleteRecord(txid: string, outputIndex: number) {
    await this.records.deleteOne({ txid, outputIndex })
  }

  async findAll(limit = 50, skip = 0): Promise<UTXOReference[]> {
    return this.records.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .project<UTXOReference>({ txid: 1, outputIndex: 1 })
      .toArray()
  }
}
