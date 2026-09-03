import type { Json } from "@core/types";
import type { ToolName, CustomApi, Payment } from "@domain/index";
import type { ToolContext } from "./gateway";
import { getRepository } from "@db/index";
import { defaultPolicy, evaluatePayment, settlePayment } from "@bmoni/x402";
import { operatorAddress } from "@bmoni/wallet";
import { shortId, nowIso } from "@core/ids";

// Custom API adapter. Every call goes through the Tool Gateway pipeline:
//   permission check → credential resolution → execution → result normalization → audit
// If the API returns HTTP 402, route into the x402 payment flow (settles via
// BMONI — see @bmoni/x402 — previously Stellar).

interface CustomApiToolInput {
  apiId?: string;
  customApiId?: string;
  endpointId?: string;
  params?: Record<string, unknown>;
  method?: string;
  path?: string;
}

const DEMO_RECIPIENT = process.env.ARENA_PAYMENT_DEMO_RECIPIENT || "0x000000000000000000000000000000000000dEaD";

export async function runCustomApiTool(
  _tool: ToolName,
  input: Json,
  ctx: ToolContext,
): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as CustomApiToolInput;
  const apiId = i.apiId || i.customApiId;
  const endpointId = i.endpointId;
  const params = i.params || {};

  if (!apiId) {
    return { ok: false, error: "missing apiId in custom_api.call input" };
  }

  const repo = getRepository();

  // 1. Load the custom API definition
  const api = await repo.getCustomApi(apiId);
  if (!api) {
    return { ok: false, error: `custom API not found: ${apiId}` };
  }
  if (api.status !== "active") {
    return { ok: false, error: `custom API is disabled: ${api.name}` };
  }

  // 2. Validate agent assignment — caller must have an active assignment with can_call
  if (ctx.actor !== "user") {
    const assignments = await repo.listAgentApiAssignments();
    const assignment = assignments.find(
      (a) => a.customApiId === apiId && a.agentId === `slot_${ctx.actor}`,
    );
    if (!assignment) {
      return {
        ok: false,
        error: `agent ${ctx.actor} is not assigned to custom API ${api.name}`,
      };
    }
    if (!assignment.grantedCapabilities.includes("can_call")) {
      return {
        ok: false,
        error: `agent ${ctx.actor} does not have can_call permission for ${api.name}`,
      };
    }
  }

  // 3. Resolve endpoint
  let endpoint = null;
  if (endpointId) {
    const endpoints = await repo.listCustomApiEndpoints(apiId);
    endpoint = endpoints.find((e) => e.id === endpointId);
  }
  if (!endpoint && i.method && i.path) {
    // Allow direct method+path specification
    endpoint = { method: i.method, path: i.path, name: "direct", id: "" };
  }
  if (!endpoint) {
    // Default to base URL with GET
    endpoint = { method: "GET", path: "", name: "default", id: "" };
  }

  // 4. Resolve credentials from security module (never expose to caller)
  const credential = await resolveCustomApiCredential(api);

  // 5. Build request
  const url = buildUrl(api.baseUrl, endpoint.path, params);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(api.requestConfig?.headers || {}),
    ...credential,
  };

  const timeoutMs = api.requestConfig?.timeoutMs || 30000;

  // 6. Execute with timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: endpoint.method,
      headers,
      body: endpoint.method !== "GET" ? JSON.stringify(params) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    // 7. Handle HTTP 402 → x402 payment flow
    if (res.status === 402) {
      const paymentRequired = await handle402Response(res, api, ctx);
      if (paymentRequired.needsApproval) {
        return {
          ok: false,
          error: "approval_required",
          output: {
            needsApproval: true,
            apiId: api.id,
            apiName: api.name,
            endpoint: endpoint.name,
            paymentRequired: paymentRequired.details as unknown as Json,
          },
        };
      }
      if (paymentRequired.settled) {
        // Payment settled — retry the original request
        const retryRes = await fetch(url, {
          method: endpoint.method,
          headers,
          body: endpoint.method !== "GET" ? JSON.stringify(params) : undefined,
        });
        const retryBody = await retryRes.json().catch(() => retryRes.text());
        return {
          ok: retryRes.ok,
          output: { status: retryRes.status, data: retryBody, paymentSettled: true },
          error: retryRes.ok ? undefined : `retry failed: ${retryRes.status}`,
        };
      }
      // Payment denied
      return {
        ok: false,
        error: `payment denied: ${paymentRequired.reason}`,
        output: { denied: true, reason: paymentRequired.reason },
      };
    }

    // 8. Parse response
    const body = await res.json().catch(() => res.text());
    return {
      ok: res.ok,
      output: { status: res.status, data: body },
      error: res.ok ? undefined : `HTTP ${res.status}: ${typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`,
    };
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes("abort")) {
      return { ok: false, error: `custom API request timed out after ${timeoutMs}ms` };
    }
    return { ok: false, error: `custom API call failed: ${msg}` };
  }
}

