// cathays lookup service
// - decodes pushdrop, validates topic + type
// - writes orders to 'cathaysEnergyOrders' and commitments/contracts/proofs to 'cathaysEnergyRecords'
// - does not delete docs on spend; we want the full history
// - exposes a small custom lookup api for the history page

import {
  LookupService,
  LookupFormula,
  LookupQuestion,
  OutputAdmittedByTopic,
  OutputSpent
} from '@bsv/overlay'
import { PushDrop, Utils } from '@bsv/sdk'
import { CathaysStorage } from '../storage/CathaysStorage.ts'
import docs from '../topic-managers/CathaysTopicDocs.md.js'

// ---------- constants ----------

const SUPPORTED = ['offer','demand','commitment','contract','proof'] as const
const TOPIC = 'tm_cathays' // must match the topic manager

type SupportedType = typeof SUPPORTED[number]

type QueryInput =
  | { kind: 'recent'; limit?: number; skip?: number }
  | { kind: 'my-orders'; actorKey: string; limit?: number; skip?: number }
  | { kind: 'my-commitments'; actorKey: string; limit?: number; skip?: number }
  | { kind: 'flow-by-order'; txid: string }
  | { kind: 'flow-by-commitment'; txid: string }

// ---------- service ----------

export class CathaysLookupService implements LookupService {
  // note: topic-manager uses locking-script admission for tm_cathays
  readonly admissionMode = 'locking-script'
  // note: we don't rely on spend notifications to delete history
  readonly spendNotificationMode = 'none'

  constructor(private readonly storage: CathaysStorage) {}

  // ---------- overlay callbacks ----------

  async outputAdmittedByTopic(p: OutputAdmittedByTopic): Promise<void> {
    // guard: ensure we're seeing the right admission mode + topic
    if (p.mode !== 'locking-script' || p.topic !== TOPIC) return

    try {
      // decode pushdrop and normalise to utf8 strings
      const { fields } = PushDrop.decode(p.lockingScript)
      const strings = fields.map(Utils.toUTF8)

      // validate type + topic from the payload
      const type = (strings[0] as SupportedType) ?? 'offer'
      const topic = strings[1] ?? ''
      if (!SUPPORTED.includes(type) || topic !== TOPIC) return

      // pull common denormalised bits if present in the payload schema
      const actorKey = strings[2] && strings[2] !== 'null' ? strings[2] : null

      // route to the right collection
      if (type === 'offer' || type === 'demand') {
        await this.storage.upsertOrder(p.txid, p.outputIndex, strings, topic, actorKey)
      } else {
        await this.storage.upsertRecord(p.txid, p.outputIndex, strings, topic, actorKey)
      }
    } catch (err) {
      console.error(`failed to admit tx ${p.txid}.${p.outputIndex}:`, err)
    }
  }

  async outputSpent(_p: OutputSpent): Promise<void> {
    // note: do nothing; we keep docs for historical views even when spent
  }

  async outputEvicted(_txid: string, _outputIndex: number): Promise<void> {
    // note: do nothing; if you want to prune evictions for reorg handling,
    //       add a very careful reconciler instead of blind deletes
  }

  // ---------- custom lookup api ----------
  // everything between the lines below is the custom lookup used by the history page.
  // it reads a simple json string from q.input, routes to storage helpers, and returns UTXO references.
   // --------------------------------------------------------------------------------
   async lookup(q: LookupQuestion): Promise<LookupFormula> {
    if (!q || q.service !== 'ls_cathays') {
      throw new Error('unsupported lookup service')
    }

    // read the payload as defined by the overlay api:
    // - primary: q.query (typed object per docs)
    // - fallback: q.input (older/stringified payloads)
    const raw = (q as any).query ?? (q as any).input ?? null

    // parse safely whether it's already an object or a json string
    const parsed = this.safeParseInput(raw) as QueryInput | null

    if (!parsed) {
      // default to "recent" if nothing provided
      return this.storage.recentOrders(50, 0)
    }

    switch (parsed.kind) {
      case 'recent':
        return this.storage.recentOrders(parsed.limit ?? 50, parsed.skip ?? 0)

      case 'my-orders':
        return this.storage.myOrders(parsed.actorKey, parsed.limit ?? 50, parsed.skip ?? 0)

      case 'my-commitments':
        return this.storage.myCommitments(parsed.actorKey, parsed.limit ?? 50, parsed.skip ?? 0)

      case 'flow-by-order':
        return this.storage.flowByOrderTxid(parsed.txid)

      case 'flow-by-commitment':
        return this.storage.flowByCommitmentTxid(parsed.txid)

      default:
        return this.storage.recentOrders(50, 0)
    }
  }
  // --------------------------------------------------------------------------------

  // ---------- docs/metadata ----------

  async getDocumentation() { return docs }
  async getMetaData() {
    return { name: 'Cathays Energy Lookup', shortDescription: 'query energy transactions for cardiff – cathays' }
  }

  // ---------- helpers ----------

  private safeParseInput(input: unknown): QueryInput | null {
    try {
      if (!input) return null
      if (typeof input === 'string') return JSON.parse(input)
      if (typeof input === 'object') return input as QueryInput
      return null
    } catch {
      return null
    }
  }
}
