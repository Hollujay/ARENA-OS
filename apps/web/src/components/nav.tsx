"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StatusDot } from "@/components/ui";

const SECTIONS = [
  { href: "/command-center", label: "Command Center", icon: "⬡" },
  { href: "/missions", label: "Missions", icon: "▣" },
  { href: "/agents", label: "Agents", icon: "◈" },
  { href: "/integrations", label: "Integrations", icon: "⧉" },
  { href: "/custom-apis", label: "Custom APIs", icon: "⊞" },
  { href: "/stellar", label: "Stellar", icon: "✦" },
  { href: "/payments", label: "Payments", icon: "◇" },
  { href: "/activity", label: "Activity", icon: "≡" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

const SECONDARY = [
  { href: "/arena", label: "Arena Hub", icon: "◎" },
  { href: "/planner", label: "Planner", icon: "◈" },
  { href: "/chat-history", label: "Chat History", icon: "▤" },
  { href: "/models", label: "Models", icon: "◉" },
  { href: "/tools", label: "Tools", icon: "⊞" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login" || !pathname.startsWith("/")) return null;
  // Don't show on public pages
  if (pathname === "/" || pathname === "/exhibition") return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden md:flex w-[240px] flex-col bg-arena-panel border-r border-arena-border">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-arena-border">
        <Link href="/command-center" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-arena-inset border border-arena-border flex items-center justify-center">
            <span className="text-arena-green font-mono text-xs font-bold">
              A
            </span>
          </div>
          <div>
            <span className="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-arena-text">
              Arena
            </span>{" "}
            <span className="font-mono text-[11px] font-semibold tracking-[0.15em] uppercase text-arena-green">
              OS
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[12px] transition-colors ${
                active
                  ? "bg-arena-green/8 text-arena-green"
                  : "text-arena-secondary hover:text-arena-text hover:bg-white/[0.03]"
              }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-arena-green rounded-r" />
              )}
              <span
                className={`w-4 text-center text-[11px] ${active ? "text-arena-green" : "text-arena-muted"}`}
              >
                {s.icon}
              </span>
              <span className="font-medium">{s.label}</span>
            </Link>
          );
        })}

        <div className="pt-3 pb-1 px-3">
          <span className="arena-label text-[9px]">More</span>
        </div>

        {SECONDARY.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[11px] transition-colors ${
                active
                  ? "bg-arena-green/8 text-arena-green"
                  : "text-arena-muted hover:text-arena-secondary hover:bg-white/[0.03]"
              }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-arena-green rounded-r" />
              )}
              <span className="w-4 text-center text-[10px]">{s.icon}</span>
              <span>{s.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Operator card */}
      <div className="px-3 py-3 border-t border-arena-border">
        <div className="flex items-center gap-2.5 px-2">
          <div className="w-7 h-7 rounded-full bg-arena-inset border border-arena-border flex items-center justify-center text-[10px] font-mono text-arena-muted">
            OS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-arena-text truncate">
              Operator
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot tone="green" />
              <span className="font-mono text-[9px] text-arena-muted">
                online
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-[9px] font-mono text-arena-muted hover:text-arena-red transition-colors"
          >
            EXIT
          </button>
        </div>
      </div>
    </aside>
  );
}
