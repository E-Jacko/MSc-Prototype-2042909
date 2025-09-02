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
      // reconstruct the transaction from BEEF bytes
      const tx = Transaction.fromBEEF(beef)

      // iterate all outputs in this transaction
      for (const [vout, out] of tx.outputs.entries()) {
        try {
          // decode the output locking script as PushDrop (ordered pushdata fields)
          const { fields } = PushDrop.decode(out.lockingScript)

          // convert raw pushdata buffers to utf8 strings
          const s = fields.map(Utils.toUTF8)

          // extract overlay fields: field 0 = type, field 1 = topic
          const type = s[0]
          const topic = s[1]

          // apply admission rule: supported type and exact topic match
          if (SUPPORTED.includes(type as any) && topic === TOPIC) {
            // admit this output index to the overlay
            outputsToAdmit.push(vout)
          }
        } catch {
          // ignore outputs that are not valid PushDrop for our overlay
        }
      }
    } catch {
      // ignore malformed BEEF
    }

    // no coin retention policy for this overlay
    return { outputsToAdmit, coinsToRetain: [] }
  }

  // return human-readable docs for this overlay
  async getDocumentation() { return docs }

  // advertise overlay name and summary to hosts
  async getMetaData() {
    return { name: 'Cathays Energy Transactions', shortDescription: 'Indexes energy transactions in Cardiff – Cathays' }
  }
}
