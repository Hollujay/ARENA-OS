import { getRepository } from "@db/index";
import { Badge, StatusDot, Panel } from "@/components/ui";
import Link from "next/link";
import { MissionsFilter } from "@/components/missions-filter";

export const dynamic = "force-dynamic";

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const repo = getRepository();
  const ws = await repo.ensureSeedWorkspace();
  let missions = await repo.listMissions(ws.id);

  if (params.status) {
    missions = missions.filter((m) => m.status === params.status);
  }

  const allMissions = await repo.listMissions(ws.id);
  const counts = {
    all: allMissions.length,
    active: allMissions.filter(
      (m) => !["completed", "verified", "failed"].includes(m.status)
    ).length,
    completed: allMissions.filter((m) =>
      ["completed", "verified"].includes(m.status)
    ).length,
    failed: allMissions.filter((m) => m.status === "failed").length,
    awaiting: allMissions.filter((m) => m.status === "awaiting_approval")
      .length,
  };

  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="arena-label">MISSIONS</span>
            <p className="text-[11px] text-arena-secondary mt-0.5">
              {missions.length} total · {counts.active} active
            </p>
          </div>
          <MissionsFilter activeFilter={params.status} counts={counts} />
        </div>

        {/* Mission Table */}
        <Panel>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-arena-border">
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-medium tracking-[0.08em] uppercase text-arena-muted">
                    MISSION
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-medium tracking-[0.08em] uppercase text-arena-muted">
                    STATUS
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-medium tracking-[0.08em] uppercase text-arena-muted">
                    AGENTS
                  </th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] font-medium tracking-[0.08em] uppercase text-arena-muted">
                    PHASE
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[9px] font-medium tracking-[0.08em] uppercase text-arena-muted">
                    COST
                  </th>
                  <th className="px-4 py-2 text-right font-mono text-[9px] font-medium tracking-[0.08em] uppercase text-arena-muted">
                    CREATED
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arena-border/30">
                {missions.map((m) => (
                  <tr
                    key={m.id}
                    className="relative hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/missions/${m.id}`}
                        className="absolute inset-0 z-10"
                        aria-label={`View mission ${m.id}: ${m.title}`}
                      />
                      <div className="flex items-center gap-2 relative">
                        <StatusDot
                          tone={
                            m.status === "failed"
                              ? "red"
                              : ["completed", "verified"].includes(m.status)
                                ? "green"
                                : "green"
                          }
                          pulse={
                            !["completed", "verified", "failed"].includes(
                              m.status
                            )
                          }
                        />
                        <div>
                          <div className="text-arena-text truncate max-w-[300px]">
                            {m.title}
                          </div>
                          <div className="font-mono text-[9px] text-arena-muted">
                            {m.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge
                        tone={
                          m.status === "failed"
                            ? "red"
                            : ["completed", "verified"].includes(m.status)
                              ? "green"
                              : "green"
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {m.agents.slice(0, 3).map((a) => (
                          <span
                            key={a}
                            className="font-mono text-[9px] text-arena-secondary"
                          >
                            {a}
                          </span>
                        ))}
                        {m.agents.length > 3 && (
                          <span className="font-mono text-[9px] text-arena-muted">
                            +{m.agents.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[10px] text-arena-secondary capitalize">
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-mono text-[10px] text-arena-text">
                        {m.costUsd > 0 ? `$${m.costUsd.toFixed(2)}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="font-mono text-[9px] text-arena-muted">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                ))}
                {missions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-arena-muted"
                    >
                      <div className="font-mono text-[10px] uppercase tracking-wider">
                        No missions found
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
