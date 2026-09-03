import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";

// Render adapter. Uses the Render REST API (api.render.com/v1).
// Credentials: RENDER_API_KEY (read server-side only via process.env).

const API_BASE = "https://api.render.com/v1";

function getConfig() {
  const apiKey = process.env.RENDER_API_KEY || "";
  return { apiKey, configured: !!apiKey };
}

async function renderFetch(path: string, opts?: { method?: string; body?: unknown }): Promise<unknown> {
  const { apiKey, configured } = getConfig();
  if (!configured) throw new Error("render not configured — set RENDER_API_KEY");
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`render ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

interface RenderService {
  id: string;
  name: string;
  type: string;
  status?: string;
  url?: string;
  created_at?: string;
  service?: { status?: string; url?: string };
  latest_deploy?: RenderDeploy;
}
interface RenderDeploy {
  id: string;
  status: string;
  created_at?: string;
  finished_at?: string;
  commit?: { id: string };
}
interface RenderToolInput {
  serviceId?: string;
  service_id?: string;
  limit?: number;
}

export async function runRenderTool(
  tool: ToolName,
  input: Json,
): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as RenderToolInput;
  const { configured } = getConfig();

  if (!configured) {
    return { ok: false, error: "render not configured — set RENDER_API_KEY" };
  }

  try {
    switch (tool) {
      case "render.list_projects": {
        const data = (await renderFetch("/services?type=service&limit=50")) as { items?: RenderService[] } | RenderService[];
        const items = Array.isArray(data) ? data : (data.items ?? []);
        return {
          ok: true,
          output: {
            projects: items.map((s) => ({
              id: s.id,
              name: s.name,
              type: s.type,
              status: s.service?.status ?? s.status ?? "unknown",
              url: s.service?.url ?? s.url ?? null,
              createdAt: s.created_at ?? null,
            })),
          },
        };
      }

      case "render.get_deployment_status": {
        const serviceId = i.serviceId || i.service_id;
        if (!serviceId) return { ok: false, error: "missing serviceId" };
        const data = (await renderFetch(`/services/${serviceId}`)) as RenderService;
        const latestDeploy = data.latest_deploy;
        return {
          ok: true,
          output: {
            serviceId: data.id,
            name: data.name,
            status: data.status ?? null,
            deployStatus: latestDeploy?.status || "none",
            deployId: latestDeploy?.id ?? null,
            commitHash: latestDeploy?.commit?.id ?? null,
            finishedAt: latestDeploy?.finished_at ?? null,
          },
        };
      }

      case "render.get_logs": {
        const sid = i.serviceId || i.service_id;
        if (!sid) return { ok: false, error: "missing serviceId" };
        const limit = Math.min(i.limit || 100, 500);
        const data = await renderFetch(`/services/${sid}/logs?limit=${limit}`);
        return {
          ok: true,
          output: {
            serviceId: sid,
            logs: typeof data === "string" ? data.slice(0, 5000) : JSON.stringify(data).slice(0, 5000),
          },
        };
      }

      case "render.deploy_preview": {
        const sid = i.serviceId || i.service_id;
        if (!sid) return { ok: false, error: "missing serviceId" };
        const data = (await renderFetch(`/services/${sid}/deploys`, {
          method: "POST",
          body: { clear_cache: false },
        })) as RenderDeploy;
        return {
          ok: true,
          output: {
            deployId: data.id,
            status: data.status,
            triggeredAt: data.created_at ?? null,
          },
        };
      }

      default:
        return { ok: false, error: `unknown render tool: ${tool}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// Test connection — lightweight read-only call
export async function testRenderConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    await renderFetch("/owners");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
