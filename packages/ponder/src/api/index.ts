import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { desc, graphql, isNotNull, sql } from "ponder";

const app = new Hono();

app.use("/graphql", graphql({ db, schema }));

app.get("/stats", async (c) => {
  const [totals, recentTrains] = await Promise.all([
    db.select({
      trainsDeparted: sql`count(*) filter (where ${schema.train.departedAt} is not null)`.mapWith(Number),
      ridersTotal: sql`coalesce(sum(${schema.train.riders}), 0)`.mapWith(Number),
      teamworkRiders: sql`coalesce(sum(${schema.train.teamworkRiders}), 0)`.mapWith(Number),
    }).from(schema.train),
    db.select({
      trainId: schema.train.id,
      riders: schema.train.riders,
      destination: schema.train.destination,
      virarFast: schema.train.virarFast,
    })
      .from(schema.train)
      .where(isNotNull(schema.train.departedAt))
      .orderBy(desc(schema.train.departedAt), desc(schema.train.id))
      .limit(5),
  ]);

  return c.json({
    trainsDeparted: totals[0]?.trainsDeparted ?? 0,
    ridersTotal: totals[0]?.ridersTotal ?? 0,
    teamworkPushes: Math.floor((totals[0]?.teamworkRiders ?? 0) / 2),
    recentTrains: recentTrains.map((row) => ({ ...row, trainId: row.trainId.toString() })),
  });
});

export default app;

