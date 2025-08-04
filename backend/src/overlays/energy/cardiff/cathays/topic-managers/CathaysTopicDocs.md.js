// 📁 src/overlays/energy/cardiff/cathays/topic-managers/CatheysTopicDocs.md.js
export default `
# Cathays Energy Topic

This overlay indexes energy orders in Cardiff – Cathays.

| Field Index | Field Description |
|-------------|-------------------|
| 0           | type (must be "energy_order") |
| 1           | location (must be "Cardiff, Cathays") |
| 2‑7         | additional order data |

Transactions must contain exactly 8 fields and match the expected type + location.
`
