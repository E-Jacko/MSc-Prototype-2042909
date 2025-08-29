// Frontend SPV helper that talks to the overlay /lookup endpoint and
// tolerates multiple hydrate response shapes. It also parses BEEF bytes
// to pull out block height and merkle branch length when possible.

export type SpvStatus = {
  state: 'pending' | 'confirmed' | 'invalid' | 'error'
  parent: 'match' | 'mismatch' | 'unknown'
  cached: boolean
  updated: boolean
  height?: number
  branchLen?: number
  message?: string
}

const OVERLAY_API: string =
  (import.meta as any)?.env?.VITE_OVERLAY_API ?? 'http://localhost:8080'

// WOC base (mainnet). If you use testnet, swap to /test.
const WOC_BASE = 'https://api.whatsonchain.com/v1/bsv/main'

type AnyJson = Record<string, any>

// ---------- small helpers ----------
function pick<T = any>(o: AnyJson | undefined | null, ...keys: string[]): T | undefined {
  if (!o) return undefined
  for (const k of keys) {
    if (k in o) return o[k]
  }
  return undefined
}

function hexToBytes(hex: string): number[] {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const out: number[] = []
  for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16))
  return out
}

// Bitcoin varint reader
function readVarInt(buf: number[], p: number): { val: number; p: number } {
  const first = buf[p]
  if (first === undefined) return { val: 0, p }
  if (first < 253) return { val: first, p: p + 1 }
  if (first === 253) {
    const v = buf[p + 1] | (buf[p + 2] << 8)
    return { val: v, p: p + 3 }
  }
  if (first === 254) {
    const v =
      buf[p + 1] |
      (buf[p + 2] << 8) |
      (buf[p + 3] << 16) |
      (buf[p + 4] << 24)
    return { val: v >>> 0, p: p + 5 }
  }
  // 255 -> 8 bytes, but our values are small; read as Number (loses precision > 2^53)
  let v = 0
  for (let i = 0; i < 8; i++) v += buf[p + 1 + i] * 2 ** (8 * i)
  return { val: v, p: p + 9 }
}

// Try to pull {height, branchLen} from a BEEF or Atomic BEEF byte array
function parseBeefMeta(raw: string | number[] | undefined): { height?: number; branchLen?: number } {
  if (!raw) return {}
  const bytes = Array.isArray(raw) ? raw.slice() : hexToBytes(raw)

  if (bytes.length < 8) return {}

  let p = 0

  // Atomic BEEF starts with 0x01010101 (LE), then 32-byte subject tx hash, then BEEF_V1
  const isAtomic = bytes[0] === 0x01 && bytes[1] === 0x01 && bytes[2] === 0x01 && bytes[3] === 0x01
  if (isAtomic) {
    p += 4 /*prefix*/ + 32 /*subject hash*/
  }

  // skip BEEF_V1 (u32 LE)
  p += 4
  if (p >= bytes.length) return {}

  // number of merkle paths (BUMPs)
  let vi = readVarInt(bytes, p)
  const nBUMPs = vi.val
  p = vi.p
  if (nBUMPs <= 0) return {}

  // First MerklePath:
  // blockHeight (varint), treeHeight (u8)
  vi = readVarInt(bytes, p)
  const blockHeight = vi.val
  p = vi.p
  const treeHeight = bytes[p]

  if (typeof blockHeight === 'number' && typeof treeHeight === 'number') {
    return { height: blockHeight, branchLen: treeHeight }
  }

  return {}
}

function extractBeefContainer(data: AnyJson): { beefLike?: string | number[]; parentTxid?: string; status?: AnyJson } {
  // Top-level candidates
  let beefLike =
    pick<string | number[]>(data, 'hydrated_BEEF', 'atomicBeefHex', 'beefHex', 'beef')

  let parentTxid: string | undefined =
    pick<string>(data, 'parentTxid')

  let status: AnyJson | undefined =
    pick<AnyJson>(data, 'status')

  // output-list shape
  if (!beefLike && Array.isArray(data?.outputs) && data.outputs.length > 0) {
    const o0 = data.outputs[0]
    beefLike = pick<string | number[]>(o0, 'hydrated_BEEF', 'atomicBeefHex', 'beefHex', 'beef')
    parentTxid = parentTxid ?? pick<string>(o0, 'parentTxid')
    status = status ?? pick<AnyJson>(o0, 'status')
  }

  return { beefLike, parentTxid, status }
}

// NEW: narrow arbitrary strings to our parent union
function isParentTag(x: any): x is 'match' | 'mismatch' | 'unknown' {
  return x === 'match' || x === 'mismatch' || x === 'unknown'
}

function normalizeHydrateResponse(
  data: AnyJson,
  _requestedTxid: string,              // underscore -> silence TS "never read"
  requestedParent?: string
): SpvStatus {
  const { beefLike, parentTxid: returnedParent, status } = extractBeefContainer(data)

  const hasBeef =
    !!beefLike ||
    (Array.isArray(beefLike) && beefLike.length > 0)

  // Parent reconciliation
  let parent: SpvStatus['parent'] = 'unknown'
  if (isParentTag(status?.parent)) {
    parent = status.parent
  } else if (returnedParent && requestedParent) {
    parent = returnedParent === requestedParent ? 'match' : 'mismatch'
  }

  // Cache/update hints
  const cached = Boolean(status?.cached)
  const updated = Boolean(status?.updated)

  // Height / branchLen if we can derive them from the BEEF bytes
  let height: number | undefined
  let branchLen: number | undefined
  if (beefLike) {
    const meta = parseBeefMeta(beefLike)
    height = meta.height
    branchLen = meta.branchLen
  }

  if (hasBeef) {
    return { state: 'confirmed', parent, cached, updated, height, branchLen }
  }

  // Fallback error state
  const errMsg =
    pick<string>(data, 'error', 'message') ??
    'bad response'
  return { state: 'error', parent, cached: false, updated: false, message: errMsg }
}

/* ---------- extra: client-side parent check via WOC ---------- */

async function parentTagFromWoc(childTxid: string, declaredParentTxid: string): Promise<'match' | 'mismatch' | 'unknown'> {
  try {
    const res = await fetch(`${WOC_BASE}/tx/${childTxid}`)
    if (!res.ok) return 'unknown'
    const j = await res.json() as { vin?: Array<{ txid?: string }> }
    const vins = (j.vin ?? []).map(v => String(v.txid ?? '').toLowerCase())
    if (vins.length === 0) return 'unknown'
    return vins.includes(declaredParentTxid.toLowerCase()) ? 'match' : 'mismatch'
  } catch {
    return 'unknown'
  }
}

// ---------- public API ----------
export async function checkSpv(txid: string, parentTxid?: string): Promise<SpvStatus> {
  try {
    const res = await fetch(`${OVERLAY_API}/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'ls_cathays',
        query: { kind: 'hydrateBeef', txid, parentTxid }
      })
    })

    if (!res.ok) {
      return {
        state: 'error',
        parent: 'unknown',
        cached: false,
        updated: false,
        message: `http ${res.status}`
      }
    }

    const data = (await res.json()) as AnyJson
    let status = normalizeHydrateResponse(data, txid, parentTxid)

    // If backend didn't supply a parent verdict, do a tiny client-side check.
    if (parentTxid && status.parent === 'unknown') {
      const tag = await parentTagFromWoc(txid, parentTxid)
      status = { ...status, parent: tag }
    }

    return status
  } catch (e: any) {
    return {
      state: 'error',
      parent: 'unknown',
      cached: false,
      updated: false,
      message: String(e?.message ?? e)
    }
  }
}
