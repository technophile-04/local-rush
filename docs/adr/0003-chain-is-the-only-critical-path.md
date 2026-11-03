---
status: proposed
---

# The chain is the only thing the game needs; Ponder only adds stats

The projector and phones read live train state from the LocalRush contract on Base, not from the indexer. Ponder indexes the same events for things the contract can't answer cheaply, like trains departed today, riders in total, teamwork pushes, and recent trains, and the UI hides those when Ponder is unreachable. A Ponder outage on Railway on demo day costs the stats strip, not the game.

## Considered Options

- Ponder as the live source for the projector: nicer queries, but it puts Railway and Postgres on the critical path during a 25-minute talk.
