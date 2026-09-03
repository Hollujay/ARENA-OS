import type { PaymentPolicy } from "@domain/index";
import { shortId } from "@core/ids";
import { submitPayment, operatorAddress, isBmoniConfigured, confirmTransaction } from "./wallet";

/**
 * BMONI-backed policy engine and settlement, replacing ../stellar/x402.ts.
 * Same hard-gate policy logic (spec §29-§31) — Arena agents never spend
 * without passing this check — only the settlement rail changed.
 *
 * NAMING: `PaymentPolicy`/`Payment` (@domain/index) and this app's DB
 * schema (src/db/schema.ts: amount_xlm, budget_xlm, payments_xlm, ...)
 * still use *Xlm-suffixed field names inherited from the Stellar
 * implementation this replaces. Renaming those is a real database
 * migration across the whole domain model and every UI label that
 * displays them — out of scope for a settlement-rail swap and not
 * something to take on silently as a side effect. So: every "Xlm" field
 * below is a BMONI NGN amount now, not Stellar Lumens. Flagged here and
 * in wallet.ts rather than left unexplained.
 */

export function defaultPolicy(): PaymentPolicy {
  return {
    perRequestXlm: Number(process.env.ARENA_DEFAULT_PER_REQUEST_NGN_LIMIT || 500), // ~1 XLM's old default, rescaled to a sane NGN per-request cap
    perMissionXlm: Number(process.env.ARENA_DEFAULT_MISSION_XLM_LIMIT || 2500),
    perDayXlm: Number(process.env.ARENA_DEFAULT_DAILY_NGN_LIMIT || 10000),
    allowedServices: [], // empty = any service allowed
    allowedRecipients: [], // empty = any recipient allowed
    approvalThresholdXlm: Number(process.env.ARENA_APPROVAL_THRESHOLD_NGN || 250),
    asset: "CNGN",
    network: (process.env.BMONI_BASE_URL ?? "").includes("embedded-dev") ? "testnet" : "mainnet",
  };
}

export type PaymentDecision = "approved" | "denied" | "needs_approval";

export interface PaymentRequestInput {
  service: string;
  recipient: string;
  amountXlm: number;
  missionBudgetRemainingXlm?: number;
  dailySpendSoFarXlm?: number;
}

export function evaluatePayment(policy: PaymentPolicy, req: PaymentRequestInput): { decision: PaymentDecision; reason: string } {
  // 1. Recipient allow-list check (hard deny)
  if (policy.allowedRecipients.length && !policy.allowedRecipients.includes(req.recipient)) {
    return { decision: "denied", reason: `recipient not on allow-list: ${req.recipient}` };
  }

  // 2. Service allow-list check (requires approval for unknown services)
  if (policy.allowedServices.length && !policy.allowedServices.includes(req.service)) {
    return { decision: "needs_approval", reason: `service not pre-approved: ${req.service}` };
  }

  // 3. Per-mission budget check (hard deny)
  if (req.missionBudgetRemainingXlm !== undefined && req.amountXlm > req.missionBudgetRemainingXlm) {
    return {
      decision: "denied",
      reason: `exceeds remaining mission budget: NGN${req.amountXlm} > NGN${req.missionBudgetRemainingXlm} remaining`,
    };
  }

  // 4. Per-request limit check (hard deny)
  if (req.amountXlm > policy.perRequestXlm) {
    return { decision: "denied", reason: `exceeds per-request limit: NGN${req.amountXlm} > NGN${policy.perRequestXlm} limit` };
  }

  // 5. Daily spend limit check (hard deny)
  const dailySpend = req.dailySpendSoFarXlm ?? 0;
  if (dailySpend + req.amountXlm > policy.perDayXlm) {
    return {
      decision: "denied",
      reason: `would exceed daily limit: NGN${dailySpend + req.amountXlm} > NGN${policy.perDayXlm} daily limit`,
    };
  }

  // 6. Approval threshold check (needs approval)
  if (req.amountXlm > policy.approvalThresholdXlm) {
    return { decision: "needs_approval", reason: `above approval threshold: NGN${req.amountXlm} > NGN${policy.approvalThresholdXlm} threshold` };
  }

  return { decision: "approved", reason: "within all policy limits" };
}

export function calculateDailySpend(payments: { amountXlm: number; createdAt: string; status: string }[]): number {
  const today = new Date().toISOString().split("T")[0];
  return payments
    .filter((p) => p.createdAt.startsWith(today) && (p.status === "settled" || p.status === "approved"))
    .reduce((sum, p) => sum + p.amountXlm, 0);
}

/** Settle a payment via BMONI. Mock path (unconfigured) returns a deterministic hash so the flow is demonstrable offline. */
export async function settlePayment(req: {
  service: string;
  recipient: string;
  amountXlm: number;
  network: "testnet" | "mainnet";
  wallet: string;
}): Promise<{ txHash: string; settled: boolean; error?: string }> {
  if (isBmoniConfigured()) {
    const result = await submitPayment(req.recipient, req.amountXlm, `arena:${req.service}`);
    if (result.success) return { txHash: result.txHash, settled: true };
    return { txHash: "", settled: false, error: result.error };
  }

  return { txHash: "mock_tx_" + shortId("", 10), settled: true };
}

/** Verify a BMONI proposal actually settled (status COMPLETED), not just signed. */
export async function verifyTransactionOnChain(txHash: string): Promise<{
  confirmed: boolean;
  successful?: boolean;
  error?: string;
}> {
  if (!isBmoniConfigured()) {
    return { confirmed: true, successful: true };
  }
  const result = await confirmTransaction(txHash);
  return { confirmed: result.confirmed, successful: result.successful, error: result.error };
}

export { operatorAddress };
