---
status: accepted
---

# A train's departure is resolved inside the next push, not by a keeper

Trains must leave on their own all day with no host, but a contract can't act on a timer. So the contract never "runs" a departure: the next push after the halt runs out departs the old train first (emitting `TrainDeparted` with the halt's end as its time), and `status()` reports the effective train, already the next empty one, without any transaction. A full train departs in the same push that filled it.

## Considered Options

- A keeper or cron job calling `depart()`: one more always-on process to babysit on demo day, and gas nobody sponsors.
- Running the game on a server and settling onchain later: loses "everything you did is onchain, live".

## Consequences

- The projector and phones must read `status()`, never `currentTrainId`, which lags until someone pushes.
- An indexer sees a timed-out train's `TrainDeparted` only when the next push lands, stamped with the halt's end, not the block time.
