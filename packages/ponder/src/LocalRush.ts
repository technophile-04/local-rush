import { ponder } from "ponder:registry";
import { ride, train } from "ponder:schema";
import { zeroAddress } from "viem";

ponder.on("LocalRush:Boarded", async ({ event, context }) => {
  const { trainId, rider, tokenId, name, seat, teamwork } = event.args;
  const existingTrain = await context.db.find(train, { id: trainId });
  const [destination, virarFast] = existingTrain
    ? [existingTrain.destination, existingTrain.virarFast]
    : await context.client.readContract({
        ...context.contracts.LocalRush,
        functionName: "train",
        args: [trainId],
      });

  await context.db.insert(ride).values({
    tokenId,
    trainId,
    rider,
    name,
    seat,
    teamwork,
    boardedAt: event.block.timestamp,
    owner: rider,
  });

  await context.db
    .insert(train)
    .values({
      id: trainId,
      destination,
      virarFast,
      riders: 1,
      teamworkRiders: teamwork ? 1 : 0,
      firstBoardAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      riders: row.riders + 1,
      teamworkRiders: row.teamworkRiders + (teamwork ? 1 : 0),
    }));
});

ponder.on("LocalRush:TrainDeparted", async ({ event, context }) => {
  await context.db.update(train, { id: event.args.trainId }).set({
    departedAt: event.args.departedAt,
    riders: Number(event.args.riders),
  });
});

ponder.on("LocalRush:Transfer", async ({ event, context }) => {
  if (event.args.from === zeroAddress) return;

  await context.db.update(ride, { tokenId: event.args.tokenId }).set({
    owner: event.args.to,
  });
});
