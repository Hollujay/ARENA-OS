import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@security/session";
import { getRepository } from "@db/index";
import { shortId, nowIso } from "@core/ids";

// POST /api/v1/api-keys -> create a new API key
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const repo = getRepository();
  const ws = await repo.ensureSeedWorkspace();
  const environment = body.environment === "live" ? "live" : "test";

  // Generate a full key (in production, hash and store only the hash)
  const fullKey = `aos_${environment}_${shortId("", 16)}`;

  const apiKey = await repo.createApiKey({
    id: shortId("KEY"),
    workspaceId: ws.id,
    name,
    environment,
    prefix: `${fullKey.slice(0, 12)}••••••••••••`,
    scopes: body.scopes || ["missions:write", "tools:execute"],
    createdAt: nowIso(),
    revoked: false,
  });

  // Return the full key only on creation — it won't be shown again
  return NextResponse.json({ apiKey, key: fullKey });
}
