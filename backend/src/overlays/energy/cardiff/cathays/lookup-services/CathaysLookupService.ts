// 📁 src/overlays/energy/cardiff/cathays/lookup-services/CathaysLookupService.ts
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

export class CathaysLookupService implements LookupService {
  readonly admissionMode = 'locking-script'
  readonly spendNotificationMode = 'none'

  constructor(private readonly storage: CathaysStorage) {}

  async outputAdmittedByTopic(payload: OutputAdmittedByTopic): Promise<void> {
    if (payload.mode !== 'locking-script') return
    if (payload.topic !== 'tm_energy_cathays') return

    try {
      const result = PushDrop.decode(payload.lockingScript)
      if (result.fields.length !== 8) throw new Error('Wrong field count')

      const fields = result.fields.map(Utils.toUTF8)
      const supportedTypes = [
        'energy_order',
        'energy_commitment',
        'energy_contract',
        'energy_proof'
      ]

      if (!supportedTypes.includes(fields[0]) || fields[1] !== 'Cardiff, Cathays') return

      await this.storage.storeRecord(payload.txid, payload.outputIndex, fields)
    } catch (err) {
      console.error(`Failed to admit tx ${payload.txid}.${payload.outputIndex}`, err)
    }
  }

  async outputSpent(payload: OutputSpent): Promise<void> {
    if (payload.mode !== 'none') return
    if (payload.topic === 'tm_energy_cathays') {
      await this.storage.deleteRecord(payload.txid, payload.outputIndex)
    }
  }

  async outputEvicted(txid: string, outputIndex: number): Promise<void> {
    await this.storage.deleteRecord(txid, outputIndex)
  }

  async lookup(question: LookupQuestion): Promise<LookupFormula> {
    if (!question || question.service !== 'ls_energy_cathays') {
      throw new Error('Unsupported lookup service')
    }

    return this.storage.findAll(50, 0)
  }

  async getDocumentation() {
    return docs
  }

  async getMetaData() {
    return {
      name: 'Cathays Energy Lookup',
      shortDescription: 'Query energy transactions from Cardiff – Cathays'
    }
  }
}
