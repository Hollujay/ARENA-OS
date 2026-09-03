"use client";

import { usePathname } from "next/navigation";

const SECTION_MAP: Record<string, string> = {
  "/command-center": "COMMAND CENTER",
  "/missions": "MISSIONS",
  "/agents": "AGENTS",
  "/integrations": "INTEGRATIONS",
  "/custom-apis": "CUSTOM APIS",
  "/stellar": "STELLAR",
  "/payments": "PAYMENTS",
  "/activity": "ACTIVITY",
  "/settings": "SETTINGS",
  "/arena": "ARENA HUB",
  "/planner": "PLANNER",
  "/chat-history": "CHAT HISTORY",
  "/models": "MODELS",
  "/tools": "TOOLS",
};

export function TopBar() {
  const pathname = usePathname();
  const section = SECTION_MAP[pathname] || "ARENA OS";

  return (
    <header className="h-10 flex items-center justify-between px-6 border-b border-arena-border bg-arena-panel/80 text-[11px]">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.1em] uppercase">
        <span className="text-arena-green">ARENA OS</span>
        <span className="text-arena-muted">/</span>
        <span className="text-arena-secondary">{section}</span>
      </div>

      {/* Right: status */}
      <div className="flex items-center gap-4 font-mono text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-arena-green animate-pulse" />
          <span className="text-arena-secondary">SYSTEM ACTIVE</span>
        </div>
        <div className="text-arena-muted">
          <span className="text-arena-secondary">NGN</span>{" "}
          <span className="text-arena-text">124.50</span>
        </div>
      </div>
    </header>
  );
}
