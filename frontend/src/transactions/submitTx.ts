// submitters:
// - submitTx(unsigned): asks wallet to fund+sign, then POSTs beef bytes to overlay
// - submitPrebuilt(txOrBytes, topics): POSTs *exact* byte array to overlay (no wallet)

import { WalletClient, Transaction, PushDrop, Utils } from '@bsv/sdk'

const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// pull topic from tx metadata or decode pushdrop if absent
function topicFromUnsigned(tx: Transaction): string {
  try {
    const metaTopic = (tx.metadata as any)?.topic
    if (typeof metaTopic === 'string' && metaTopic) return metaTopic

    const out0 = tx.outputs[0]
    const decoded = PushDrop.decode(out0.lockingScript)
    const fields = decoded.fields.map(Utils.toUTF8)
    const topic = fields[1] // [type, topic, ...]
    if (topic) return topic
  } catch {}
  throw new Error('topic not found in tx')
}

// helper: tx -> byte array (same shape wallet returns)
function txToBytes(tx: Transaction): number[] {
  const hex = tx.toHex()
  return Utils.toArray(hex, 'hex') as number[]
}

export async function submitTx(
  unsigned: Transaction
): Promise<{ txid: string; beefBytes: number }> {
  // NOTE: some wallet substrates reject 0-sat outputs; clamp to >= 1 sat.
  const outputs = unsigned.outputs.map(o => ({
    lockingScript: o.lockingScript.toHex(),
    satoshis: Math.max(1, Number(o.satoshis ?? 1)),
    outputDescription: 'energy overlay output',
  }))

  const wallet = new WalletClient('auto', 'localhost')
  const action: any = await wallet.createAction({
    description: 'energy overlay tx',
    outputs,
    options: { acceptDelayedBroadcast: true, randomizeOutputs: false },
  })

  const beef: number[] = action?.tx
  if (!Array.isArray(beef)) throw new Error('wallet did not return beef bytes')

  let txid: string = action?.txid
  if (!txid) {
    try {
      txid = Transaction.fromBEEF(beef).id('hex')
    } catch {
      txid = 'unknown'
    }
  }

  const topic = topicFromUnsigned(unsigned)
  const res = await fetch(`${OVERLAY_API}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-topics': JSON.stringify([topic]),
    },
    body: JSON.stringify(beef),
  })
  if (!res.ok) throw new Error(`submit failed: ${res.status}`)

  return { txid, beefBytes: beef.length }
}

export async function submitPrebuilt(
  txOrBytes: Transaction | number[],
  topics: string[]
): Promise<{ txid: string }> {
  const beef: number[] = Array.isArray(txOrBytes)
    ? txOrBytes
    : txToBytes(txOrBytes)

  let txid = 'unknown'
  try {
    txid = Transaction.fromBEEF(beef).id('hex')
  } catch {}

  const res = await fetch(`${OVERLAY_API}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-topics': JSON.stringify(topics),
    },
    body: JSON.stringify(beef),
  })
  if (!res.ok) throw new Error(`submit failed: ${res.status}`)

  return { txid }
}
