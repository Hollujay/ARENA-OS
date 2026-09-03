"use client";

import { useState, useCallback } from "react";
import type { PlatformConnection } from "@domain/index";
import { PlatformConnectModal } from "@/components/platform-connect-modal";
import { PLATFORM_CONFIGS } from "@/lib/platform-config";

const CATEGORY_ORDER = [
  { label: "AI PROVIDERS", platforms: ["openai", "gemini", "claude"] },
  { label: "SOURCE CONTROL", platforms: ["github"] },
  { label: "BACKEND / DATA", platforms: ["supabase", "firebase"] },
  { label: "HOSTING / DEPLOYMENT", platforms: ["railway", "render", "vercel"] },
  { label: "WEB3 / PAYMENTS", platforms: ["stellar_testnet", "stellar_mainnet"] },
];

export function ArenaHub({
  initialConnections,
}: {
  initialConnections: PlatformConnection[];
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [connectPlatform, setConnectPlatform] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { ok: boolean; error?: string }>
  >({});

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/platform-connections");
    const data = await res.json();
    setConnections(data);
  }, []);

  async function testConnection(connId: string) {
    setTesting(connId);
    try {
      const res = await fetch(
        `/api/v1/platform-connections/${connId}/test`,
        { method: "POST" }
      );
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [connId]: data }));
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connId
            ? {
                ...c,
                status: data.ok ? "connected" : "error",
                lastTestAt: new Date().toISOString(),
                lastTestOk: data.ok,
              }
            : c
        )
      );
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [connId]: { ok: false, error: (e as Error).message },
      }));
    }
    setTesting(null);
  }

  async function disconnectPlatform(connId: string) {
    await fetch(`/api/v1/platform-connections/${connId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "disconnected" }),
    });
    setConnections((prev) =>
      prev.map((c) =>
        c.id === connId ? { ...c, status: "disconnected" } : c
      )
    );
  }

  function getConnection(platformId: string): PlatformConnection | undefined {
    // Handle stellar variants
    if (platformId === "stellar_testnet")
      return connections.find(
        (c) => c.platform === "stellar" && c.network === "testnet"
      );
    if (platformId === "stellar_mainnet")
      return connections.find(
        (c) => c.platform === "stellar" && c.network === "mainnet"
      );
    return connections.find((c) => c.platform === platformId);
  }

  const connectedCount = connections.filter(
    (c) => c.status === "connected"
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] text-arena-muted uppercase tracking-wider">
          CONNECTIONS
        </span>
        <span className="font-mono text-[11px] text-arena-green">
          {connectedCount}
        </span>
        <span className="font-mono text-[10px] text-arena-muted">/</span>
        <span className="font-mono text-[11px] text-arena-text">
          {connections.length}
        </span>
        <div className="flex-1 h-1 bg-arena-inset rounded-full overflow-hidden">
          <div
            className="h-full bg-arena-green rounded-full transition-all"
            style={{
              width: `${connections.length > 0 ? (connectedCount / connections.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Categories */}
      {CATEGORY_ORDER.map((cat) => (
        <div key={cat.label}>
          <div className="arena-label text-[9px] mb-2">{cat.label}</div>
          <div className="grid gap-2">
            {cat.platforms.map((platformId) => {
              const config = PLATFORM_CONFIGS.find((p) => p.id === platformId);
              if (!config) return null;
              const conn = getConnection(platformId);
              const isDisconnected =
                !conn || conn.status === "disconnected";
              const hasError = conn?.status === "error";
              const isExpired = conn?.status === "token_expired";
              const testResult = conn ? testResults[conn.id] : undefined;

              return (
                <div
                  key={platformId}
                  className={`arena-inset px-4 py-3 rounded-md flex items-center justify-between ${
                    hasError || isExpired ? "arena-glow-red" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-arena-green text-sm shrink-0">
                      {config.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-arena-text font-medium">
                          {config.label}
                        </span>
                        {conn?.network && (
                          <span
                            className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
                              conn.network === "testnet"
                                ? "bg-arena-green/10 text-arena-green"
                                : "bg-arena-red/10 text-arena-red"
                            }`}
                          >
                            {conn.network.toUpperCase()}
                          </span>
                        )}
                        <span
                          className={`font-mono text-[8px] px-1.5 py-0.5 rounded ${
                            conn?.status === "connected"
                              ? "bg-arena-green/10 text-arena-green"
                              : conn?.status === "error"
                                ? "bg-arena-red/10 text-arena-red"
                                : "bg-white/5 text-arena-muted"
                          }`}
                        >
                          {conn?.status?.toUpperCase() || "NOT CONNECTED"}
                        </span>
                      </div>
                      <div className="text-[10px] text-arena-muted mt-0.5 truncate">
                        {config.description}
                      </div>
                      {/* Scopes */}
                      {conn?.scopes && conn.scopes.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {(Array.isArray(conn.scopes)
                            ? conn.scopes.slice(0, 3)
                            : []
                          ).map((s: string | { name?: string }, i: number) => (
                            <span
                              key={i}
                              className="font-mono text-[8px] text-arena-muted"
                            >
                              {typeof s === "string"
                                ? s
                                : s?.name || JSON.stringify(s)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {/* Test result */}
                    {testResult && (
                      <span
                        className={`font-mono text-[9px] ${
                          testResult.ok
                            ? "text-arena-green"
                            : "text-arena-red"
                        }`}
                      >
                        {testResult.ok ? "✓ verified" : "✗ failed"}
                      </span>
                    )}

                    {isDisconnected || isExpired || hasError ? (
                      <button
                        onClick={() => setConnectPlatform(platformId)}
                        className="px-3 py-1.5 rounded bg-arena-green/15 text-arena-green border border-arena-green/30 font-mono text-[10px] font-medium hover:bg-arena-green/25 transition-colors"
                      >
                        {hasError || isExpired ? "RECONNECT" : "CONNECT"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => testConnection(conn!.id)}
                          disabled={testing === conn?.id}
                          className="px-2.5 py-1.5 rounded bg-arena-inset border border-arena-border font-mono text-[9px] text-arena-muted hover:text-arena-text transition-colors disabled:opacity-40"
                        >
                          {testing === conn?.id ? "TEST…" : "TEST"}
                        </button>
                        <button
                          onClick={() => disconnectPlatform(conn!.id)}
                          className="px-2.5 py-1.5 rounded bg-arena-inset border border-arena-border font-mono text-[9px] text-arena-muted hover:text-arena-red transition-colors"
                        >
                          DISCONNECT
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Connect Modal */}
      {connectPlatform && (
        <PlatformConnectModal
          platformId={connectPlatform}
          open={true}
          onClose={() => setConnectPlatform(null)}
          onConnected={refresh}
        />
      )}
    </div>
  );
}
