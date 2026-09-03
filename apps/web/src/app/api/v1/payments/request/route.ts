import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@security/session";
import { defaultPolicy, evaluatePayment, settlePayment } from "@bmoni/x402";
import { operatorAddress } from "@bmoni/wallet";
import { getRepository } from "@db/index";
import { shortId, nowIso } from "@core/ids";
import type { Payment } from "@domain/index";

// POST /api/v1/payments/request  { service, amountXlm, purpose, missionId? }
// x402 payment request with policy enforcement (spec §29-§31).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const policy = defaultPolicy();
  const amount = Number(body.amountXlm || 0);
  const decision = evaluatePayment(policy, {
    service: String(body.service || ""),
    recipient: String(body.recipient || process.env.ARENA_PAYMENT_DEMO_RECIPIENT || "0x000000000000000000000000000000000000dEaD"),
    amountXlm: amount,
    missionBudgetRemainingXlm: body.budgetRemainingXlm,
  });

  if (decision.decision === "denied") {
    return NextResponse.json({ decision: "denied", reason: decision.reason });
  }
  if (decision.decision === "needs_approval") {
    return NextResponse.json({
      decision: "needs_approval",
      service: body.service,
      purpose: body.purpose,
      amountXlm: amount,
      network: policy.network,
      missionId: body.missionId,
      reason: decision.reason,
    });
  }

  const settled = await settlePayment({
    service: String(body.service || ""),
    recipient: String(body.recipient || process.env.ARENA_PAYMENT_DEMO_RECIPIENT || "0x000000000000000000000000000000000000dEaD"),
    amountXlm: amount,
    network: policy.network,
    wallet: operatorAddress(),
  });
  const payment: Payment = {
    id: shortId("PAY"),
    missionId: body.missionId,
    service: String(body.service || ""),
    purpose: String(body.purpose || ""),
    amountXlm: amount,
    asset: policy.asset,
    network: policy.network,
    wallet: operatorAddress(),
    recipient: String(body.recipient || process.env.ARENA_PAYMENT_DEMO_RECIPIENT || "0x000000000000000000000000000000000000dEaD"),
    status: "settled",
    txHash: settled.txHash,
    createdAt: nowIso(),
    settledAt: nowIso(),
  };
  await getRepository().savePayment(payment);
  return NextResponse.json({ decision: "approved", payment });
}
