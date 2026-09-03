"use client";

import { useState } from "react";
import type { ConnectField } from "@/lib/platform-config";
import { getPlatformConfig } from "@/lib/platform-config";

interface Props {
  platformId: string;
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function PlatformConnectModal({
  platformId,
  open,
  onClose,
  onConnected,
}: Props) {
  const config = getPlatformConfig(platformId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  if (!open || !config) return null;
  const cfg = config!;

  async function handleOAuth() {
    const origin = window.location.origin;
    let url = "";
    if (platformId === "github") {
      const clientId = "Ov23liplaceholder";
      const scopes = cfg.oauthScopes?.join(" ") || "repo";
      const state = crypto.randomUUID();
      document.cookie = `github_oauth_state=${state}; path=/; max-age=300; SameSite=Lax`;
      url = `${cfg.oauthUrl}?client_id=${clientId}&scope=${encodeURIComponent(scopes)}&state=${state}&redirect_uri=${encodeURIComponent(`${origin}/api/auth/callback/github?returnTo=/arena`)}`;
    } else if (platformId === "vercel") {
      const clientId = "placeholder_vercel_client_id";
      const state = crypto.randomUUID();
      document.cookie = `vercel_oauth_state=${state}; path=/; max-age=300; SameSite=Lax`;
      url = `${cfg.oauthUrl}?client_id=${clientId}&state=${state}&redirect_uri=${encodeURIComponent(`${origin}/api/auth/callback/vercel?returnTo=/arena`)}`;
    }
    if (url) window.location.href = url;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Validate required fields
    if (cfg.fields) {
      for (const field of cfg.fields) {
        if (field.required && !values[field.key]) {
          setError(`${field.label} is required`);
          setSaving(false);
          return;
        }
      }
    }

    try {
      // Store credentials in security module via API
      const res = await fetch("/api/v1/platform-connections/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformId,
          credentials: values,
          config: {
            fields: cfg.fields?.map((f) => f.key),
            sensitive: cfg.fields?.filter((f) => f.sensitive).map((f) => f.key),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      // Run health check
      setTesting(true);
      const testRes = await fetch(
        `/api/v1/platform-connections/${data.connectionId}/test`,
        { method: "POST" }
      );
      const test = await testRes.json();
      setTesting(false);
      setTestResult({
        ok: test.ok,
        msg: test.ok ? "Connected and verified" : test.error || "Test failed",
      });

      if (test.ok) {
        setTimeout(() => {
          onConnected();
          onClose();
        }, 1200);
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-arena-panel border border-arena-border rounded-lg w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-arena-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-arena-green text-sm">{config.icon}</span>
            <div>
              <h3 className="text-[12px] font-medium text-arena-text">
                Connect {config.label}
              </h3>
              <p className="text-[10px] text-arena-muted mt-0.5">
                {config.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-arena-muted hover:text-arena-text text-[11px] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {cfg.method === "oauth" ? (
            /* OAuth flow — redirect button */
            <div className="space-y-4">
              <div className="arena-inset px-4 py-3 rounded-md">
                <p className="text-[11px] text-arena-secondary leading-relaxed">
                  Arena uses OAuth to connect to {cfg.label}. You&apos;ll be
                  redirected to {cfg.label} to authorize access. Arena only
                  receives the permissions you approve — no passwords are
                  stored.
                </p>
              </div>

              {cfg.oauthScopes && (
                <div>
                  <span className="arena-label text-[8px]">
                    PERMISSIONS REQUESTED
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cfg.oauthScopes.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded bg-arena-green/10 text-arena-green font-mono text-[9px]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleOAuth}
                className="w-full px-4 py-2.5 rounded-md bg-arena-green/15 text-arena-green border border-arena-green/30 font-mono text-[11px] font-medium hover:bg-arena-green/25 transition-colors"
              >
                ▶ Authorize {cfg.label}
              </button>
            </div>
          ) : cfg.method === "wallet" ? (
            /* Wallet connection */
            <div className="space-y-4">
              <div className="arena-inset px-4 py-3 rounded-md">
                <p className="text-[11px] text-arena-secondary leading-relaxed">
                  Connect via Freighter wallet extension for secure transaction
                  signing. Your secret key never leaves your wallet.
                </p>
              </div>
              <button className="w-full px-4 py-2.5 rounded-md bg-arena-green/15 text-arena-green border border-arena-green/30 font-mono text-[11px] font-medium hover:bg-arena-green/25 transition-colors">
                ▶ Connect Freighter Wallet
              </button>
            </div>
          ) : (
            /* Token/key/JSON form */
            <div className="space-y-3">
              {cfg.fields?.map((field) => (
                <FieldInput
                  key={field.key}
                  field={field}
                  value={values[field.key] || ""}
                  onChange={(v) => setValues({ ...values, [field.key]: v })}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-3 font-mono text-[10px] text-arena-red bg-arena-red/10 border border-arena-red/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          {/* Test result */}
          {testResult && (
            <div
              className={`mt-3 font-mono text-[10px] rounded px-3 py-2 ${
                testResult.ok
                  ? "text-arena-green bg-arena-green/10 border border-arena-green/30"
                  : "text-arena-red bg-arena-red/10 border border-arena-red/30"
              }`}
            >
              {testResult.msg}
            </div>
          )}

          {/* Help link */}
          {cfg.helpUrl && (
            <div className="mt-3 text-center">
              <a
                href={cfg.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[9px] text-arena-muted hover:text-arena-green transition-colors"
              >
                ↗ Where to find your {cfg.label} credentials
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        {cfg.method !== "oauth" && cfg.method !== "wallet" && (
          <div className="px-5 py-3 border-t border-arena-border flex items-center justify-between">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-arena-inset border border-arena-border font-mono text-[10px] text-arena-muted hover:text-arena-text transition-colors"
            >
              CANCEL
            </button>
            <button
              onClick={handleSave}
              disabled={saving || testing}
              className="px-4 py-1.5 rounded bg-arena-green/15 text-arena-green border border-arena-green/30 font-mono text-[10px] font-medium hover:bg-arena-green/25 disabled:opacity-40 transition-colors"
            >
              {saving
                ? "SAVING…"
                : testing
                  ? "TESTING…"
                  : "CONNECT"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ConnectField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="arena-label text-[8px] block mb-1">
        {field.label}
        {field.required && <span className="text-arena-red ml-1">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="w-full bg-arena-inset border border-arena-border rounded-md px-3 py-2 text-[11px] font-mono text-arena-text placeholder:text-arena-muted/40 focus:outline-none focus:border-arena-green/40 transition-colors resize-none"
        />
      ) : (
        <input
          type={field.type === "password" ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-arena-inset border border-arena-border rounded-md px-3 py-2 text-[11px] font-mono text-arena-text placeholder:text-arena-muted/40 focus:outline-none focus:border-arena-green/40 transition-colors"
        />
      )}
      {field.helpText && (
        <p className="mt-1 text-[9px] text-arena-muted">{field.helpText}</p>
      )}
    </div>
  );
}
