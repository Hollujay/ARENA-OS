import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";
import type { ToolContext } from "./gateway";
import { defaultPolicy, evaluatePayment, settlePayment } from "@bmoni/x402";
import { operatorAddress } from "@bmoni/wallet";
import { shortId } from "@core/ids";

// payment.request tool. Enforces the x402 policy before settling. If the policy
// requires approval, it returns a structured "needs approval" result that the
// mission engine / UI turns into an approval prompt (spec §31).
//
// Settles via BMONI (see @bmoni/x402, @bmoni/wallet) — previously Stellar.
// "amountXlm" throughout is a legacy field name now holding an NGN amount;
// see @bmoni/x402's docstring for why that wasn't renamed as part of this swap.

interface PaymentToolInput {
  service: string;
  recipient?: string;
  purpose?: string;
  amountXlm?: number;
  budgetRemainingXlm?: number;
}

export async function runPaymentTool(
  _tool: ToolName,
  input: Json,
  ctx: ToolContext,
): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as PaymentToolInput;
  const policy = defaultPolicy();
  const decision = evaluatePayment(policy, {
    service: i.service,
    recipient: i.recipient || "0x0000000000000000000000000000000000dEaD",
    amountXlm: Number(i.amountXlm || 0),
  });

  if (decision.decision === "denied") {
    return { ok: false, error: decision.reason, output: { denied: true, reason: decision.reason } };
  }
  if (decision.decision === "needs_approval") {
    return {
      ok: false,
      error: "approval_required",
      output: {
        needsApproval: true,
        service: i.service,
        purpose: i.purpose ?? null,
        amountXlm: i.amountXlm ?? 0,
        network: policy.network,
        missionId: ctx.missionId ?? null,
        remainingBudget: i.budgetRemainingXlm ?? null,
        reason: decision.reason,
      },
    };
  }

  const settled = await settlePayment({
    service: i.service,
    recipient: i.recipient || "0x0000000000000000000000000000000000dEaD",
    amountXlm: Number(i.amountXlm || 0),
    network: policy.network,
    wallet: operatorAddress(),
  });
  return {
    ok: true,
    output: {
      paymentId: shortId("PAY"),
      txHash: settled.txHash,
      amountXlm: i.amountXlm ?? 0,
      asset: policy.asset,
      network: policy.network,
      wallet: operatorAddress(),
      service: i.service,
      purpose: i.purpose ?? null,
      settled: settled.settled,
    },
  };
}
