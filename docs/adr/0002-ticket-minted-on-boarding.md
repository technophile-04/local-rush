---
status: accepted
---

# A ticket is minted at boarding, and the contract remembers every rider's tickets

Each boarding mints the ticket right away into the rider account, and the contract keeps `ridesOf(rider)`, so a phone can list a commuter's tickets straight from the chain with no indexer. The ticket art is an SVG built onchain from the train, seat, and crowd level; the rider's name stays out of it, so no name can break or inject into the metadata.

## Considered Options

- Mint everyone's tickets at departure: one transaction with unbounded work, paid by whoever triggers it.
- Let riders claim after the ride: a second transaction and a second thing to explain on stage.
