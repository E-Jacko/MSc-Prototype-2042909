// wallet bridge: returns public identity key

import { WalletClient } from '@bsv/sdk'

export async function getIdentityKey(): Promise<string> {
  // auto transport, local desktop in dev
  const wallet = new WalletClient('auto', 'localhost')

  try {
    // request identity designated public key
    const { publicKey } = await wallet.getPublicKey({ identityKey: true })
    console.log('Identity Key:', publicKey)
    return publicKey
  } catch (err: any) {
    // propagate error for ui handling
    console.error('Error fetching identity key:', err?.message ?? err)
    throw err
  }
}


