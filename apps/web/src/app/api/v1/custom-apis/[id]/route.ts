import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@security/session";
import { getRepository } from "@db/index";
import { shortId, nowIso } from "@core/ids";

// GET /api/v1/custom-apis/:id -> get a custom API with endpoints
// PUT /api/v1/custom-apis/:id -> update a custom API
// DELETE /api/v1/custom-apis/:id -> delete a custom API
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const repo = getRepository();
  const api = await repo.getCustomApi(id);
  if (!api) return NextResponse.json({ error: "not found" }, { status: 404 });

  const endpoints = await repo.listCustomApiEndpoints(id);
  const assignments = await repo.listAgentApiAssignments();
  const myAssignments = assignments.filter((a) => a.customApiId === id);

  return NextResponse.json({ customApi: api, endpoints, assignments: myAssignments });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const repo = getRepository();
  const api = await repo.getCustomApi(id);
  if (!api) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Update allowed fields
  if (body.name !== undefined) api.name = body.name;
  if (body.description !== undefined) api.description = body.description;
  if (body.baseUrl !== undefined) api.baseUrl = body.baseUrl;
  if (body.authType !== undefined) api.authType = body.authType;
  if (body.credentialReference !== undefined) api.credentialReference = body.credentialReference;
  if (body.requestConfig !== undefined) api.requestConfig = body.requestConfig;
  if (body.status !== undefined) api.status = body.status;

  await repo.saveCustomApi(api);
  await repo.appendAudit({
    id: shortId("AE"),
    at: nowIso(),
    actor: "user",
    action: "custom_api.updated",
    detail: { apiId: api.id, name: api.name },
  });

  return NextResponse.json({ customApi: api });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const repo = getRepository();
  const api = await repo.getCustomApi(id);
  if (!api) return NextResponse.json({ error: "not found" }, { status: 404 });

  await repo.deleteCustomApi(id);
  await repo.appendAudit({
    id: shortId("AE"),
    at: nowIso(),
    actor: "user",
    action: "custom_api.deleted",
    detail: { apiId: id, name: api.name },
  });

  return NextResponse.json({ ok: true });
}
