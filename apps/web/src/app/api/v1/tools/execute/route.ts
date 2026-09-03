import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@security/session";
import { getToolGateway } from "@tools/gateway";
import { TOOL_REGISTRY } from "@tools/registry";
import { getRepository } from "@db/index";
import type { ToolName } from "@domain/index";

// POST /api/v1/tools/execute  { tool, input, missionId? }
// Manual tool execution through the gateway (permission-checked + audited).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const tool = String(body.tool || "") as ToolName;
  const spec = TOOL_REGISTRY[tool as keyof typeof TOOL_REGISTRY];
  if (!spec) return NextResponse.json({ error: "unknown tool" }, { status: 400 });

  const repo = getRepository();
  const gateway = getToolGateway();
  // For manual execution we grant the tool's own capability (user-initiated).
  const result = await gateway.execute(tool, body.input ?? {}, {
    missionId: body.missionId,
    grantedCapabilities: [spec.capability, "*"],
    actor: "user",
    record: async (run, audit) => {
      await repo.saveToolRun(run);
      await repo.appendAudit(audit);
    },
  });
  return NextResponse.json({ result });
}
