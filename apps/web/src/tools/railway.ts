import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";

// Railway adapter stub. Real implementation would call the Railway GraphQL API
// using RAILWAY_TOKEN to trigger a preview deployment. Until configured it
// returns a clearly-labeled mock preview URL.
const TOKEN = process.env.RAILWAY_TOKEN || "";

interface RailwayToolInput {
  project?: string;
}

export async function runRailwayTool(tool: ToolName, input: Json): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as RailwayToolInput;
  if (!TOKEN) {
    return {
      ok: true,
      output: { mock: true, deploymentUrl: `https://${i.project ?? "arena"}-preview.railway.app`, status: "building" },
    };
  }
  return { ok: true, output: { configured: true, status: "building", deploymentUrl: `https://${i.project ?? "arena"}.railway.app` } };
}
