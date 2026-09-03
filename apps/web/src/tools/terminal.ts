import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";

// Controlled terminal adapter. For safety this MVP does NOT exec arbitrary
// shell commands. It recognizes a small allow-list of sandbox operations
// (run tests, build, git status/diff) and otherwise returns a denied result.
// A production build would exec inside a restricted container with timeouts.

const ALLOWED = ["test", "build", "lint", "git status", "git diff", "install"];

interface TerminalToolInput {
  command?: string;
}

export async function runTerminalTool(tool: ToolName, input: Json): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as TerminalToolInput;
  const command: string = i?.command ?? "";
  const base = command.trim().split(" ")[0];
  const allowed = ALLOWED.some((a) => command.startsWith(a)) || ALLOWED.includes(base);
  if (!allowed) {
    return { ok: false, error: `command not permitted by terminal allow-list: ${command}`, output: { denied: true } };
  }
  // Mock execution results (deterministic for the demo).
  if (command.includes("test")) {
    return { ok: true, output: { command, passed: 12, failed: 0, exitCode: 0 } };
  }
  if (command.includes("build")) {
    return { ok: true, output: { command, exitCode: 0 } };
  }
  return { ok: true, output: { command, exitCode: 0, output: "ok" } };
}
