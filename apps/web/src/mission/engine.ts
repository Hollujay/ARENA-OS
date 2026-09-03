import type { Mission, MissionStage, Payment, AuditActor, AgentRole } from "@domain/index";
import { newMission } from "@domain/index";
import type { Json } from "@core/types";
import { getRepository } from "@db/index";
import { getModelGateway } from "@ai/model-gateway";
import { getToolGateway } from "@tools/gateway";
import { capabilitiesFor } from "@security/permissions";
import { runAgent, type AgentContext } from "@agents/runtime";
import { verify } from "./verifier";
import { defaultPolicy, evaluatePayment, settlePayment } from "@bmoni/x402";
import { operatorAddress } from "@bmoni/wallet";
import { shortId, nowIso } from "@core/ids";

const STAGES: MissionStage[] = [
  "commander",
  "research",
  "payment",
  "code",
  "qa",
  "deployment",
  "verification",
  "stellar",
];

// Placeholder recipient for the demo payment flow, when the pipeline hasn't
// been given a real one. A valid-but-inert 0x address (EVM burn address),
// matching BMONI's address format now that settlement runs through them —
// the old Stellar-style "GRECIPENT" placeholder isn't a valid recipient here.
const DEMO_RECIPIENT = process.env.ARENA_PAYMENT_DEMO_RECIPIENT || "0x000000000000000000000000000000000000dEaD";

export interface CreateMissionInput {
  title: string;
  description: string;
  projectId?: string;
  allowPaidApi?: boolean;
  budgetXlm?: number;
  paidService?: string;
  paidAmountXlm?: number;
}

interface PendingApprovalPayment {
  denied?: false;
  service: string;
  purpose: string;
  amountXlm: number;
  network: "testnet" | "mainnet";
  missionId: string;
  remainingBudget?: number;
  reason: string;
}

interface DeniedPayment {
  denied: true;
  reason: string;
}

type PendingPayment = PendingApprovalPayment | DeniedPayment;

export interface MissionReport {
  missionId: string;
  status: Mission["status"];
  stages: { stage: MissionStage; summary: string; status: string }[];
  verification?: { status: string; checks: { name: string; pass: boolean; detail: string }[] };
  pendingPayment?: PendingPayment;
}

async function ctxFor(mission: Mission, role?: string): Promise<AgentContext> {
  const repo = getRepository();
  const model = getModelGateway();
  const tools = getToolGateway();
  const emit = async (actor: AuditActor, action: string, detail?: unknown) => {
    await repo.appendAudit({ id: shortId("AE"), at: nowIso(), actor, action, missionId: mission.id, detail: detail as Json | undefined });
  };

  // Look up agent slot for capabilities
  let agentSlot = undefined;
  let capabilities = capabilitiesFor("code");

  if (role) {
    const slots = await repo.listAgentSlots();
    agentSlot = slots.find((s) => s.id === `slot_${role}` || s.role === role);
    if (agentSlot) {
      capabilities = agentSlot.defaultCapabilities || capabilitiesFor(role as AgentRole);
    }
  }

  return {
    mission,
    repo,
    model,
    tools,
    capabilities,
    agentSlot,
    emit,
  };
}

export async function createMission(input: CreateMissionInput): Promise<Mission> {
  const repo = getRepository();
  const ws = await repo.ensureSeedWorkspace();
  const mission = newMission({
    title: input.title,
    description: input.description,
    workspaceId: ws.id,
    projectId: input.projectId,
  });
  mission.budgetXlm = input.budgetXlm ?? 5;
  mission.allowPaidApi = input.allowPaidApi ?? false;
  mission.paidService = input.paidService;
  mission.paidAmountXlm = input.paidAmountXlm;
  mission.pipelineStage = "commander";
  await repo.saveMission(mission);
  await repo.appendAudit({ id: shortId("AE"), at: nowIso(), actor: "user", action: "mission.created", missionId: mission.id });
  return mission;
}

// Run (or resume) a mission through its staged pipeline.
export async function runMission(missionId: string): Promise<MissionReport> {
  const repo = getRepository();
  const mission = await repo.getMission(missionId);
  if (!mission) throw new Error("mission not found");
  const stagesOut: MissionReport["stages"] = [];

  let idx = mission.pipelineStage ? STAGES.indexOf(mission.pipelineStage) : 0;
  if (idx < 0) idx = 0;

  for (; idx < STAGES.length; idx++) {
    const stage = STAGES[idx];
    const task = mission.tasks.find((t) => t.type === stage);
    if (task && task.status === "done" && stage !== "payment" && stage !== "verification") {
      // already completed (e.g. on resume) — skip
      continue;
    }

    let summary = "";
    if (stage === "commander") {
      mission.status = "planning";
      const ctx = await ctxFor(mission, "commander");
      summary = await runAgent("commander", ctx);
    } else if (stage === "research") {
      mission.status = "research";
      const ctx = await ctxFor(mission, "research");
      summary = await runAgent("research", ctx);
    } else if (stage === "payment") {
      const ctx = await ctxFor(mission, "code");
      summary = await runPaymentStage(mission, ctx, stagesOut);
      // payment stage may pause; if it returned a pending payment, stop.
      const pending = mission.pendingPayment as PendingPayment | null | undefined;
      if (pending) {
        mission.status = "awaiting_approval";
        mission.pipelineStage = "payment";
        await repo.saveMission(mission);
        return buildReport(mission, stagesOut, undefined, pending);
      }
    } else if (stage === "code") {
      mission.status = "coding";
      const ctx = await ctxFor(mission, "code");
      summary = await runAgent("code", ctx);
    } else if (stage === "qa") {
      mission.status = "testing";
      const ctx = await ctxFor(mission, "qa");
      summary = await runAgent("qa", ctx);
      // Agent may have mutated mission.status via context — re-read
      if ((mission.status as string) === "failed") break;
    } else if (stage === "deployment") {
      mission.status = "deployment";
      const ctx = await ctxFor(mission, "deployment");
      summary = await runAgent("deployment", ctx);
    } else if (stage === "verification") {
      const ctx = await ctxFor(mission, "verification");
      const v = await verify(mission, ctx);
      mission.verificationStatus = v.status;
      summary = `Verification ${v.status}`;
      stagesOut.push({ stage, summary, status: v.status });
      await repo.appendAudit({ id: shortId("AE"), at: nowIso(), actor: "system", action: "verification", missionId: mission.id, detail: v as unknown as Json });
      if (v.status === "failed") {
        mission.status = "failed";
        break;
      }
    } else if (stage === "stellar") {
      mission.status = "verification";
      const ctx = await ctxFor(mission, "stellar");
      summary = await runAgent("stellar", ctx);
    }

    if (stage !== "payment" && stage !== "verification") {
      stagesOut.push({ stage, summary, status: "done" });
    }
    mission.pipelineStage = STAGES[idx + 1] ?? "done";
    await repo.saveMission(mission);
  }

  if (mission.status !== "failed") {
    mission.status = mission.verificationStatus === "verified" ? "verified" : "completed";
  }
  mission.pipelineStage = "done";
  await repo.saveMission(mission);

  const finalCtx = await ctxFor(mission, "verification");
  const v = await verify(mission, finalCtx);
  return buildReport(mission, stagesOut, v);
}

