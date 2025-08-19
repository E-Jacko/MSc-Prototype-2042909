import { Db } from 'mongodb'
import { CathaysLookupService } from './CathaysLookupService.ts'
import { CathaysStorage } from '../storage/CathaysStorage.ts'

export default function (mongoDb: Db) {
  const storage = new CathaysStorage(mongoDb)
  storage.ensureIndexes().catch(err => console.error('[cathays] ensureIndexes failed', err))
  return new CathaysLookupService(storage)
}
