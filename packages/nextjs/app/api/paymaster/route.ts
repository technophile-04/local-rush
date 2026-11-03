import { forwardSponsorCall, sponsorCors } from "~~/services/rush/paymaster";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON" } },
      { headers: sponsorCors },
    );
  }
  return forwardSponsorCall(body, process.env.CDP_PAYMASTER_URL);
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: sponsorCors });
}
