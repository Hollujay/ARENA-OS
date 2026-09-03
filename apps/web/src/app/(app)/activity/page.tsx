import { Panel } from "@/components/ui";
import { ActivityFeed } from "@/components/activity-feed";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string; agent?: string; tool?: string }>;
}) {
  // Was declaring this prop and then ignoring it, hardcoding every filter to
  // undefined — a real bug, not just unused-var noise: linking to
  // /activity?mission=M123 silently did nothing.
  const params = await searchParams;

  return (
    <div className="min-h-screen">
      <div className="px-6 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="arena-label">ACTIVITY / AUDIT</span>
            <p className="text-[11px] text-arena-secondary mt-0.5">
              Real-time event stream · agents, tools, payments, Stellar
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FilterChip label="ALL" active />
            <FilterChip label="AGENTS" />
            <FilterChip label="TOOLS" />
            <FilterChip label="PAYMENTS" />
            <FilterChip label="STELLAR" />
            <div className="flex items-center gap-1.5 ml-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-arena-green animate-pulse" />
              <span className="font-mono text-[9px] text-arena-muted">
                LIVE
              </span>
            </div>
          </div>
        </div>

        <Panel>
          <div className="p-2">
            <ActivityFeed mission={params.mission} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`px-2 py-1 rounded font-mono text-[9px] transition-colors ${
        active
          ? "bg-arena-green/10 text-arena-green border border-arena-green/30"
          : "bg-arena-inset text-arena-muted border border-arena-border hover:text-arena-secondary"
      }`}
    >
      {label}
    </button>
  );
}
