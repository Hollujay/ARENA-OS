"use client";

import { useState } from "react";
import { Panel, PanelHeader, Badge } from "@/components/ui";

const CATEGORIES = [
  { value: "web3", label: "Web3" },
  { value: "ai", label: "AI Tooling" },
  { value: "full-stack", label: "Full-Stack" },
  { value: "devtools", label: "Developer Tools" },
  { value: "infra", label: "Infrastructure" },
  { value: "other", label: "Other" },
];

interface ExhibitionAdminProps {
  workspaceId: string;
}

export function ExhibitionAdmin({ workspaceId: _workspaceId }: ExhibitionAdminProps) {
  const [projects, setProjects] = useState<
    Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      featured: boolean;
      repoUrl: string;
      liveUrl: string;
      arenaInvolvement: string;
      techStack: string[];
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "other",
    repoUrl: "",
    liveUrl: "",
    arenaInvolvement: "",
    techStack: "",
    featured: true,
  });

  async function loadProjects() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/exhibition");
      const data = await res.json();
      setProjects(data);
    } catch {
      /* empty */
    }
    setLoading(false);
  }

  async function createProject() {
    await fetch("/api/v1/exhibition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description,
        category: form.category,
        repoUrl: form.repoUrl || undefined,
        liveUrl: form.liveUrl || undefined,
        arenaInvolvement: form.arenaInvolvement || undefined,
        techStack: form.techStack
          ? form.techStack.split(",").map((s) => s.trim())
          : [],
        featured: form.featured,
      }),
    });
    setForm({
      name: "",
      description: "",
      category: "other",
      repoUrl: "",
      liveUrl: "",
      arenaInvolvement: "",
      techStack: "",
      featured: true,
    });
    setShowForm(false);
    loadProjects();
  }

  return (
    <Panel>
      <PanelHeader
        title="Exhibition"
        subtitle="Manage featured projects shown on the public /exhibition page"
      />
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={loadProjects}
            className="px-3 py-1.5 rounded border border-arena-border text-xs text-arena-muted hover:text-arena-text hover:bg-white/5 transition-colors"
          >
            {loading ? "Loading…" : "Load Projects"}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded bg-arena-blue/10 border border-arena-blue/20 text-xs text-arena-blue hover:bg-arena-blue/20 transition-colors"
          >
            + Add Featured Project
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="p-4 rounded-lg bg-arena-bg/50 border border-arena-border mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Project name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-blue/30"
              />
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value })
                }
                className="px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text focus:outline-none focus:border-arena-blue/30"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              placeholder="Short description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-blue/30 resize-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="GitHub repo URL"
                value={form.repoUrl}
                onChange={(e) => setForm({ ...form, repoUrl: e.target.value })}
                className="px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-blue/30"
              />
              <input
                type="text"
                placeholder="Live URL (optional)"
                value={form.liveUrl}
                onChange={(e) => setForm({ ...form, liveUrl: e.target.value })}
                className="px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-blue/30"
              />
            </div>
            <textarea
              placeholder="How Arena OS was involved (optional)"
              value={form.arenaInvolvement}
              onChange={(e) =>
                setForm({ ...form, arenaInvolvement: e.target.value })
              }
              rows={2}
              className="w-full px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-blue/30 resize-none"
            />
            <input
              type="text"
              placeholder="Tech stack (comma-separated)"
              value={form.techStack}
              onChange={(e) => setForm({ ...form, techStack: e.target.value })}
              className="w-full px-3 py-2 rounded bg-arena-panel border border-arena-border text-sm text-arena-text placeholder:text-arena-muted/50 focus:outline-none focus:border-arena-blue/30"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-arena-muted">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) =>
                    setForm({ ...form, featured: e.target.checked })
                  }
                  className="rounded border-arena-border"
                />
                Featured (shown on public exhibition page)
              </label>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 rounded border border-arena-border text-xs text-arena-muted hover:text-arena-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={!form.name}
                  className="px-3 py-1.5 rounded bg-arena-blue/20 border border-arena-blue/30 text-xs text-arena-blue hover:bg-arena-blue/30 transition-colors disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Project list */}
        {projects.length > 0 && (
          <div className="divide-y divide-arena-border/50">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-arena-text truncate">
                      {p.name}
                    </span>
                    <Badge tone={p.featured ? "green" : "default"}>
                      {p.featured ? "Featured" : "Draft"}
                    </Badge>
                  </div>
                  <p className="text-xs text-arena-muted truncate">
                    {p.description || "No description"}
                  </p>
                </div>
                {p.repoUrl && (
                  <a
                    href={p.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-arena-muted hover:text-arena-blue ml-4 shrink-0"
                  >
                    ↗ repo
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {projects.length === 0 && !loading && (
          <p className="text-xs text-arena-muted/60 py-4 text-center">
            No projects loaded. Click &quot;Load Projects&quot; to fetch.
          </p>
        )}
      </div>
    </Panel>
  );
}
