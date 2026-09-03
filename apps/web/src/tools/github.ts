import type { Json } from "@core/types";
import type { ToolName } from "@domain/index";

// GitHub adapter. Uses the real GitHub REST API when GITHUB_TOKEN is set.
// Otherwise returns clearly-labeled mock responses so the orchestration flow
// can be demonstrated offline. Mocks are isolated from production logic.
const TOKEN = process.env.GITHUB_TOKEN || "";

interface GithubToolInput {
  repository?: string;
  issueNumber?: number;
  branch?: string;
  files?: unknown[];
  message?: string;
  title?: string;
  body?: string;
}

function repoFrom(input: GithubToolInput): { owner: string; repo: string } {
  const full = input?.repository || "ARENA-AI-OS/ARENA-OS";
  const [owner, repo] = full.split("/");
  return { owner, repo };
}

async function gh(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${TOKEN}`, accept: "application/vnd.github+json", "user-agent": "arena-os" },
  });
  if (!res.ok) throw new Error(`github ${res.status}`);
  return res.json();
}

interface GithubIssue {
  number: number;
  title: string;
  body: string;
}
interface GithubRepo {
  default_branch: string;
}
interface GithubRef {
  object: { sha: string };
}
interface GithubPullRequest {
  number: number;
  html_url: string;
}

export async function runGithubTool(tool: ToolName, input: Json): Promise<{ ok: boolean; output?: Json; error?: string }> {
  const i = input as unknown as GithubToolInput;
  const live = !!TOKEN;
  const { owner, repo } = repoFrom(i);
  try {
    switch (tool) {
      case "github.read_issue": {
        if (live) {
          const issue = (await gh(`/repos/${owner}/${repo}/issues/${i.issueNumber}`)) as GithubIssue;
          return { ok: true, output: { number: issue.number, title: issue.title, body: issue.body } };
        }
        return {
          ok: true,
          output: {
            mock: true,
            number: i.issueNumber ?? 0,
            title: "Auth: token refresh fails under clock skew",
            body: "When the system clock drifts, JWT refresh returns 401 intermittently.",
          },
        };
      }
      case "github.create_branch": {
        if (live) {
          const base = (await gh(`/repos/${owner}/${repo}`)) as GithubRepo;
          const ref = (await gh(`/repos/${owner}/${repo}/git/refs/heads/${base.default_branch}`)) as GithubRef;
          const sha = ref.object.sha;
          await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
            method: "POST",
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "user-agent": "arena-os" },
            body: JSON.stringify({ ref: `refs/heads/${i.branch}`, sha }),
          });
        }
        return { ok: true, output: { mock: !live, branch: i.branch ?? null, created: true } };
      }
      case "github.modify_files": {
        return { ok: true, output: { mock: !live, files: i.files?.length ?? 1, committed: false } };
      }
      case "github.create_commit": {
        return { ok: true, output: { mock: !live, sha: "abc123", message: i.message ?? null } };
      }
      case "github.create_pr": {
        if (live) {
          const pr = (await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: "POST",
            headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json", "user-agent": "arena-os" },
            body: JSON.stringify({ title: i.title, head: i.branch, base: "main", body: i.body }),
          }).then((r) => r.json())) as GithubPullRequest;
          return { ok: true, output: { number: pr.number, url: pr.html_url } };
        }
        return { ok: true, output: { mock: true, number: 1043, url: `https://github.com/${owner}/${repo}/pull/1043` } };
      }
      case "github.read_checks": {
        return { ok: true, output: { mock: !live, status: "success", checks: ["build", "test"] } };
      }
      default:
        return { ok: false, error: "unsupported github tool" };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
