import { type Hex, decodeFunctionData, parseAbi, toFunctionSelector } from "viem";
import { rushContract } from "~~/services/rush/contract";

// Methods that ask CDP to pay. Each one's user operation must only call LocalRush.
const SPONSOR_METHODS = new Set(["pm_getPaymasterStubData", "pm_getPaymasterData", "pm_sponsorUserOperation"]);
const smartAccountAbi = parseAbi([
  "function execute(address target, uint256 value, bytes data)",
  "function executeBatch((address target, uint256 value, bytes data)[] calls)",
]);
const allowedSelectors = new Set(
  ["push(string)", "transferFrom(address,address,uint256)"].map(signature => toFunctionSelector(signature)),
);

/** True when every call in a Coinbase smart account user operation is LocalRush `push` or `transferFrom`. */
export function onlyLocalRushCalls(userOperation: unknown) {
  const callData = (userOperation as { callData?: unknown } | null)?.callData;
  if (typeof callData !== "string" || !callData.startsWith("0x")) return false;
  try {
    const { functionName, args } = decodeFunctionData({ abi: smartAccountAbi, data: callData as Hex });
    const calls = functionName === "execute" ? [{ target: args[0], value: args[1], data: args[2] }] : args[0];
    return (
      calls.length > 0 &&
      calls.every(
        call =>
          call.value === 0n &&
          call.target.toLowerCase() === rushContract.address.toLowerCase() &&
          allowedSelectors.has(call.data.slice(0, 10).toLowerCase() as Hex),
      )
    );
  } catch {
    return false;
  }
}

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
  if (SPONSOR_METHODS.has(body.method)) {
    const params = "params" in body && Array.isArray(body.params) ? body.params : [];
    if (!onlyLocalRushCalls(params[0])) return rpcError(id, -32602, "Only Mumbai Local Rush calls are sponsored");
  }
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
