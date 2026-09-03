import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@security/session";
import { getModelGateway } from "@ai/model-gateway";
import type { ModelTaskKind } from "@domain/index";

// POST /api/v1/agents/run  { role, prompt, taskKind? }
// Runs a model through the gateway for the given agent role. The gateway keeps
// provider selection + failover; raw credentials never leave the server.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt || "");
  const taskKind = (body.taskKind as ModelTaskKind) || "any";
  const gateway = getModelGateway();
  const res = await gateway.complete({ prompt, taskKind });
  return NextResponse.json({ response: res });
}
