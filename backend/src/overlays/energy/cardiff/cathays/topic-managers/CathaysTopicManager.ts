// Admit outputs that are PushDrop and match our known type + topic.

import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'
import docs from './CathaysTopicDocs.md.js'

const SUPPORTED = ['offer', 'demand', 'commitment', 'contract', 'proof'] as const
const TOPIC = 'tm_cathays'

export default class CathaysTopicManager implements TopicManager {
  async identifyAdmissibleOutputs(beef: number[], _prev: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      const tx = Transaction.fromBEEF(beef)
      for (const [vout, out] of tx.outputs.entries()) {
        try {
          const { fields } = PushDrop.decode(out.lockingScript)
          const s = fields.map(Utils.toUTF8)
          const type = s[0]
          const topic = s[1]
          if (SUPPORTED.includes(type as any) && topic === TOPIC) {
            outputsToAdmit.push(vout)
          }
        } catch {}
      }
    } catch {}
    return { outputsToAdmit, coinsToRetain: [] }
  }

  async getDocumentation() { return docs }
  async getMetaData() {
    return { name: 'Cathays Energy Transactions', shortDescription: 'Indexes energy transactions in Cardiff – Cathays' }
  }
}
