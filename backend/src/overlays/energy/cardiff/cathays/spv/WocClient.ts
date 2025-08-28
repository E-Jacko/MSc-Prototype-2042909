// Minimal What's On Chain client (backend only). Uses global fetch.

export type WocTxProof =
  | { blockhash: string; merkle: string[]; pos?: number } // confirmed
  | number                                                // e.g. 404 when pending

export type WocBlockHeader = {
  hash: string
  height: number
  merkleroot: string
  version?: number
  prevblockhash?: string
  time?: number
  bits?: number
  nonce?: number
}

export type WocTx = {
  txid: string
  vin?: Array<{ txid: string; vout: number }>
}

export default class WocClient {
  constructor(private network: 'main' | 'test' = 'main') {}
  private base() { return `https://api.whatsonchain.com/v1/bsv/${this.network}` }

  async getTxProof(txid: string): Promise<WocTxProof> {
    const res = await fetch(`${this.base()}/tx/${txid}/proof`)
    if (res.ok) return (await res.json()) as any
    try { return (await res.json()) as any } catch { return res.status }
  }

  async getBlockHeaderByHash(blockhash: string): Promise<WocBlockHeader> {
    const res = await fetch(`${this.base()}/block/hash/${blockhash}`)
    if (!res.ok) throw new Error(`WOC getBlockHeaderByHash failed ${res.status}`)
    return (await res.json()) as WocBlockHeader
  }

  async getTx(txid: string): Promise<WocTx> {
    const res = await fetch(`${this.base()}/tx/${txid}`)
    if (!res.ok) throw new Error(`WOC getTx failed ${res.status}`)
    return (await res.json()) as WocTx
  }

  async getTxHex(txid: string): Promise<string> {
    const res = await fetch(`${this.base()}/tx/${txid}/hex`)
    if (!res.ok) throw new Error(`WOC getTxHex failed ${res.status}`)
    return await res.text()
  }
}
