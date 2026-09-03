"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Panel, PanelHeader, Badge, StatusDot } from "@/components/ui";

interface CustomApi {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  authType: string;
  status: string;
  createdAt: string;
  // Enriched fields
  endpoints?: unknown[];
  endpointCount?: number;
  assignedAgent?: string | null;
  assignedAgentId?: string | null;
  assignmentCount?: number;
}

interface AgentSlot {
  id: string;
  name: string;
  description: string;
  role: string;
  isCustom: boolean;
  modelPreference: string;
  budget: number;
  apiCount: number;
  apis: { id: string; name: string }[];
}

interface Assignment {
  id: string;
  customApiId: string;
  agentId: string;
  grantedCapabilities: string[];
  apiName?: string;
  agentName?: string;
}

interface Props {
  apis: CustomApi[];
  agentSlots: AgentSlot[];
  assignments: Assignment[];
  workspaceId: string;
}

export function CustomApisManager({ apis: initialApis, agentSlots: initialSlots, assignments: initialAssignments, workspaceId: _workspaceId }: Props) {
  const router = useRouter();
  const [apis, setApis] = useState(initialApis);
  const [slots, setSlots] = useState(initialSlots);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [view, setView] = useState<"apis" | "agents">("apis");
  const [showAddApi, setShowAddApi] = useState(false);
  const [showCreateAgent, setShowCreateAgent] = useState(false);

  // Add API form state
  const [newApi, setNewApi] = useState({
    name: "",
    description: "",
    baseUrl: "",
    authType: "none",
    credentialReference: "",
    assignedAgentId: "",
  });

  // Create Agent form state
  const [newAgent, setNewAgent] = useState({
    name: "",
    description: "",
    role: "",
    modelPreference: "auto",
    budget: 5,
    timeoutMs: 120000,
    retryLimit: 2,
  });

  async function createApi() {
    if (!newApi.name || !newApi.baseUrl) return;
    const res = await fetch("/api/v1/custom-apis", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: newApi.name,
        description: newApi.description,
        baseUrl: newApi.baseUrl,
        authType: newApi.authType,
        credentialReference: newApi.credentialReference,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      // Create assignment if agent selected
      if (newApi.assignedAgentId) {
        await fetch("/api/v1/agent-api-assignments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            customApiId: data.customApi.id,
            agentId: newApi.assignedAgentId,
            grantedCapabilities: ["can_call"],
          }),
        });
      }
      setApis([...apis, { ...data.customApi, endpointCount: 0, assignedAgent: slots.find((s) => s.id === newApi.assignedAgentId)?.name || null, assignedAgentId: newApi.assignedAgentId || null, assignmentCount: newApi.assignedAgentId ? 1 : 0 }]);
      setShowAddApi(false);
      setNewApi({ name: "", description: "", baseUrl: "", authType: "none", credentialReference: "", assignedAgentId: "" });
      router.refresh();
    }
  }

  async function createAgent() {
    if (!newAgent.name) return;
    const res = await fetch("/api/v1/agent-slots", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(newAgent),
    });
    if (res.ok) {
      const data = await res.json();
      setSlots([...slots, { ...data.agentSlot, apiCount: 0, apis: [] }]);
      setShowCreateAgent(false);
      setNewAgent({ name: "", description: "", role: "", modelPreference: "auto", budget: 5, timeoutMs: 120000, retryLimit: 2 });
      router.refresh();
    }
  }

  async function toggleApiStatus(api: CustomApi) {
    const newStatus = api.status === "active" ? "disabled" : "active";
    const res = await fetch(`/api/v1/custom-apis/${api.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setApis(apis.map((a) => a.id === api.id ? { ...a, status: newStatus } : a));
    }
  }

  async function deleteApi(apiId: string) {
    const res = await fetch(`/api/v1/custom-apis/${apiId}`, { method: "DELETE" });
    if (res.ok) {
      setApis(apis.filter((a) => a.id !== apiId));
      setAssignments(assignments.filter((a) => a.customApiId !== apiId));
      router.refresh();
    }
  }

  async function reassignApi(apiId: string, newAgentId: string) {
    // Remove old assignment
    const oldAssignment = assignments.find((a) => a.customApiId === apiId);
    if (oldAssignment) {
      await fetch(`/api/v1/agent-api-assignments?id=${oldAssignment.id}`, { method: "DELETE" });
    }
    // Create new assignment
    if (newAgentId) {
      await fetch("/api/v1/agent-api-assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customApiId: apiId, agentId: newAgentId, grantedCapabilities: ["can_call"] }),
      });
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("apis")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${view === "apis" ? "bg-arena-blue text-white" : "bg-arena-bg/60 text-arena-muted border border-arena-border"}`}
        >
          APIs ({apis.length})
        </button>
        <button
          onClick={() => setView("agents")}
          className={`rounded-md px-4 py-2 text-sm font-medium ${view === "agents" ? "bg-arena-blue text-white" : "bg-arena-bg/60 text-arena-muted border border-arena-border"}`}
        >
          Agents ({slots.length})
        </button>
      </div>

      {/* APIs View */}
      {view === "apis" && (
        <Panel>
          <PanelHeader
            title="Registered Custom APIs"
            subtitle="External APIs called through the Tool Gateway"
            right={
              <button
                onClick={() => setShowAddApi(true)}
                className="rounded-md bg-arena-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-arena-blue/90"
              >
                + Add API
              </button>
            }
          />
          <div className="divide-y divide-arena-border">
            {apis.map((api) => (
              <div key={api.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/5">
                <StatusDot tone={api.status === "active" ? "green" : "muted"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-arena-text">{api.name}</span>
                    <Badge tone={api.authType === "none" ? "default" : "amber"}>{api.authType}</Badge>
                  </div>
                  <div className="text-xs text-arena-muted mt-0.5">{api.description || "No description"}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-arena-muted font-mono">
                    <span>{api.baseUrl}</span>
                    <span>{api.endpointCount} endpoints</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {api.assignedAgent && (
                    <Badge tone="violet">{api.assignedAgent}</Badge>
                  )}
                  <Badge tone={api.status === "active" ? "green" : "default"}>{api.status}</Badge>
                  <select
                    value={api.assignedAgentId ?? ""}
                    onChange={(e) => reassignApi(api.id, e.target.value)}
                    className="text-xs bg-transparent border border-arena-border rounded px-1 py-0.5 text-arena-muted"
                  >
                    <option value="">Unassigned</option>
                    {slots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleApiStatus(api)}
                    className="text-xs text-arena-muted hover:underline"
                  >
                    {api.status === "active" ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${api.name}"? This removes its agent assignments too.`)) deleteApi(api.id);
                    }}
                    className="text-xs text-arena-red hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {apis.length === 0 && (
              <div className="px-5 py-12 text-center">
                <div className="text-sm text-arena-muted">No custom APIs registered yet.</div>
                <button
                  onClick={() => setShowAddApi(true)}
                  className="mt-3 text-sm text-arena-blue hover:underline"
                >
                  + Add your first API
                </button>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Agents View */}
      {view === "agents" && (
        <Panel>
          <PanelHeader
            title="Agent Slots"
            subtitle="Built-in and custom agents that can be assigned to custom APIs"
            right={
              <button
                onClick={() => setShowCreateAgent(true)}
                className="rounded-md bg-arena-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-arena-blue/90"
              >
                + Create Agent
              </button>
            }
          />
          <div className="divide-y divide-arena-border">
            {slots.map((slot) => (
              <div key={slot.id} className="flex items-center gap-4 px-5 py-4">
                <StatusDot tone={slot.isCustom ? "amber" : "blue"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-arena-text">{slot.name}</span>
                    <Badge tone={slot.isCustom ? "amber" : "default"}>{slot.isCustom ? "custom" : "built-in"}</Badge>
                  </div>
                  <div className="text-xs text-arena-muted mt-0.5">{slot.description}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-arena-muted">
                    <span>role: {slot.role}</span>
                    <span>model: {slot.modelPreference}</span>
                    <span>budget: {slot.budget} NGN</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {slot.apis.length > 0 && (
                    <div className="flex gap-1">
                      {slot.apis.map((api) => (
                        <Badge key={api.id} tone="violet">{api.name}</Badge>
                      ))}
                    </div>
                  )}
                  <Badge tone="blue">{slot.apiCount} APIs</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Add API Modal */}
      {showAddApi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-arena-text mb-4">Register Custom API</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Name *</label>
                <input
                  value={newApi.name}
                  onChange={(e) => setNewApi({ ...newApi, name: e.target.value })}
                  placeholder="e.g. CoinGecko Price API"
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text focus:outline-none focus:border-arena-blue/60"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Description</label>
                <input
                  value={newApi.description}
                  onChange={(e) => setNewApi({ ...newApi, description: e.target.value })}
                  placeholder="What does this API do?"
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text focus:outline-none focus:border-arena-blue/60"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Base URL *</label>
                <input
                  value={newApi.baseUrl}
                  onChange={(e) => setNewApi({ ...newApi, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text font-mono focus:outline-none focus:border-arena-blue/60"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Auth Type</label>
                <select
                  value={newApi.authType}
                  onChange={(e) => setNewApi({ ...newApi, authType: e.target.value })}
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text"
                >
                  <option value="none">None</option>
                  <option value="api_key">API Key</option>
                  <option value="bearer_token">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="custom_header">Custom Header</option>
                </select>
              </div>
              {newApi.authType !== "none" && (
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-arena-muted">Credential Reference</label>
                  <input
                    value={newApi.credentialReference}
                    onChange={(e) => setNewApi({ ...newApi, credentialReference: e.target.value })}
                    placeholder="env:MY_API_KEY"
                    className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text font-mono focus:outline-none focus:border-arena-blue/60"
                  />
                  <div className="text-[10px] text-arena-muted mt-1">Format: env:VAR_NAME — the secret is read server-side only</div>
                </div>
              )}
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Assign to Agent</label>
                <div className="flex gap-2 mt-1">
                  <select
                    value={newApi.assignedAgentId}
                    onChange={(e) => setNewApi({ ...newApi, assignedAgentId: e.target.value })}
                    className="flex-1 rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text"
                  >
                    <option value="">Select agent...</option>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.isCustom ? "custom" : "built-in"})</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowCreateAgent(true)}
                    className="rounded-md border border-arena-border px-3 py-2 text-xs text-arena-blue hover:bg-white/5"
                  >
                    + New Agent
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddApi(false)}
                className="flex-1 rounded-md border border-arena-border px-4 py-2 text-sm text-arena-muted hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={createApi}
                disabled={!newApi.name || !newApi.baseUrl}
                className="flex-1 rounded-md bg-arena-blue px-4 py-2 text-sm font-medium text-white hover:bg-arena-blue/90 disabled:opacity-50"
              >
                Register API
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreateAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="glass rounded-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-arena-text mb-4">Create New Agent</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Name *</label>
                <input
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="e.g. Market Data Agent"
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text focus:outline-none focus:border-arena-blue/60"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Description</label>
                <input
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="What does this agent do?"
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text focus:outline-none focus:border-arena-blue/60"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-arena-muted">Role</label>
                <input
                  value={newAgent.role}
                  onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                  placeholder="e.g. market_data"
                  className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text font-mono focus:outline-none focus:border-arena-blue/60"
                />
                <div className="text-[10px] text-arena-muted mt-1">Used internally for task routing</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-arena-muted">Model Preference</label>
                  <select
                    value={newAgent.modelPreference}
                    onChange={(e) => setNewAgent({ ...newAgent, modelPreference: e.target.value })}
                    className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text"
                  >
                    <option value="auto">Auto (Gateway decides)</option>
                    <option value="research">Research (Gemini preferred)</option>
                    <option value="code">Code (OpenAI preferred)</option>
                    <option value="reasoning">Reasoning (Claude preferred)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-arena-muted">Budget (NGN)</label>
                  <input
                    type="number"
                    value={newAgent.budget}
                    onChange={(e) => setNewAgent({ ...newAgent, budget: Number(e.target.value) })}
                    className="mt-1 w-full rounded-md bg-arena-bg/60 border border-arena-border px-3 py-2 text-sm text-arena-text"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateAgent(false)}
                className="flex-1 rounded-md border border-arena-border px-4 py-2 text-sm text-arena-muted hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={createAgent}
                disabled={!newAgent.name}
                className="flex-1 rounded-md bg-arena-blue px-4 py-2 text-sm font-medium text-white hover:bg-arena-blue/90 disabled:opacity-50"
              >
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
