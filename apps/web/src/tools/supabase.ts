import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";

// Supabase adapter stub. When SUPABASE_URL + SUPABASE_SERVICE_KEY are set,
// this is where real read-only SQL execution would happen (scoped to the
// supabase:read_database capability). Until then it reports not-configured.
const URL = process.env.SUPABASE_URL || "";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";

export async function runSupabaseTool(_tool: ToolName, _input: Json): Promise<{ ok: boolean; output?: Json; error?: string }> {
  if (!URL || !KEY) {
    return { ok: false, error: "supabase not configured", output: { configured: false } };
  }
  // Production: POST to Supabase REST / PostgREST with a read-only role.
  return { ok: true, output: { configured: true, note: "read-only query path" } };
}
