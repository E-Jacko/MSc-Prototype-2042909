// cathays lookup service
// - decodes PushDrop OR OP_RETURN JSON
// - writes orders to 'cathaysEnergyOrders' and commitments/contracts/proofs to 'cathaysEnergyRecords'

import {
  LookupService,
  LookupFormula,
  LookupQuestion,
  OutputAdmittedByTopic,
  OutputSpent
} from '@bsv/overlay'
import { PushDrop, Utils, LockingScript, OP } from '@bsv/sdk'
import { CathaysStorage } from '../storage/CathaysStorage.ts'
import docs from '../topic-managers/CathaysTopicDocs.md.js'

const SUPPORTED = ['offer', 'demand', 'commitment', 'contract', 'proof'] as const
type SupportedType = (typeof SUPPORTED)[number]
const TOPIC = 'tm_cathays'

function isSupported(x: string): x is SupportedType {
  return (SUPPORTED as readonly string[]).includes(x)
}

// Try OP_RETURN JSON parse
function parseOpReturnJSON(ls: LockingScript): any | null {
  try {
    const c0 = ls.chunks[0]
    if (!c0 || c0.op !== OP.OP_RETURN) return null
    const txt = Utils.toUTF8(c0.data ?? [])
    if (!txt || txt[0] !== '{') return null
    return JSON.parse(txt)
  } catch { return null }
}

// Normalise any decoded payload into a "fields" string array the storage expects.
// Minimal contract: fields[0]=type, fields[1]=topic, fields[2]=actor or 'null', fields[3]=parent or 'null'.
function toFieldsFromPushDrop(strings: string[]): string[] {
  // already strings in order
  return strings
}

function toFieldsFromNote(note: any): string[] {
  const type = String(note.kind ?? '')
  const topic = String(note.topic ?? '')
  const actor = note.actor ? String(note.actor) : 'null'
  const parent = note.parent ? String(note.parent) : 'null'
  // keep extra keys if present (sha256/boxFor/etc) for future use
  const extras: string[] = []
  if (note.sha256) extras.push(String(note.sha256))
  if (note.boxFor) extras.push(String(note.boxFor))
  if (note.buyer) extras.push(String(note.buyer))
  if (note.seller) extras.push(String(note.seller))
  return [type, topic, actor, parent, ...extras]
}

export class CathaysLookupService implements LookupService {
  readonly admissionMode = 'locking-script'
  readonly spendNotificationMode = 'none'

  constructor(private readonly storage: CathaysStorage) {}

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
      } catch { /* fall through to OP_RETURN */ }

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

  async outputSpent(_p: OutputSpent): Promise<void> {
    // keep history; no-op
  }

  async outputEvicted(_txid: string, _outputIndex: number): Promise<void> {
    // optional pruning; no-op
  }

  // ---------- custom lookup passthrough ----------
  async lookup(q: LookupQuestion): Promise<LookupFormula> {
    if (!q || q.service !== 'ls_cathays') throw new Error('unsupported lookup service')
    const raw: any = (q as any).query ?? (q as any).input ?? null
    const parse = (x: unknown) => {
      if (!x) return null
      if (typeof x === 'string') try { return JSON.parse(x) } catch { return null }
      if (typeof x === 'object') return x as any
      return null
    }
    const payload = parse(raw)

    if (!payload) return this.storage.recentOrders(50, 0)

    switch (payload.kind) {
      case 'recent': return this.storage.recentOrders(payload.limit ?? 50, payload.skip ?? 0)
      case 'my-orders': return this.storage.myOrders(payload.actorKey, payload.limit ?? 50, payload.skip ?? 0)
      case 'my-commitments': return this.storage.myCommitments(payload.actorKey, payload.limit ?? 50, payload.skip ?? 0)
      case 'flow-by-order': return this.storage.flowByOrderTxid(payload.txid)
      case 'flow-by-commitment': return this.storage.flowByCommitmentTxid(payload.txid)
      default: return this.storage.recentOrders(50, 0)
    }
  }

  async getDocumentation() { return docs }
  async getMetaData() {
    return { name: 'Cathays Energy Lookup', shortDescription: 'query energy transactions for cardiff – cathays' }
  }
}
