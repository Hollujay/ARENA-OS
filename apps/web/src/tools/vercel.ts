import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";

// Vercel adapter. Uses the Vercel REST API (api.vercel.com).
// Credentials: VERCEL_TOKEN (read server-side only via process.env).

const API_BASE = "https://api.vercel.com";

function getConfig() {
  const token = process.env.VERCEL_TOKEN || "";
  return { token, configured: !!token };
}

async function vercelFetch(path: string, opts?: { method?: string; body?: unknown }): Promise<unknown> {
  const { token, configured } = getConfig();
  if (!configured) throw new Error("vercel not configured — set VERCEL_TOKEN");
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`vercel ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

interface VercelDeploymentSummary {
  id: string;
  url: string;
  state: string;
  created: string;
}
interface VercelProject {
  id: string;
  name: string;
  framework?: string;
  latestDeployments?: VercelDeploymentSummary[];
}
interface VercelDeployment {
  id: string;
  name?: string;
  readyState: string;
  url: string;
  inspectorUrl?: string;
  created: string;
  target?: string;
}
interface VercelEvent {
  type: string;
  payload?: { text?: string };
  created: string;
}
interface VercelDomain {
  name: string;
  verified: boolean;
  created: string;
}
interface VercelToolInput {
  limit?: number;
  deploymentId?: string;
  deployment_id?: string;
  name?: string;
  project?: string;
  gitSource?: unknown;
  projectId?: string;
  project_id?: string;
}

export async function runVercelTool(
  tool: ToolName,
  input: Json,
): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as VercelToolInput;
  const { configured } = getConfig();

  if (!configured) {
    return { ok: false, error: "vercel not configured — set VERCEL_TOKEN" };
  }

  try {
    switch (tool) {
      case "vercel.list_projects": {
        const limit = Math.min(i.limit || 20, 100);
        const data = (await vercelFetch(`/v9/projects?limit=${limit}`)) as { projects?: VercelProject[] };
        return {
          ok: true,
          output: {
            projects: (data.projects ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              framework: p.framework ?? null,
              latestDeployment: p.latestDeployments?.[0]
                ? {
                    id: p.latestDeployments[0].id,
                    url: p.latestDeployments[0].url,
                    state: p.latestDeployments[0].state,
                    createdAt: p.latestDeployments[0].created,
                  }
                : null,
            })),
          },
        };
      }

      case "vercel.get_deployment_status": {
        const deployId = i.deploymentId || i.deployment_id;
        if (!deployId) return { ok: false, error: "missing deploymentId" };
        const data = (await vercelFetch(`/v13/deployments/${deployId}`)) as VercelDeployment;
        return {
          ok: true,
          output: {
            id: data.id,
            name: data.name ?? null,
            state: data.readyState,
            url: data.url,
            inspectorUrl: data.inspectorUrl ?? null,
            createdAt: data.created,
            ready: data.readyState === "READY",
            target: data.target ?? null,
          },
        };
      }

      case "vercel.get_logs": {
        const did = i.deploymentId || i.deployment_id;
        if (!did) return { ok: false, error: "missing deploymentId" };
        const data = (await vercelFetch(`/v2/deployments/${did}/events?limit=100`)) as VercelEvent[];
        return {
          ok: true,
          output: {
            deploymentId: did,
            logs: (data ?? [])
              .map((e) => ({
                type: e.type,
                text: e.payload?.text || "",
                createdAt: e.created,
              }))
              .slice(0, 50),
          },
        };
      }

      case "vercel.deploy_preview": {
        const name = i.name || i.project;
        if (!name) return { ok: false, error: "missing name/project" };
        const data = (await vercelFetch("/v13/deployments", {
          method: "POST",
          body: {
            name,
            target: "preview",
            gitSource: i.gitSource || undefined,
          },
        })) as VercelDeployment;
        return {
          ok: true,
          output: {
            deploymentId: data.id,
            url: data.url,
            state: data.readyState,
            target: "preview",
          },
        };
      }

      case "vercel.deploy_production": {
        const name = i.name || i.project;
        if (!name) return { ok: false, error: "missing name/project" };
        const data = (await vercelFetch("/v13/deployments", {
          method: "POST",
          body: {
            name,
            target: "production",
            gitSource: i.gitSource || undefined,
          },
        })) as VercelDeployment;
        return {
          ok: true,
          output: {
            deploymentId: data.id,
            url: data.url,
            state: data.readyState,
            target: "production",
          },
        };
      }

      case "vercel.get_domains": {
        const projectId = i.projectId || i.project_id || i.name;
        if (!projectId) return { ok: false, error: "missing projectId" };
        const data = (await vercelFetch(`/v9/projects/${projectId}/domains`)) as { domains?: VercelDomain[] };
        return {
          ok: true,
          output: {
            domains: (data.domains ?? []).map((d) => ({
              name: d.name,
              verified: d.verified,
              createdAt: d.created,
            })),
          },
        };
      }

      default:
        return { ok: false, error: `unknown vercel tool: ${tool}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Test connection — lightweight read-only call
export async function testVercelConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await vercelFetch("/v2/user");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
