// submitter that funds/signs via wallet and posts *raw beef* to overlay-express
// returns { txid, beefBytes }

import { WalletClient, Transaction, PushDrop, Utils } from '@bsv/sdk'

const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// pull topic from tx metadata or decode pushdrop if absent
function topicFromTx(tx: Transaction): string {
  const metaTopic = (tx.metadata as any)?.topic
  if (typeof metaTopic === 'string' && metaTopic) return metaTopic
  const out0 = tx.outputs[0]
  const decoded = PushDrop.decode(out0.lockingScript)
  const fields = decoded.fields.map(Utils.toUTF8)
  const topic = fields[1]
  if (!topic) throw new Error('topic not found in tx')
  return topic
}

export async function submitTx(unsigned: Transaction): Promise<{ txid: string; beefBytes: number }> {
  // build outputs spec from our prepared tx
  const outputs = unsigned.outputs.map((o, i) => {
    if (typeof o.satoshis !== 'number') throw new Error(`output ${i} missing satoshis`)
    return {
      lockingScript: o.lockingScript.toHex(),
      satoshis: o.satoshis,
      outputDescription: 'energy overlay output'
    }
  })

  // ask wallet to fund + sign without broadcasting
  const wallet = new WalletClient('auto', 'localhost')
  const action: any = await wallet.createAction({
    description: 'energy overlay tx',
    outputs,
    options: { acceptDelayedBroadcast: true, randomizeOutputs: false }
  })

  // extract beef bytes + txid (recompute if needed)
  const beef: number[] = action?.tx
  if (!Array.isArray(beef)) throw new Error('wallet did not return beef bytes')
  let txid: string = action?.txid
  if (!txid) {
    try { txid = Transaction.fromBEEF(beef).id('hex') } catch { txid = 'unknown' }
  }

  // derive topic and submit raw beef array with x-topics header
  const topic = topicFromTx(unsigned)
  const res = await fetch(`${OVERLAY_API}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-topics': JSON.stringify([topic])
    },
    body: JSON.stringify(beef)
  })
  if (!res.ok) throw new Error(`submit failed: ${res.status}`)

  return { txid, beefBytes: beef.length }
}
