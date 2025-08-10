// Admit outputs that match our topic and supported types.
// No fixed field count; we just check fields[0] (type) and fields[1] (topic).

import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'
import docs from './CathaysTopicDocs.md.js'

const SUPPORTED = ['offer', 'demand', 'commitment', 'contract', 'proof']
const TOPIC = 'tm_cathays'

export default class CathaysTopicManager implements TopicManager {
  async identifyAdmissibleOutputs(beef: number[], _prev: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      const tx = Transaction.fromBEEF(beef)
      for (const [vout, out] of tx.outputs.entries()) {
        try {
          const decoded = PushDrop.decode(out.lockingScript)
          const fields = decoded.fields.map(Utils.toUTF8)
          const [type, topic] = [fields[0], fields[1]]
          if (SUPPORTED.includes(type) && topic === TOPIC) outputsToAdmit.push(vout)
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
