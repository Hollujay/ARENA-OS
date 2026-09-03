import type { ReactNode } from "react";
import { getRepository, providerStatus } from "@db/index";
import { CommandBar } from "@/components/command-bar";
import { Panel, PanelHeader, Badge, StatusDot } from "@/components/ui";
import { ActivityFeed } from "@/components/activity-feed";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CommandCenter() {
  const repo = getRepository();
  const ws = await repo.ensureSeedWorkspace();
  const [missions, projects, providers, payments, stellar] = await Promise.all([
    repo.listMissions(ws.id),
    repo.listProjects(ws.id),
    Promise.resolve(providerStatus()),
    repo.listPayments(),
    repo.listStellarTx(),
  ]);

  const active = missions.filter(
    (m) => !["completed", "verified", "failed"].includes(m.status)
  );
  const completed = missions.filter((m) =>
    ["completed", "verified"].includes(m.status)
  );
  const todayPayments = payments
    .filter((p) => isToday(p.createdAt))
    .reduce((s, p) => s + p.amountXlm, 0);

  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-5">
        {/* Command Input */}
        <CommandBar
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          providers={providers}
        />

        {/* Stats Row */}
        <div className="grid grid-cols-5 gap-3">
          <MetricCard
            label="ACTIVE MISSIONS"
            value={active.length}
            sub={`${completed.length} completed`}
            tone="green"
          />
          <MetricCard
            label="AI USAGE (24H)"
            value="$0.00"
            sub="awaiting provider"
            tone="default"
          />
          <MetricCard
            label="TOOL CALLS (24H)"
            value={aggregateTools(missions).reduce((s, u) => s + u.calls, 0)}
            sub={`${aggregateTools(missions).length} tools`}
            tone="default"
          />
          <MetricCard
            label="TODAY'S SPEND"
            value={`${todayPayments.toFixed(2)} NGN`}
            sub={`${payments.length} txns`}
            tone="green"
          />
          <MetricCard
            label="STELLAR ANCHORS"
            value={stellar.length}
            sub="receipts on-chain"
            tone="default"
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-3 gap-4">
          {/* Recent Missions */}
          <Panel className="col-span-2">
            <PanelHeader
              title="RECENT MISSIONS"
              subtitle="Live mission status"
              right={
                <Link
                  href="/missions"
                  className="font-mono text-[9px] text-arena-muted hover:text-arena-green transition-colors"
                >
                  VIEW ALL →
                </Link>
              }
            />
            <div className="divide-y divide-arena-border/50">
              {missions.slice(0, 8).map((m) => (
                <Link
                  key={m.id}
                  href={`/missions/${m.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
                >
                  <StatusDot
                    tone={
                      m.status === "completed" || m.status === "verified"
                        ? "green"
                        : m.status === "failed"
                          ? "red"
                          : "green"
                    }
                    pulse={!["completed", "verified", "failed"].includes(m.status)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-arena-text truncate">
                      {m.title}
                    </div>
                    <div className="font-mono text-[10px] text-arena-muted">
                      {m.id}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] text-arena-secondary">
                    {m.agents?.length || 0} agents
                  </div>
                  <Badge
                    tone={
                      m.status === "completed" || m.status === "verified"
                        ? "green"
                        : m.status === "failed"
                          ? "red"
                          : "green"
                    }
                  >
                    {m.status}
                  </Badge>
                  <div className="font-mono text-[10px] text-arena-muted w-16 text-right">
                    {m.costUsd > 0 ? `$${m.costUsd.toFixed(2)}` : "—"}
                  </div>
                </Link>
              ))}
              {missions.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <div className="font-mono text-[10px] text-arena-muted uppercase tracking-wider">
                    No missions yet
                  </div>
                  <div className="text-[11px] text-arena-muted/60 mt-1">
                    Use the command input above to start one
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Agent Network */}
          <Panel>
            <PanelHeader title="AGENT NETWORK" subtitle="Orchestration topology" />
            <div className="p-4">
              {/* Commander node */}
              <div className="flex justify-center mb-4">
                <div className="arena-inset px-4 py-2 rounded-md text-center">
                  <div className="font-mono text-[10px] text-arena-green font-medium">
                    COMMANDER
                  </div>
                  <div className="font-mono text-[9px] text-arena-muted mt-0.5">
                    planner · router
                  </div>
                </div>
              </div>

              {/* Connection lines */}
              <div className="flex justify-center">
                <div className="w-px h-4 bg-arena-green/30" />
              </div>

              {/* Agent nodes */}
              <div className="space-y-1">
                {[
                  { name: "RESEARCH", desc: "analysis · summarization", active: true },
                  { name: "CODE", desc: "implementation · refactoring", active: true },
                  { name: "QA", desc: "testing · verification", active: false },
                  { name: "DEPLOYMENT", desc: "railway · render · vercel", active: false },
                  { name: "STELLAR", desc: "receipt anchoring", active: false },
                  { name: "PLANNER", desc: "conversation · planning", active: false },
                ].map((agent) => (
                  <div key={agent.name} className="flex items-center gap-2">
                    <div className="w-4 flex justify-center">
                      <div className="w-px h-3 bg-arena-border" />
                    </div>
                    <div
                      className={`flex-1 arena-inset px-3 py-1.5 rounded flex items-center gap-2 ${agent.active ? "arena-glow-green" : ""}`}
                    >
                      <StatusDot tone={agent.active ? "green" : "muted"} />
                      <div>
                        <div className="font-mono text-[10px] text-arena-text">
                          {agent.name}
                        </div>
                        <div className="font-mono text-[8px] text-arena-muted">
                          {agent.desc}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Activity Stream */}
        <Panel>
          <PanelHeader title="ACTIVITY STREAM" subtitle="Real-time event feed" />
          <div className="p-2">
            <ActivityFeed mission={undefined} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const toneColor: Record<string, string> = {
    default: "text-arena-text",
    green: "text-arena-green",
    red: "text-arena-red",
    amber: "text-yellow-400",
  };
  return (
    <div className="bg-arena-panel border border-arena-border rounded-lg px-3 py-3">
      <div className="arena-label mb-1.5">{label}</div>
      <div className={`font-mono text-xl font-semibold ${toneColor[tone]}`}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[9px] text-arena-muted mt-1">{sub}</div>
      )}
    </div>
  );
}

function aggregateTools(missions: { toolsUsed: string[] }[]) {
  const map = new Map<string, number>();
  for (const m of missions)
    for (const t of m.toolsUsed) map.set(t, (map.get(t) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([tool, calls]) => ({ tool, calls }))
    .sort((a, b) => b.calls - a.calls);
}

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}
