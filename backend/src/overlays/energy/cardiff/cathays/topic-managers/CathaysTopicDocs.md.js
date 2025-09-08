// markdown documentation for the cathays energy overlay

export default `
# Cathays Energy Overlay

This overlay indexes energy orders and lifecycle records in Cardiff – Cathays.

## field order (pushdrop)

| index | name       | notes                                 |
|------:|------------|----------------------------------------|
| 0     | type       | 'offer' or 'demand' or 'commitment' or 'contract' or 'proof' |
| 1     | topic      | fixed to 'tm_cathays'                 |
| 2     | actor      | optional actor public key, or 'null'  |
| 3     | parent     | parent txid for linked records, or 'null' |
| 4     | createdAt  | iso timestamp                         |
| 5     | expiresAt  | iso timestamp                         |
| 6     | quantity   | number (kWh)                          |
| 7     | price      | number                                 |
| 8     | currency   | 'GBP' or 'SATS'                       |
| 9+    | extras     | proof extras when type is 'proof' (sha256, cipher, meterKey) |

`
