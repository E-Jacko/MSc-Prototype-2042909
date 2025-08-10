// src/transactions/submitTx.ts
// Clean submitter that lets MetaNet Desktop fund + sign for us.
// - No listOutputs (avoids "default basket is admin-only").
// - Build action from our output(s) locking scripts.
// - Returns txid + submitted BEEF size.

import { WalletClient, Transaction, PushDrop, Utils } from '@bsv/sdk'

// Where your Overlay-Express is (LARS local by default)
const OVERLAY_API =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// Toggle verbose logging with VITE_TX_DEBUG=true
const DEBUG = String((import.meta as any)?.env?.VITE_TX_DEBUG ?? 'true') === 'true'
const log = (...a: any[]) => { if (DEBUG) console.log('[submitTx]', ...a) }

// Extract the topic name from our "unsigned" tx (we set it in createTx.ts)
// 1) try tx.metadata.topic, else 2) decode PushDrop and use field[1]
function topicFromTx(tx: Transaction): string {
  const metaTopic = (tx.metadata as any)?.topic
  if (typeof metaTopic === 'string' && metaTopic) {
    log('Topic from metadata:', metaTopic)
    return metaTopic
  }
  const out0 = tx.outputs[0]
  const decoded = PushDrop.decode(out0.lockingScript)
  const fields = decoded.fields.map(Utils.toUTF8)
  const topic = fields[1]
  if (!topic) throw new Error('Topic not found in tx')
  log('Topic from PushDrop decode:', topic)
  return topic
}

// POST /submit to Overlay-Express with x-topics header
async function submitBeef(topic: string, beefBin: number[]): Promise<void> {
  const url = `${OVERLAY_API}/submit`
  log('POST', url, { topic, beefBytes: beefBin.length })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',      // server accepts JSON array of bytes
      'x-topics': JSON.stringify([topic])      // e.g. ["tm_cathays"]
    },
    body: JSON.stringify(beefBin)              // number[] of bytes
  })
  const bodyText = await res.text().catch(() => '')
  if (!res.ok) {
    log('Submit failed', res.status, bodyText)
    throw new Error(`Submit failed: ${res.status} ${bodyText}`)
  }
  log('Submit OK', res.status, bodyText.slice(0, 200))
}

// Main entry: give me the "unsigned" tx you assembled in createTx.ts,
// I'll ask the wallet to fund+sign it, then send to Overlay-Express.
export async function submitTx(unsigned: Transaction): Promise<{ txid: string; beefBytes: number }> {
  try {
    log('Begin submitTx')

    // 1) Convert our prepared outputs into WalletClient "outputs" spec
    //    (lockingScript hex + satoshis). We assume createTx populated satoshis.
    const outputsSpec = unsigned.outputs.map((o, idx) => {
      if (typeof o.satoshis !== 'number') {
        throw new Error(`Output ${idx} is missing satoshis`)
      }
      return {
        lockingScript: o.lockingScript.toHex(), // hex string
        satoshis: o.satoshis,
        outputDescription: 'Energy overlay output'
      }
    })

    // 2) Ask wallet to create the action: it selects UTXOs, adds change, computes fee, and signs.
    const wallet = new WalletClient('auto', 'localhost')
    log('wallet.createAction -> outputs:', outputsSpec.length)
    const action: any = await wallet.createAction({
      description: 'Energy overlay transaction',
      outputs: outputsSpec,
      options: {
        // We do NOT want the wallet to broadcast to miners.
        // Accept delayed broadcast so we can send to Overlay-Express ourselves.
        acceptDelayedBroadcast: true,
        randomizeOutputs: false
      }
    })

    // Some SDK versions return .tx as BEEF number[] and .txid as string
    // If not, we can reconstruct from BEEF.
    const beef: number[] = action?.tx
    if (!Array.isArray(beef)) {
      throw new Error('Wallet did not return BEEF bytes on createAction')
    }
    let txid: string | undefined = action?.txid
    if (!txid) {
      try {
        const built = Transaction.fromBEEF(beef)
        txid = built.id('hex') as string
      } catch {
        txid = 'unknown'
      }
    }
    log('Action built', { txid, beefBytes: beef.length })

    // 3) Derive topic from our *original* unsigned tx (stable & cheap)
    const topic = topicFromTx(unsigned)

    // 4) Submit to our overlay node
    await submitBeef(topic, beef)

    log('Submit complete', { topic })
    return { txid: txid ?? 'unknown', beefBytes: beef.length }
  } catch (e: any) {
    console.error('[submitTx] ERROR:', e?.message ?? e)
    throw e
  }
}
