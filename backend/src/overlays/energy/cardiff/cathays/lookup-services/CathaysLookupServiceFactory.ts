// 📁 src/overlays/energy/cardiff/cathays/lookup-services/CathaysLookupServiceFactory.ts
import { Db } from 'mongodb'
import { CathaysLookupService } from './CathaysLookupService.ts'
import { CathaysStorage } from '../storage/CathaysStorage.ts'

export default function (mongoDb: Db) {
  const storage = new CathaysStorage(mongoDb)
  return new CathaysLookupService(storage)
}