async function runPaymentStage(mission: Mission, ctx: AgentContext, _stagesOut: MissionReport["stages"]): Promise<string> {
  const allowPaid = mission.allowPaidApi;
  if (!allowPaid) return "no paid API requested";
  const service = mission.paidService || "Repo Analyzer API";
  const amount = Number(mission.paidAmountXlm || 0.25);
  const policy = defaultPolicy();

  const decision = evaluatePayment(policy, {
    service,
    recipient: DEMO_RECIPIENT,
    amountXlm: amount,
    missionBudgetRemainingXlm: mission.budgetXlm,
  });

  if (decision.decision === "approved") {
    const settled = await settlePayment({
      service,
      recipient: DEMO_RECIPIENT,
      amountXlm: amount,
      network: policy.network,
      wallet: operatorAddress(),
    });
    const payment: Payment = {
      id: shortId("PAY"),
      missionId: mission.id,
      service,
      purpose: "External repository analysis",
      amountXlm: amount,
      asset: policy.asset,
      network: policy.network,
      wallet: operatorAddress(),
      recipient: DEMO_RECIPIENT,
      status: "settled",
      txHash: settled.txHash,
      receiptHash: mission.receiptHash,
      createdAt: nowIso(),
      settledAt: nowIso(),
    };
    await ctx.repo.savePayment(payment);
    mission.paymentsXlm += amount;
    await ctx.repo.appendAudit({ id: shortId("AE"), at: nowIso(), actor: "system", action: "payment.settled", missionId: mission.id, detail: payment as unknown as Json });
    return `Payment settled: ${amount} NGN to ${service}`;
  }

  if (decision.decision === "needs_approval") {
    mission.pendingPayment = {
      service,
      purpose: "External repository analysis",
      amountXlm: amount,
      network: policy.network,
      missionId: mission.id,
      remainingBudget: mission.budgetXlm ?? 0,
      reason: decision.reason,
    } satisfies PendingApprovalPayment;
    return "payment requires approval";
  }

  mission.pendingPayment = { denied: true, reason: decision.reason } satisfies DeniedPayment;
  return `payment denied: ${decision.reason}`;
}

// Resume a mission after the user approves a pending payment.
export async function approvePayment(missionId: string): Promise<MissionReport> {
  const repo = getRepository();
  const mission = await repo.getMission(missionId);
  if (!mission) throw new Error("mission not found");
  const pending = mission.pendingPayment as PendingPayment | null | undefined;
  if (!pending || pending.denied) throw new Error("no pending payment");
  const policy = defaultPolicy();

  const settled = await settlePayment({
    service: pending.service,
    recipient: DEMO_RECIPIENT,
    amountXlm: pending.amountXlm,
    network: pending.network,
    wallet: operatorAddress(),
  });
  const payment: Payment = {
    id: shortId("PAY"),
    missionId: mission.id,
    service: pending.service,
    purpose: pending.purpose,
    amountXlm: pending.amountXlm,
    asset: policy.asset,
    network: pending.network,
    wallet: operatorAddress(),
    recipient: DEMO_RECIPIENT,
    status: "settled",
    txHash: settled.txHash,
    receiptHash: mission.receiptHash,
    createdAt: nowIso(),
    settledAt: nowIso(),
  };
  await repo.savePayment(payment);
  mission.paymentsXlm += pending.amountXlm;
  mission.pendingPayment = null;
  mission.approvedPayments = [...(mission.approvedPayments ?? []), pending.service];
  await repo.appendAudit({ id: shortId("AE"), at: nowIso(), actor: "user", action: "payment.approved", missionId: mission.id, detail: payment as unknown as Json });
  await repo.saveMission(mission);

  return runMission(missionId);
}

function buildReport(
  mission: Mission,
  stages: MissionReport["stages"],
  verification?: { status: string; checks: { name: string; pass: boolean; detail: string }[] },
  pendingPayment?: PendingPayment,
): MissionReport {
  return {
    missionId: mission.id,
    status: mission.status,
    stages,
    verification,
    pendingPayment,
  };
}
