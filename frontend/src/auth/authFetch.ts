// Connects to MetaNet Desktop and returns the identity public key

import { WalletClient } from '@bsv/sdk'

export async function getIdentityKey(): Promise<string> {
  const wallet = new WalletClient('auto', 'localhost')

  try {
    const { publicKey } = await wallet.getPublicKey({ identityKey: true })
    console.log('🧠 Identity Key:', publicKey)
    return publicKey
  } catch (err: any) {
    console.error('❌ Error fetching identity key:', err.message)
    throw err
  }
}
