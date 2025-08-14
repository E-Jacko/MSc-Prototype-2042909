// cathays lookup service factory
// - wires the storage + ensures indexes at boot
// - returns a ready-to-use lookup service instance

import { Db } from 'mongodb'
import { CathaysLookupService } from './CathaysLookupService.ts'
import { CathaysStorage } from '../storage/CathaysStorage.ts'

export default function (mongoDb: Db) {
  const storage = new CathaysStorage(mongoDb)

  // note: fire-and-forget index creation; it’s idempotent on every boot
  storage.ensureIndexes().catch(err => {
    console.error('[cathays] failed to ensure mongo indexes:', err)
  })

  return new CathaysLookupService(storage)
}
