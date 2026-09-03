"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  projects: { id: string; name: string }[];
  providers: { provider: string; label: string; connected: boolean }[];
}

const SHORTCUTS = ["BUILD", "DEPLOY", "RESEARCH", "AUDIT", "REFACTOR", "TEST"];

export function CommandBar({ projects }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  async function run() {
    if (!text.trim() || running) return;
    setRunning(true);
    setError(null);
    const spendMatch = text.match(/(\d+(?:\.\d+)?)\s*NGN/i);
    const allowPaidApi = !!spendMatch;
    const budgetXlm = spendMatch ? Number(spendMatch[1]) : 5;
    try {
      const res = await fetch("/api/v1/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: text.slice(0, 80),
          description: text,
          projectId: projectId || undefined,
          allowPaidApi,
          budgetXlm,
          paidAmountXlm: allowPaidApi ? Math.min(0.25, budgetXlm) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "mission failed");
      router.push(`/missions/${data.mission.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setRunning(false);
    }
  }

  return (
    <div className="bg-arena-panel border border-arena-border rounded-lg">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-arena-border flex items-center justify-between">
        <span className="arena-label">MISSION INPUT</span>
        <div className="flex items-center gap-2 font-mono text-[9px] text-arena-muted">
          <span>⌘ ENTER TO RUN</span>
        </div>
      </div>

      {/* Input area */}
      <div className="p-4">
        <div
          className={`arena-inset rounded-md transition-colors ${focused ? "arena-glow-green" : ""}`}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) run();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What do you want Arena to accomplish?"
            className="w-full resize-none bg-transparent px-4 py-3 text-sm text-arena-text placeholder:text-arena-muted/40 focus:outline-none font-mono"
            rows={2}
          />
        </div>

        {/* Shortcuts */}
        <div className="flex items-center gap-1.5 mt-3">
          {SHORTCUTS.map((s) => (
            <button
              key={s}
              onClick={() => setText((t) => (t ? `${t} /${s.toLowerCase()} ` : `/${s.toLowerCase()} `))}
              className="px-2 py-1 rounded bg-arena-inset border border-arena-border font-mono text-[9px] text-arena-muted hover:text-arena-green hover:border-arena-green/30 transition-colors"
            >
              {s}
            </button>
          ))}
          <div className="flex-1" />
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="bg-arena-inset border border-arena-border rounded px-2 py-1 font-mono text-[10px] text-arena-secondary focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-between mt-3">
          {error && (
            <span className="font-mono text-[10px] text-arena-red">
              {error}
            </span>
          )}
          <div className="flex-1" />
          <button
            onClick={run}
            disabled={running || !text.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-arena-green/15 text-arena-green border border-arena-green/30 font-mono text-[11px] font-medium hover:bg-arena-green/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {running ? (
              <>
                <span className="inline-block h-3 w-3 border-2 border-arena-green/30 border-t-arena-green rounded-full animate-spin" />
                EXECUTING
              </>
            ) : (
              "▶ RUN MISSION"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
