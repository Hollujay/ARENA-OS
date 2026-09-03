import { NextResponse } from "next/server";
import { getRepository } from "@db/index";
import { nowIso } from "@core/ids";
import type { Json } from "@core/types";
import { testVercelConnection } from "@tools/vercel";
import { testRenderConnection } from "@tools/render";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepository();
  const conn = await repo.getPlatformConnection(id);
  if (!conn) return NextResponse.json({ error: "not found" }, { status: 404 });

  let result: { ok: boolean; error?: string };

  switch (conn.platform) {
    case "vercel":
      result = await testVercelConnection();
      break;
    case "render":
      result = await testRenderConnection();
      break;
    case "github": {
      const token = process.env.GITHUB_TOKEN;
      if (!token) { result = { ok: false, error: "GITHUB_TOKEN not set" }; break; }
      try {
        const res = await fetch("https://api.github.com/user", { headers: { Authorization: `token ${token}` } });
        result = res.ok ? { ok: true } : { ok: false, error: `GitHub API ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "supabase": {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY;
      if (!url || !key) { result = { ok: false, error: "SUPABASE_URL or SUPABASE_ANON_KEY not set" }; break; }
      try {
        const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
        result = res.ok ? { ok: true } : { ok: false, error: `Supabase ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "railway": {
      const token = process.env.RAILWAY_TOKEN;
      if (!token) { result = { ok: false, error: "RAILWAY_TOKEN not set" }; break; }
      try {
        const res = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query: "{ me { id email } }" }),
        });
        result = res.ok ? { ok: true } : { ok: false, error: `Railway ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "firebase": {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const apiKey = process.env.FIREBASE_API_KEY;
      if (!projectId || !apiKey) { result = { ok: false, error: "FIREBASE_PROJECT_ID or FIREBASE_API_KEY not set" }; break; }
      try {
        const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents?key=${apiKey}`);
        result = res.ok ? { ok: true } : { ok: false, error: `Firebase ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "stellar": {
      const secret = process.env.STELLAR_SECRET_KEY;
      const network = conn.network || "testnet";
      if (!secret) { result = { ok: false, error: "STELLAR_SECRET_KEY not set" }; break; }
      try {
        const horizon = network === "testnet" ? "https://horizon-testnet.stellar.org" : "https://horizon.stellar.org";
        const StellarSdk = await import("@stellar/stellar-sdk");
        const pk = StellarSdk.Keypair.fromSecret(secret).publicKey();
        const res = await fetch(`${horizon}/accounts/${pk}`);
        result = res.ok ? { ok: true } : { ok: false, error: `Stellar Horizon ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) { result = { ok: false, error: "OPENAI_API_KEY not set" }; break; }
      try {
        const res = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
        result = res.ok ? { ok: true } : { ok: false, error: `OpenAI ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) { result = { ok: false, error: "GEMINI_API_KEY not set" }; break; }
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        result = res.ok ? { ok: true } : { ok: false, error: `Gemini ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    case "claude": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) { result = { ok: false, error: "ANTHROPIC_API_KEY not set" }; break; }
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        });
        result = res.ok ? { ok: true } : { ok: false, error: `Claude ${res.status}` };
      } catch (e) { result = { ok: false, error: (e as Error).message }; }
      break;
    }
    default:
      result = { ok: false, error: `test not implemented for ${conn.platform}` };
  }

  // Update the connection record
  conn.status = result.ok ? "connected" : "error";
  conn.lastTestAt = nowIso();
  conn.lastTestOk = result.ok;
  await repo.savePlatformConnection(conn);

  // Write audit event
  await repo.appendAudit({
    id: `AE_${Date.now()}`,
    at: nowIso(),
    actor: "user",
    action: `platform.test.${conn.platform}`,
    detail: { platform: conn.platform, ok: result.ok, error: result.error ?? null } as unknown as Json,
  });

  return NextResponse.json(result);
}
