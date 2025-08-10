// Same policy as TopicManager, but persists the fields for lookup.

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

const SUPPORTED = ['offer','demand','commitment','contract','proof']
const TOPIC = 'tm_cathays'

export class CathaysLookupService implements LookupService {
  readonly admissionMode = 'locking-script'
  readonly spendNotificationMode = 'none'

  constructor(private readonly storage: CathaysStorage) {}

  async outputAdmittedByTopic(p: OutputAdmittedByTopic): Promise<void> {
    if (p.mode !== 'locking-script' || p.topic !== TOPIC) return
    try {
      const result = PushDrop.decode(p.lockingScript)
      const fields = result.fields.map(Utils.toUTF8)
      const [type, topic] = [fields[0], fields[1]]
      if (!SUPPORTED.includes(type) || topic !== TOPIC) return
      await this.storage.storeRecord(p.txid, p.outputIndex, fields)
    } catch (err) {
      console.error(`Failed to admit tx ${p.txid}.${p.outputIndex}`, err)
    }
  }

  async outputSpent(p: OutputSpent): Promise<void> {
    if (p.mode !== 'none') return
    if (p.topic === TOPIC) await this.storage.deleteRecord(p.txid, p.outputIndex)
  }

  async outputEvicted(txid: string, outputIndex: number): Promise<void> {
    await this.storage.deleteRecord(txid, outputIndex)
  }

  async lookup(q: LookupQuestion): Promise<LookupFormula> {
    if (!q || q.service !== 'ls_cathays') throw new Error('Unsupported lookup service')
    return this.storage.findAll(50, 0)
  }

  async getDocumentation() { return docs }
  async getMetaData() {
    return { name: 'Cathays Energy Lookup', shortDescription: 'Query energy transactions from Cardiff – Cathays' }
  }
}
