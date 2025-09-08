// submit helpers
// submitTx(unsigned): wallet funds and signs, then posts beef bytes to the overlay
// submitPrebuilt(txOrBytes, topics): posts an exact byte array to the overlay

import { WalletClient, Transaction, PushDrop, Utils } from '@bsv/sdk'

const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// pull topic from tx metadata or decode pushdrop if metadata is missing
function topicFromUnsigned(tx: Transaction): string {
  try {
    // fast path: prefer topic stored in tx metadata
    const metaTopic = (tx.metadata as any)?.topic
    if (typeof metaTopic === 'string' && metaTopic) return metaTopic

    // fallback: decode output[0] as pushdrop and read field[1] as topic
    const out0 = tx.outputs[0]
    const decoded = PushDrop.decode(out0.lockingScript)
    const fields = decoded.fields.map(Utils.toUTF8)
    const topic = fields[1] // [type, topic, ...]
    if (topic) return topic
  } catch {}
  // no topic means cannot route to overlay
  throw new Error('topic not found in tx')
}

// helper to convert a Transaction to a byte array like the wallet returns
function txToBytes(tx: Transaction): number[] {
  const hex = tx.toHex()
  return Utils.toArray(hex, 'hex') as number[]
}

// submits an unsigned tx; wallet funds and signs, then overlay receives beef
export async function submitTx(
  unsigned: Transaction
): Promise<{ txid: string; beefBytes: number }> {
  // normalize outputs for wallet.createAction and clamp to at least 1 sat
  const outputs = unsigned.outputs.map(o => ({
    lockingScript: o.lockingScript.toHex(),
    satoshis: Math.max(1, Number(o.satoshis ?? 1)),
    outputDescription: 'energy overlay output',
  }))

  // ask the wallet to fund and sign; it returns atomic beef bytes and maybe a txid
  const wallet = new WalletClient('auto', 'localhost')
  const action: any = await wallet.createAction({
    description: 'energy overlay tx',
    outputs,
    options: { acceptDelayedBroadcast: true, randomizeOutputs: false },
  })

  // validate wallet response contains the beef payload
  const beef: number[] = action?.tx
  if (!Array.isArray(beef)) throw new Error('wallet did not return beef bytes')

  // prefer txid from wallet; derive from beef if absent
  let txid: string = action?.txid
  if (!txid) {
    try {
      txid = Transaction.fromBEEF(beef).id('hex')
    } catch {
      txid = 'unknown'
    }
  }

  // find the overlay topic for this tx
  const topic = topicFromUnsigned(unsigned)

  // post the beef to the overlay; x-topics tells the overlay which topics
  const res = await fetch(`${OVERLAY_API}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-topics': JSON.stringify([topic]),
    },
    body: JSON.stringify(beef),
  })
  if (!res.ok) throw new Error(`submit failed: ${res.status}`)

  // return id and payload size for a quick status line
  return { txid, beefBytes: beef.length }
}

// submits a prebuilt transaction or byte array directly to the overlay
export async function submitPrebuilt(
  txOrBytes: Transaction | number[],
  topics: string[]
): Promise<{ txid: string }> {
  // accept either Transaction or raw bytes and normalize to a byte array
  const beef: number[] = Array.isArray(txOrBytes)
    ? txOrBytes
    : txToBytes(txOrBytes)

  // derive txid from bytes when possible
  let txid = 'unknown'
  try {
    txid = Transaction.fromBEEF(beef).id('hex')
  } catch {}

  // post the exact bytes; caller provides the target topics explicitly
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
