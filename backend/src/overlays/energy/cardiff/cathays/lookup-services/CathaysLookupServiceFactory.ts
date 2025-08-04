// 📁 src/overlays/energy/cardiff/cathays/lookup-services/CathaysLookupServiceFactory.ts
import { Db } from 'mongodb'
import { CathaysLookupService } from './CathaysLookupService.ts'
import { CathaysStorage } from '../storage/CathaysStorage.ts'

export default (db: Db) => new CathaysLookupService(new CathaysStorage(db))
