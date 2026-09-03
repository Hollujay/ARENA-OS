"use client";

import Link from "next/link";

interface Props {
  activeFilter?: string;
  counts: {
    all: number;
    active: number;
    completed: number;
    failed: number;
    awaiting: number;
  };
}

const TABS = [
  { key: undefined, label: "All" },
  { key: "planning", label: "Planning" },
  { key: "research", label: "Research" },
  { key: "coding", label: "Coding" },
  { key: "testing", label: "Testing" },
  { key: "deployment", label: "Deployment" },
  { key: "completed", label: "Completed" },
  { key: "verified", label: "Verified" },
  { key: "awaiting_approval", label: "Awaiting" },
  { key: "failed", label: "Failed" },
];

// `counts` isn't rendered yet — the 10 tab keys here (lifecycle stages) don't
// map 1:1 onto the 5 aggregate buckets the caller computes (all/active/
// completed/failed/awaiting), so wiring per-tab counts needs a small design
// decision (which tabs get a badge, how "active" splits across 5 stages)
// rather than a mechanical fix. Flagged, not guessed at.
export function MissionsFilter({ activeFilter, counts: _counts }: Props) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const active = activeFilter === tab.key;
        const href = tab.key ? `/missions?status=${tab.key}` : "/missions";
        return (
          <Link
            key={tab.label}
            href={href}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-arena-blue/15 text-arena-blue"
                : "text-arena-muted hover:text-arena-text hover:bg-white/5"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
