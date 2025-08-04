// 📁 src/overlays/energy/cardiff/cathays/storage/CathaysStorage.ts
import { Collection, Db } from 'mongodb'
import { CathaysEnergyRecord, UTXOReference } from '../../../../../types.ts'

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
      type: 'energy_order',
      location: 'Cardiff, Cathays',
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
