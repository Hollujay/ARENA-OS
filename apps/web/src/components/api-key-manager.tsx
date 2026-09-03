"use client";

import { useState } from "react";
import { Panel, PanelHeader, Badge } from "@/components/ui";
import type { ApiKey } from "@domain/index";

interface Props {
  apiKeys: ApiKey[];
  workspaceId: string;
}

export function ApiKeyManager({ apiKeys: initialKeys, workspaceId }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"live" | "test">("test");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          environment: newKeyEnv,
          workspaceId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.key) {
        setCreatedKey(data.key);
        setKeys((prev) => [...prev, data.apiKey]);
        setNewKeyName("");
        setShowCreate(false);
      }
    } catch {
      // Error handled silently
    }
    setCreating(false);
  }

  async function revokeKey(id: string) {
    const res = await fetch(`/api/v1/api-keys/${id}/revoke`, { method: "POST" });
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)));
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Arena API Keys"
        subtitle="Scoped, expiring keys for external agents. Keys are never shown in full after creation."
        right={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-md bg-arena-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-arena-blue/90"
          >
            {showCreate ? "Cancel" : "Create API Key"}
          </button>
        }
      />

      {showCreate && (
        <div className="px-5 py-4 border-b border-arena-border bg-arena-bg/40">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-arena-muted">Name</label>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. CI Pipeline"
                className="mt-1 block rounded-md bg-arena-bg/60 border border-arena-border px-3 py-1.5 text-sm text-arena-text focus:outline-none focus:border-arena-blue/60"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wider text-arena-muted">Environment</label>
              <select
                value={newKeyEnv}
                onChange={(e) => setNewKeyEnv(e.target.value as "live" | "test")}
                className="mt-1 block rounded-md bg-arena-bg/60 border border-arena-border px-3 py-1.5 text-sm text-arena-text"
              >
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
            <button
              onClick={createKey}
              disabled={creating || !newKeyName.trim()}
              className="rounded-md bg-arena-blue px-4 py-1.5 text-sm font-medium text-white hover:bg-arena-blue/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {createdKey && (
        <div className="px-5 py-3 border-b border-arena-border bg-arena-green/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-arena-green font-medium">Key created — copy it now, it won&apos;t be shown again:</div>
              <code className="mt-1 block text-sm font-mono text-arena-text break-all">{createdKey}</code>
            </div>
            <button onClick={() => setCreatedKey(null)} className="text-xs text-arena-muted hover:text-arena-text">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-arena-border">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-arena-text">{k.name}</div>
              <div className="text-xs text-arena-muted font-mono">{k.prefix}</div>
            </div>
            <div className="hidden sm:flex gap-2">
              {k.scopes?.map((s) => (
                <Badge key={s} tone="cyan">{s}</Badge>
              ))}
            </div>
            <Badge tone={k.environment === "live" ? "green" : "amber"}>{k.environment}</Badge>
            <Badge tone={k.revoked ? "red" : "default"}>{k.revoked ? "revoked" : "active"}</Badge>
            {!k.revoked && (
              <button onClick={() => revokeKey(k.id)} className="text-xs text-arena-red hover:text-arena-red/80 font-medium">
                Revoke
              </button>
            )}
          </div>
        ))}
        {keys.length === 0 && <div className="px-5 py-8 text-sm text-arena-muted">No API keys.</div>}
      </div>
    </Panel>
  );
}
