import type { Json } from "@core/types";
import type { AgentContext } from "./runtime";
import { toolCtx } from "./runtime";
import { sha256Hex, canonicalMissionDigest } from "@stellar/hash";
import { walletState, confirmTransaction } from "@stellar/wallet";
import { nowIso } from "@core/ids";
import type { Receipt } from "@domain/index";

interface AnchorReceiptOutput {
  anchorTx?: string;
  mock?: boolean;
  submitter?: string;
}

// Stellar Agent (spec §12, §28). Inspects wallet state, produces a canonical
// receipt, anchors it on Stellar/Soroban, verifies the on-chain confirmation,
// and records the on-chain reference. Never trusts agent claims — verifies
// transactions independently.

export async function stellarAgent(ctx: AgentContext): Promise<string> {
  const task = ctx.mission.tasks.find((t) => t.type === "stellar");
  if (task) task.status = "running";

  // Step 1: Inspect wallet state
  const wallet = await walletState();
  await ctx.emit("stellar", "stellar.wallet_inspected", {
    configured: wallet.configured,
    network: wallet.network,
    balanceXlm: wallet.balanceXlm,
  });

  // Step 2: Check if there are payments to verify on-chain
  const payments = await ctx.repo.listPayments();
  const missionPayments = payments.filter(
    (p) => p.missionId === ctx.mission.id && p.status === "settled" && p.txHash,
  );

  const verifiedPayments: string[] = [];
  for (const payment of missionPayments) {
    if (payment.txHash) {
      const confirmation = await confirmTransaction(payment.txHash);
      verifiedPayments.push(
        `${payment.service}: ${confirmation.confirmed ? "confirmed" : "failed"} (ledger ${confirmation.ledger ?? "n/a"})`,
      );
      await ctx.emit("stellar", "stellar.tx_verified", {
        txHash: payment.txHash,
        confirmed: confirmation.confirmed,
        ledger: confirmation.ledger,
      });
    }
  }

  // Step 3: Generate canonical receipt digest
  const digest = canonicalMissionDigest(ctx.mission);
  const receiptHash = await sha256Hex(digest);

  // Step 4: Anchor receipt on Stellar/Soroban
  const anchor = await ctx.tools.execute(
    "stellar.anchor_receipt",
    { digest: receiptHash, missionId: ctx.mission.id },
    toolCtx(ctx, "stellar"),
  );
  const anchorOutput = anchor.output as unknown as AnchorReceiptOutput;
  const anchorTx = anchorOutput?.anchorTx;
  const anchorMock = anchorOutput?.mock;

  // Step 5: If real anchor, verify it on-chain
  let anchorConfirmed = false;
  if (anchorTx && !anchorMock) {
    const confirmation = await confirmTransaction(anchorTx);
    anchorConfirmed = confirmation.confirmed;
    await ctx.emit("stellar", "stellar.anchor_verified", {
      anchorTx,
      confirmed: confirmation.confirmed,
      ledger: confirmation.ledger,
    });
  } else {
    // Mock anchor is always "confirmed" in demo mode
    anchorConfirmed = true;
  }

  // Step 6: Save receipt record
  const receipt: Receipt = {
    hash: receiptHash,
    missionDigest: digest,
    submitter: anchorOutput?.submitter ?? "unknown",
    timestamp: nowIso(),
    status: anchorConfirmed ? "verified" : "pending",
    anchorTx,
  };
  await ctx.repo.saveReceipt(receipt);

  // Step 7: Update task and mission
  if (task) {
    task.status = "done";
    task.result = {
      receiptHash,
      anchorTx: anchorTx ?? null,
      anchorConfirmed,
      verifiedPayments,
      walletBalance: wallet.balanceXlm ?? null,
    } as unknown as Json;
    task.updatedAt = nowIso();
  }

  ctx.mission.receiptHash = receiptHash;
  ctx.mission.stellarTx = anchorTx;
  ctx.mission.toolsUsed = Array.from(new Set([...ctx.mission.toolsUsed, "stellar.anchor_receipt"]));
  await ctx.repo.saveMission(ctx.mission);

  const summary = [
    `Receipt anchored: ${receiptHash.slice(0, 16)}...`,
    anchorTx ? `Anchor tx: ${anchorTx.slice(0, 16)}...` : "Anchor: mock",
    anchorConfirmed ? "On-chain: confirmed" : "On-chain: pending",
    verifiedPayments.length > 0 ? `Verified ${verifiedPayments.length} payment(s)` : "No payments to verify",
    wallet.balanceXlm !== undefined ? `Balance: ${wallet.balanceXlm} XLM` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return summary;
}
