const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_sendUserOperation",
  "eth_estimateUserOperationGas",
  "eth_getUserOperationReceipt",
  "eth_getUserOperationByHash",
  "eth_supportedEntryPoints",
  "pm_getPaymasterStubData",
  "pm_getPaymasterData",
  "pm_sponsorUserOperation",
]);

export const sponsorCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Cache-Control": "no-store",
};

function rpcError(id: unknown, code: number, message: string, status = 200) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: sponsorCors });
}

export async function forwardSponsorCall(body: unknown, url: string | undefined) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return rpcError(null, -32600, "Invalid JSON-RPC request");
  }
  const id = "id" in body && (typeof body.id === "number" || typeof body.id === "string") ? body.id : null;
  if (!("jsonrpc" in body) || body.jsonrpc !== "2.0" || !("method" in body) || typeof body.method !== "string") {
    return rpcError(id, -32600, "Invalid JSON-RPC request");
  }
  if (!ALLOWED_METHODS.has(body.method)) return rpcError(id, -32601, "Method not allowed");
  if (!url) return rpcError(id, -32000, "Gas sponsor not configured", 503);
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (!upstream.ok) return rpcError(id, -32000, "Gas sponsor is unavailable. Try again shortly.", 502);
    const response: unknown = await upstream.json();
    return Response.json(response, { headers: sponsorCors });
  } catch {
    // Never include upstream errors: they can contain the private CDP URL.
    return rpcError(id, -32000, "Gas sponsor is unavailable. Try again shortly.", 502);
  }
}
