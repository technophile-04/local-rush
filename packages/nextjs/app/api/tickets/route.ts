import { getAddress, isAddress } from "viem";
import { getTickets, jsonWithBigInts } from "~~/services/rush/trainView";

export async function GET(request: Request) {
  const rider = new URL(request.url).searchParams.get("rider");
  if (!rider || !isAddress(rider)) return Response.json({ error: "Enter a valid rider address." }, { status: 400 });
  try {
    return new Response(jsonWithBigInts(await getTickets(getAddress(rider))), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=2" },
    });
  } catch {
    return Response.json({ error: "Tickets are unavailable. Try again shortly." }, { status: 502 });
  }
}
