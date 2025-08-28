// backend/src/overlays/energy/cardiff/cathays/lookup-services/CathaysLookupService.ts

import {
  type LookupService,
  type LookupFormula,
  type LookupQuestion,
  type OutputAdmittedByTopic,
  type OutputSpent
} from '@bsv/overlay'
import { PushDrop, Utils, LockingScript, OP } from '@bsv/sdk'
import { CathaysStorage } from '../storage/CathaysStorage'
import docs from '../topic-managers/CathaysTopicDocs.md.js'

/**
 * Supported Cathays record kinds surfaced by the overlay.
 */
const SUPPORTED = ['offer', 'demand', 'commitment', 'contract', 'proof'] as const
type SupportedType = (typeof SUPPORTED)[number]
const TOPIC = 'tm_cathays'

function isSupported(x: string): x is SupportedType {
  return (SUPPORTED as readonly string[]).includes(x)
}

// ---------------- OP_RETURN JSON helper ----------------

/**
 * If first chunk is OP_RETURN and contains a JSON object, parse & return it.
 * Otherwise return null.
 */
function parseOpReturnJSON(ls: LockingScript): any | null {
  try {
    const c0 = ls.chunks[0]
    if (!c0 || c0.op !== OP.OP_RETURN) return null
    const txt = Utils.toUTF8(c0.data ?? [])
    if (!txt || txt[0] !== '{') return null
    return JSON.parse(txt)
  } catch {
    return null
  }
}

// ---------------- Field normalisers ----------------

/**
 * Storage expects a string[] "fields" array already ordered.
 * For PushDrop we already receive strings in order, so just return them.
 */
function toFieldsFromPushDrop(strings: string[]): string[] {
  return strings
}

/**
 * OP_RETURN JSON → storage "fields" layout.
 * Minimal contract:
 *   fields[0] = type
 *   fields[1] = topic
 *   fields[2] = actor or 'null'
 *   fields[3] = parent or 'null'
 * Optional extras kept for future use: sha256/boxFor/buyer/seller.
 */
function toFieldsFromNote(note: any): string[] {
  const type   = String(note.kind ?? '')
  const topic  = String(note.topic ?? '')
  const actor  = note.actor  ? String(note.actor)  : 'null'
  const parent = note.parent ? String(note.parent) : 'null'
  const extras: string[] = []
  if (note.sha256) extras.push(String(note.sha256))
  if (note.boxFor) extras.push(String(note.boxFor))
  if (note.buyer)  extras.push(String(note.buyer))
  if (note.seller) extras.push(String(note.seller))
  return [type, topic, actor, parent, ...extras]
}

// ---------------- Service ----------------

export class CathaysLookupService implements LookupService {
  readonly admissionMode = 'locking-script'
  readonly spendNotificationMode = 'none'

  constructor(private readonly storage: CathaysStorage) {}

  /**
   * Overlay calls this when it sees an output whose locking script matches our topic.
   * We attempt PushDrop first, then fall back to OP_RETURN JSON.
   */
  async outputAdmittedByTopic(p: OutputAdmittedByTopic): Promise<void> {
    if (p.mode !== 'locking-script' || p.topic !== TOPIC) return

    try {
      // 1) Try PushDrop
      try {
        const { fields } = PushDrop.decode(p.lockingScript)
        const strings = fields.map(Utils.toUTF8)
        const type = strings[0] ?? ''
        const topic = strings[1] ?? ''
        if (!isSupported(type) || topic !== TOPIC) return

        const actorKey = strings[2] && strings[2] !== 'null' ? strings[2] : null
        if (type === 'offer' || type === 'demand') {
          await this.storage.upsertOrder(p.txid, p.outputIndex, toFieldsFromPushDrop(strings), topic, actorKey)
        } else {
          await this.storage.upsertRecord(p.txid, p.outputIndex, toFieldsFromPushDrop(strings), topic, actorKey)
        }
        return
      } catch {
        // fall through to OP_RETURN path
      }

      // 2) Try OP_RETURN JSON
      const note = parseOpReturnJSON(p.lockingScript)
      if (!note) return

      const type = String(note.kind ?? '')
      const topic = String(note.topic ?? '')
      if (!isSupported(type) || topic !== TOPIC) return

      const fields = toFieldsFromNote(note)
      const actorKey = fields[2] && fields[2] !== 'null' ? fields[2] : null

      if (type === 'offer' || type === 'demand') {
        await this.storage.upsertOrder(p.txid, p.outputIndex, fields, topic, actorKey)
      } else {
        await this.storage.upsertRecord(p.txid, p.outputIndex, fields, topic, actorKey)
      }
    } catch (err) {
      console.error(`[cathays] admit failed ${p.txid}.${p.outputIndex}:`, err)
    }
  }

  /**
   * We keep history; no need to delete on spend.
   */
  async outputSpent(_p: OutputSpent): Promise<void> {
    // no-op
  }

  /**
   * Optional pruning – not used for now.
   */
  async outputEvicted(_txid: string, _outputIndex: number): Promise<void> {
    // no-op
  }

  // ---------- custom lookup passthrough ----------
  async lookup(q: LookupQuestion): Promise<LookupFormula> {
    if (!q || q.service !== 'ls_cathays') throw new Error('unsupported lookup service')
    const raw: any = (q as any).query ?? (q as any).input ?? null

    // tolerate either object or JSON string
    const parse = (x: unknown) => {
      if (!x) return null
      if (typeof x === 'string') {
        try { return JSON.parse(x) } catch { return null }
      }
      if (typeof x === 'object') return x as any
      return null
    }

    const payload = parse(raw)
    if (!payload) {
      // default to recent orders list (used by History tab bootstrap)
      return this.storage.recentOrders(50, 0)
    }

    switch (payload.kind) {
      case 'recent':
        return this.storage.recentOrders(payload.limit ?? 50, payload.skip ?? 0)

      case 'my-orders':
        return this.storage.myOrders(payload.actorKey, payload.limit ?? 50, payload.skip ?? 0)

      case 'my-commitments':
        return this.storage.myCommitments(payload.actorKey, payload.limit ?? 50, payload.skip ?? 0)

      case 'flow-by-order':
        return this.storage.flowByOrderTxid(payload.txid)

      case 'flow-by-commitment':
        return this.storage.flowByCommitmentTxid(payload.txid)

      default:
        // graceful fallback
        return this.storage.recentOrders(50, 0)
    }
  }

  async getDocumentation() { return docs }

  async getMetaData() {
    return { name: 'Cathays Energy Lookup', shortDescription: 'query energy transactions for cardiff – cathays' }
  }
}

export default CathaysLookupService
