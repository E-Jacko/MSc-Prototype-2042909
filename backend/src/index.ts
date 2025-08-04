// 📁 src/index.ts
import OverlayExpress from '@bsv/overlay-express'
import { MongoClient } from 'mongodb'
import CathaysTopicManager from './overlays/energy/cardiff/cathays/topic-managers/CathaysTopicManager.ts'
import CathaysLookupServiceFactory from './overlays/energy/cardiff/cathays/lookup-services/CathaysLookupServiceFactory.ts'

const PORT = parseInt(process.env.PORT || '3000', 10)
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017'
const HOSTING_URL = process.env.HOSTING_URL || 'your-host-url.ngrok-free.app'
const PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY || 'your_private_key_here'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin_token_here'

async function main() {
  const overlay = new OverlayExpress('cathays-overlay', PRIVATE_KEY, HOSTING_URL, ADMIN_TOKEN)

  overlay.configurePort(PORT)
  overlay.configureNetwork('test')
  await overlay.configureMongo(MONGO_URL)

  overlay.configureTopicManager('tm_energy_cathays', new CathaysTopicManager())
  overlay.configureLookupServiceWithMongo('ls_energy_cathays', CathaysLookupServiceFactory)

  await overlay.configureEngine()
  await overlay.start()
}

main()
