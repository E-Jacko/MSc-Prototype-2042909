// supported kinds are offer, demand, commitment, contract, proof. topic is fixed to tm_cathays

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

// supported record kinds for this overlay
const SUPPORTED = ['offer', 'demand', 'commitment', 'contract', 'proof'] as const
type SupportedType = (typeof SUPPORTED)[number]
const TOPIC = 'tm_cathays'

// simple type guard for supported kinds
function isSupported(x: string): x is SupportedType {
  return (SUPPORTED as readonly string[]).includes(x)
}

// op_return json helper

// parse a json object from an op_return-first locking script; else null
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

// field normalisers

// pushdrop strings are already ordered; return as-is for storage
function toFieldsFromPushDrop(strings: string[]): string[] {
  return strings
}

// map op_return note to the shared fields layout [type, topic, actor, parent, extras...]
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

// service

export class CathaysLookupService implements LookupService {
  // overlay reports admissions by locking-script match
  readonly admissionMode = 'locking-script'
  // this overlay does not react to spends
  readonly spendNotificationMode = 'none'

  constructor(private readonly storage: CathaysStorage) {}

  // handle an admitted output: decode, validate, normalise, persist
  async outputAdmittedByTopic(p: OutputAdmittedByTopic): Promise<void> {
    if (p.mode !== 'locking-script' || p.topic !== TOPIC) return

    try {
      // try pushdrop first (primary encoding in this build)
      try {
        const { fields } = PushDrop.decode(p.lockingScript)
        const strings = fields.map(Utils.toUTF8)
        const type = strings[0] ?? ''
        const topic = strings[1] ?? ''
        if (!isSupported(type) || topic !== TOPIC) return

        // actor key is optional; "null" means absent
        const actorKey = strings[2] && strings[2] !== 'null' ? strings[2] : null

        // route to collections by type
        if (type === 'offer' || type === 'demand') {
          await this.storage.upsertOrder(
            p.txid, p.outputIndex, toFieldsFromPushDrop(strings), topic, actorKey
          )
        } else {
          await this.storage.upsertRecord(
            p.txid, p.outputIndex, toFieldsFromPushDrop(strings), topic, actorKey
          )
        }
        return
      } catch {
        // if pushdrop decode fails, fall through to op_return path
      }

      // optional op_return json fallback (not used or tested in this build)
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
      // log and continue so overlay ingestion never crashes
      console.error(`[cathays] admit failed ${p.txid}.${p.outputIndex}:`, err)
    }
  }

  // we keep history; no action on spends
  async outputSpent(_p: OutputSpent): Promise<void> {
    // no-op
  }

  // eviction not used for this overlay
  async outputEvicted(_txid: string, _outputIndex: number): Promise<void> {
    // no-op
  }

  // custom overlay lookups used by the ui
  async lookup(q: LookupQuestion): Promise<LookupFormula> {
    if (!q || q.service !== 'ls_cathays') throw new Error('unsupported lookup service')
    const raw: any = (q as any).query ?? (q as any).input ?? null

    // accept object or json string
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
      // default bootstrap: recent orders
      return this.storage.recentOrders(50, 0)
    }

    // dispatch to storage helpers; all return { txid, outputIndex }[]
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

  // overlay docs and metadata
  async getDocumentation() { return docs }
  async getMetaData() {
    return { name: 'Cathays Energy Lookup', shortDescription: 'query energy transactions for cardiff – cathays' }
  }
}

export default CathaysLookupService
