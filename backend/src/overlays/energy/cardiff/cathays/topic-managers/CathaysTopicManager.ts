// 📁 src/overlays/energy/cardiff/cathays/topic-managers/CathaysTopicManager.ts
import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { Transaction, PushDrop, Utils } from '@bsv/sdk'
import docs from './CathaysTopicDocs.md.js'

export default class CathaysTopicManager implements TopicManager {
  async identifyAdmissibleOutputs(
    beef: number[],
    previousCoins: number[]
  ): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []

    try {
      const parsedTx = Transaction.fromBEEF(beef)

      for (const [index, output] of parsedTx.outputs.entries()) {
        try {
          const result = PushDrop.decode(output.lockingScript)
          if (result.fields.length !== 8) continue

          const fields = result.fields.map(Utils.toUTF8)
          const supportedTypes = [
            'energy_order',
            'energy_commitment',
            'energy_contract',
            'energy_proof'
          ]

          if (!supportedTypes.includes(fields[0])) continue
          if (fields[1] !== 'Cardiff, Cathays') continue

          outputsToAdmit.push(index)
        } catch (_) {}
      }
    } catch (_) {}

    return { outputsToAdmit, coinsToRetain: [] }
  }

  async getDocumentation() {
    return docs
  }

  async getMetaData() {
    return {
      name: 'Cathays Energy Transactions',
      shortDescription: 'Indexes energy transactions in Cardiff – Cathays'
    }
  }
}
