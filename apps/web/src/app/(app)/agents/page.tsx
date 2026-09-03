import { AGENT_REGISTRY } from "@domain/index";
import { Panel, Badge, StatusDot } from "@/components/ui";

const AGENT_ICONS: Record<string, string> = {
  commander: "⬡",
  research: "◎",
  code: "◈",
  qa: "▣",
  deployment: "✦",
  stellar: "◇",
  planner: "▣",
};

export default function AgentsPage() {
  const agents = Object.values(AGENT_REGISTRY);
  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-4">
        <div>
          <span className="arena-label">AGENTS</span>
          <p className="text-[11px] text-arena-secondary mt-0.5">
            {agents.length} registered · scoped permissions · independent
            execution
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((a) => {
            const isActive = ["commander", "code", "research"].includes(
              a.role
            );
            return (
              <Panel
                key={a.role}
                className={isActive ? "arena-glow-green" : ""}
              >
                <div className="px-4 py-3 border-b border-arena-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-arena-green text-sm">
                      {AGENT_ICONS[a.role] || "◈"}
                    </span>
                    <div>
                      <div className="font-mono text-[10px] font-medium tracking-[0.08em] uppercase text-arena-text">
                        {a.name}
                      </div>
                      <div className="font-mono text-[8px] text-arena-muted">
                        {a.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusDot tone={isActive ? "green" : "muted"} pulse={isActive} />
                    <span className="font-mono text-[9px] text-arena-muted">
                      {isActive ? "ACTIVE" : "IDLE"}
                    </span>
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2.5">
                  <p className="text-[11px] text-arena-secondary leading-relaxed">
                    {a.description}
                  </p>

                  <div className="space-y-1">
                    <span className="arena-label text-[8px]">
                      CAPABILITIES
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {a.defaultCapabilities.slice(0, 6).map((c) => (
                        <Badge key={c} tone="green">
                          {c.split(":").pop()}
                        </Badge>
                      ))}
                      {a.defaultCapabilities.length > 6 && (
                        <span className="font-mono text-[8px] text-arena-muted">
                          +{a.defaultCapabilities.length - 6}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-arena-border/30">
                    <span className="font-mono text-[9px] text-arena-muted">
                      model: {a.defaultModelRole}
                    </span>
                    <span className="font-mono text-[9px] text-arena-muted">
                      {a.defaultCapabilities.length} capabilities
                    </span>
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