// Resolve credentials for a custom API — reads from env vars based on
// the credential_reference pointer. Never exposes raw secrets.
async function resolveCustomApiCredential(api: CustomApi): Promise<Record<string, string>> {
  const credRef = api.credentialReference;
  if (!credRef) return {};

  // Credential reference format: "env:VAR_NAME" or "header:X-Custom-Key:env:VAR_NAME"
  // For now, support "env:VAR_NAME" which reads from process.env
  if (credRef.startsWith("env:")) {
    const varName = credRef.slice(4);
    const value = process.env[varName] || "";
    if (!value) return {};

    switch (api.authType) {
      case "api_key":
        return { "X-API-Key": value };
      case "bearer_token":
        return { Authorization: `Bearer ${value}` };
      case "basic":
        return { Authorization: `Basic ${value}` };
      case "custom_header": {
        // Format: "Header-Name:env:VAR_NAME"
        const parts = credRef.split(":");
        const headerName = parts[0];
        return { [headerName]: value };
      }
      default:
        return {};
    }
  }

  return {};
}

// Build URL with path and query params
function buildUrl(baseUrl: string, path: string, params: Record<string, unknown>): string {
  const base = baseUrl.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;

  // If there are GET params, append as query string
  const queryParts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }

  const url = `${base}${p}`;
  return queryParts.length > 0 ? `${url}?${queryParts.join("&")}` : url;
}

interface X402PaymentDetails {
  amount?: number;
  amountXlm?: number;
  recipient?: string;
}

interface X402ApprovalDetails {
  service: string;
  amountXlm: number;
  recipient: string;
  network: "testnet" | "mainnet";
}

// Handle HTTP 402 response — route into x402 payment flow
async function handle402Response(
  res: Response,
  api: CustomApi,
  ctx: ToolContext,
): Promise<{ settled: boolean; needsApproval: boolean; reason: string; details?: X402ApprovalDetails }> {
  let paymentDetails: X402PaymentDetails;
  try {
    paymentDetails = (await res.json()) as X402PaymentDetails;
  } catch {
    return { settled: false, needsApproval: false, reason: "could not parse 402 response" };
  }

  const amountXlm = Number(paymentDetails.amount || paymentDetails.amountXlm || 0);
  const recipient = paymentDetails.recipient || DEMO_RECIPIENT;
  const service = api.name;

  if (amountXlm <= 0) {
    return { settled: false, needsApproval: false, reason: "invalid payment amount in 402" };
  }

  // Check against payment policy
  const policy = defaultPolicy();
  const decision = evaluatePayment(policy, {
    service,
    recipient,
    amountXlm,
    missionBudgetRemainingXlm: ctx.missionId ? 500 : undefined, // Default budget, NGN scale
  });

  if (decision.decision === "denied") {
    return { settled: false, needsApproval: false, reason: decision.reason };
  }

  if (decision.decision === "needs_approval") {
    return {
      settled: false,
      needsApproval: true,
      reason: decision.reason,
      details: { service, amountXlm, recipient, network: policy.network },
    };
  }

  // Approved — settle the payment
  const settled = await settlePayment({
    service,
    recipient,
    amountXlm,
    network: policy.network,
    wallet: operatorAddress(),
  });

  if (settled.settled) {
    // Record the payment
    const payment: Payment = {
      id: shortId("PAY"),
      missionId: ctx.missionId,
      service,
      purpose: `x402 payment for ${api.name}`,
      amountXlm,
      asset: policy.asset,
      network: policy.network,
      wallet: operatorAddress(),
      recipient,
      status: "settled" as const,
      txHash: settled.txHash,
      createdAt: nowIso(),
      settledAt: nowIso(),
    };
    await getRepository().savePayment(payment);
  }

  return {
    settled: settled.settled,
    needsApproval: false,
    reason: settled.settled ? "payment settled" : `payment failed: ${settled.error}`,
  };
}
