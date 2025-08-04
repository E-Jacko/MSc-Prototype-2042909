// 📁 src/types.ts
export interface CathaysEnergyRecord {
  txid: string
  outputIndex: number
  type: 'energy_order'
  location: string
  fields: string[]
  createdAt: Date
}

export interface UTXOReference {
  txid: string
  outputIndex: number
}
