import { getRepository } from "@db/index";
import { Panel, PanelHeader, Badge, StatusDot } from "@/components/ui";
import { ActivityFeed } from "@/components/activity-feed";
import { ApproveButton } from "@/components/approve-button";
import { notFound } from "next/navigation";
import type { MissionStatus } from "@domain/index";

export const dynamic = "force-dynamic";

interface PendingPaymentDisplay {
  service: string;
  purpose: string;
  amountXlm: number;
}

const PHASE_ORDER: { key: MissionStatus; label: string; icon: string }[] = [
  { key: "planning", label: "PLANNING", icon: "◇" },
  { key: "research", label: "RESEARCH", icon: "◎" },
  { key: "coding", label: "CODING", icon: "◈" },
  { key: "testing", label: "TESTING", icon: "▣" },
  { key: "deployment", label: "DEPLOY", icon: "✦" },
  { key: "verification", label: "VERIFY", icon: "✷" },
];

function phaseIndex(status: MissionStatus): number {
  const idx = PHASE_ORDER.findIndex((p) => p.key === status);
  return idx >= 0 ? idx : -1;
}

export default async function MissionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repo = getRepository();
  const mission = await repo.getMission(id);
  if (!mission) notFound();

  const pending = mission.pendingPayment as unknown as PendingPaymentDisplay | null;
  const tasks = mission.tasks ?? [];
  const currentIdx = phaseIndex(mission.status);
  const isTerminal = ["completed", "verified", "failed"].includes(
    mission.status
  );

  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-4">
        {/* Mission header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="arena-label">MISSION</span>
              <span className="font-mono text-[10px] text-arena-muted">
                /
              </span>
              <span className="font-mono text-[10px] text-arena-green">
                {mission.id}
              </span>
            </div>
            <h1 className="text-[15px] font-medium text-arena-text">
              {mission.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              tone={
                mission.status === "failed"
                  ? "red"
                  : ["completed", "verified"].includes(mission.status)
                    ? "green"
                    : "green"
              }
            >
              {mission.status}
            </Badge>
            {!isTerminal && (
              <button className="px-3 py-1.5 rounded bg-arena-inset border border-arena-border font-mono text-[10px] text-arena-muted hover:text-arena-text transition-colors">
                PAUSE
              </button>
            )}
          </div>
        </div>

        {/* Phase tracker */}
        <div className="bg-arena-panel border border-arena-border rounded-lg p-4">
          <div className="flex items-center gap-0">
            {PHASE_ORDER.map((phase, i) => {
              const isActive = i === currentIdx;
              const isDone = i < currentIdx || isTerminal;
              return (
                <div
                  key={phase.key}
                  className="flex items-center flex-1"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono border transition-all ${
                        isDone
                          ? "bg-arena-green/15 border-arena-green/40 text-arena-green"
                          : isActive
                            ? "bg-arena-green/20 border-arena-green text-arena-green arena-glow-green"
                            : "bg-arena-inset border-arena-border text-arena-muted"
                      }`}
                    >
                      {isDone ? "✓" : phase.icon}
                    </div>
                    <span
                      className={`font-mono text-[8px] tracking-[0.08em] uppercase ${
                        isDone || isActive ? "text-arena-green" : "text-arena-muted"
                      }`}
                    >
                      {phase.label}
                    </span>
                  </div>
                  {i < PHASE_ORDER.length - 1 && (
                    <div
                      className={`flex-1 h-px mx-2 ${
                        isDone ? "bg-arena-green/40" : "bg-arena-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment approval */}
        {mission.status === "awaiting_approval" && pending && (
          <div className="bg-arena-red/5 border border-arena-red/30 rounded-lg p-4 arena-glow-red">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-arena-red">
                PAYMENT APPROVAL REQUIRED
              </span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-arena-muted">SERVICE</span>
                <span className="text-arena-text">{pending.service}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arena-muted">PURPOSE</span>
                <span className="text-arena-text">{pending.purpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-arena-muted">AMOUNT</span>
                <span className="text-arena-green">
                  {pending.amountXlm} NGN
                </span>
              </div>
            </div>
            <div className="mt-3">
              <ApproveButton missionId={mission.id} />
            </div>
          </div>
        )}

        {/* Content grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Left: Task graph + Audit */}
          <div className="col-span-2 space-y-4">
            <Panel>
              <PanelHeader title="TASK GRAPH" subtitle="Planned and executed steps" />
              <div className="divide-y divide-arena-border/30">
                {tasks.length === 0 && (
                  <StepRow
                    stage="commander"
                    title={mission.title}
                    status={
                      mission.status === "failed" ? "failed" : "running"
                    }
                  />
                )}
                {tasks.map((t) => (
                  <StepRow
                    key={t.id}
                    stage={t.type}
                    title={t.title}
                    status={t.status}
                    agent={t.agentRole}
                  />
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="AUDIT TRAIL" subtitle="Every action recorded" />
              <div className="p-2">
                <ActivityFeed mission={mission.id} />
              </div>
            </Panel>
          </div>

          {/* Right: Cost + Evidence */}
          <div className="space-y-4">
            {/* Cost breakdown */}
            <Panel>
              <PanelHeader title="COST BREAKDOWN" />
              <div className="p-3 space-y-2">
                <CostRow label="AI COST" value={`$${mission.costUsd.toFixed(2)}`} />
                <CostRow label="STELLAR" value={`${mission.paymentsXlm.toFixed(2)} NGN`} />
                <CostRow label="FILES" value={`${mission.filesChanged}`} />
                <CostRow
                  label="TESTS"
                  value={`${mission.testsPassed}/${mission.testsPassed + mission.testsFailed}`}
                  tone={mission.testsFailed > 0 ? "red" : "green"}
                />
                <div className="pt-2 border-t border-arena-border/30 flex justify-between">
                  <span className="arena-label text-[8px]">TOTAL</span>
                  <span className="font-mono text-[11px] text-arena-text">
                    ${mission.costUsd.toFixed(2)}
                  </span>
                </div>
              </div>
            </Panel>

            {/* Mission evidence */}
            <Panel>
              <PanelHeader title="EVIDENCE" />
              <div className="p-3 space-y-2.5">
                <EvidenceRow
                  label="VERIFICATION"
                  value={
                    <Badge
                      tone={
                        mission.verificationStatus === "verified"
                          ? "green"
                          : mission.verificationStatus === "failed"
                            ? "red"
                            : "amber"
                      }
                    >
                      {mission.verificationStatus}
                    </Badge>
                  }
                />
                <EvidenceRow
                  label="DEPLOYMENT"
                  value={
                    mission.deploymentUrl ? (
                      <a
                        className="font-mono text-[9px] text-arena-green break-all"
                        href={mission.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {mission.deploymentUrl}
                      </a>
                    ) : (
                      <span className="text-arena-muted">—</span>
                    )
                  }
                />
                <EvidenceRow
                  label="RECEIPT"
                  value={
                    mission.receiptHash ? (
                      <span className="font-mono text-[9px] text-arena-green break-all">
                        {mission.receiptHash}
                      </span>
                    ) : (
                      <span className="text-arena-muted">—</span>
                    )
                  }
                />
                <EvidenceRow
                  label="STELLAR TX"
                  value={
                    mission.stellarTx ? (
                      <span className="font-mono text-[9px] text-arena-green break-all">
                        {mission.stellarTx}
                      </span>
                    ) : (
                      <span className="text-arena-muted">—</span>
                    )
                  }
                />
                <EvidenceRow
                  label="MODELS"
                  value={
                    <span className="font-mono text-[9px] text-arena-secondary">
                      {mission.modelsUsed.join(", ") || "—"}
                    </span>
                  }
                />
                <EvidenceRow
                  label="TOOLS"
                  value={
                    <div className="flex flex-wrap gap-1 justify-end">
                      {mission.toolsUsed.map((t) => (
                        <span
                          key={t}
                          className="font-mono text-[8px] text-arena-green bg-arena-green/10 px-1.5 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  }
                />
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  stage,
  title,
  status,
  agent,
}: {
  stage: string;
  title: string;
  status: string;
  agent?: string;
}) {
  const tone: "green" | "red" | "amber" | "muted" =
    status === "done" || status === "success"
      ? "green"
      : status === "failed"
        ? "red"
        : status === "running"
          ? "amber"
          : "muted";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <StatusDot tone={tone} pulse={status === "running"} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-arena-text truncate">{title}</div>
        <div className="font-mono text-[9px] text-arena-muted">
          {stage}
          {agent ? ` · ${agent}` : ""}
        </div>
      </div>
      <Badge tone={tone}>{status}</Badge>
    </div>
  );
}

function CostRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="arena-label text-[8px]">{label}</span>
      <span
        className={`font-mono text-[11px] ${tone === "red" ? "text-arena-red" : tone === "green" ? "text-arena-green" : "text-arena-text"}`}
      >
        {value}
      </span>
    </div>
  );
}

function EvidenceRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="arena-label text-[8px] shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
