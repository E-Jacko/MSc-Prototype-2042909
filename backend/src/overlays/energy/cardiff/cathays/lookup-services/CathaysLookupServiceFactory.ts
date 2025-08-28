// backend/src/overlays/energy/cardiff/cathays/lookup-services/CathaysLookupServiceFactory.ts

import type { Db } from 'mongodb'
import CathaysLookupService from './CathaysLookupService'
import { CathaysStorage } from '../storage/CathaysStorage'

export default function CathaysLookupServiceFactory(mongoDb: Db) {
  const storage = new CathaysStorage(mongoDb)
  storage.ensureIndexes().catch(err =>
    console.error('[cathays] ensureIndexes failed', err)
  )
  return new CathaysLookupService(storage)
}
