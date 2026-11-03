import { getTrainView, jsonWithBigInts } from "~~/services/rush/trainView";

export async function GET() {
  try {
    return new Response(jsonWithBigInts(await getTrainView()), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=1, stale-while-revalidate=4",
      },
    });
  } catch {
    return Response.json({ error: "The train feed is unavailable. Try again shortly." }, { status: 502 });
  }
}
