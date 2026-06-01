"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Button from "./Button";
import { ConfirmModal } from "./Modal";

// ─── icons ────────────────────────────────────────────────────────────────────
const I = {
  logo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/></svg>,
  endpoint: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  providers: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="5" rx="1"/><circle cx="18" cy="5.5" r="1" fill="currentColor"/><circle cx="18" cy="12.5" r="1" fill="currentColor"/><circle cx="18" cy="19.5" r="1" fill="currentColor"/></svg>,
  combos: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  models: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><path d="M15 16h4M17 14v4"/></svg>,
  usage: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  quota: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  auth: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7.5" cy="14.5" r="3.5"/><path d="M10.3 12.2 21 1.5M15 8l2 2M18 5l2 2"/></svg>,
  terminal: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  translate: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 8h14M5 8a2 2 0 010-4h14a2 2 0 010 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12"/></svg>,
  settings: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  power: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10"/></svg>,
  update: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/></svg>,
  chevronRight: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>,
  chevronLeft: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>,
};

const ICON_MAP = {
  api: I.endpoint,
  dns: I.providers,
  layers: I.combos,
  models: I.models,
  bar_chart: I.usage,
  data_usage: I.quota,
  vpn_key: I.auth,
  terminal: I.terminal,
  translate: I.translate,
  settings: I.settings,
};

const NAV_MAIN = [
  { href: "/dashboard/endpoint", label: "Endpoint", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/public-models", label: "Models", icon: "models" },
  { href: "/dashboard/combos", label: "Combos", icon: "layers" },
];

const NAV_ANALYTICS = [
  { href: "/dashboard/usage", label: "Usage", icon: "bar_chart" },
  { href: "/dashboard/auth-files", label: "Auth Files", icon: "vpn_key" },
  { href: "/dashboard/quota", label: "Quota", icon: "data_usage" },
];

const NAV_SYSTEM = [
  { href: "/dashboard/console-log", label: "Console", icon: "terminal" },
  { href: "/dashboard/profile", label: "Settings", icon: "settings" },
];

// ─── nav item ─────────────────────────────────────────────────────────────────
function NavItem({ href, label, icon, onClose, collapsed }) {
  const pathname = usePathname();
  const active = href === "/dashboard/endpoint"
    ? pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint")
    : pathname.startsWith(href);
  const Icon = ICON_MAP[icon];

  return (
    <Link
      href={href}
      onClick={onClose}
      title={collapsed ? label : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: collapsed ? 0 : "11px",
        justifyContent: collapsed ? "center" : "flex-start",
        height: "40px",
        padding: collapsed ? "0 12px" : "0 13px",
        borderRadius: "15px",
        fontSize: "13px",
        fontWeight: active ? 650 : 500,
        textDecoration: "none",
        color: active ? "var(--theme-shell-text)" : "var(--theme-shell-text-muted)",
        background: active ? "linear-gradient(135deg, rgba(14,142,142,0.14), rgba(29,85,212,0.08))" : "transparent",
        border: active ? "1px solid rgba(14,142,142,0.18)" : "1px solid transparent",
        boxShadow: active ? "0 12px 24px -18px rgba(14,142,142,0.32)" : "none",
        transition: "all 160ms ease",
        marginBottom: "4px",
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = "var(--theme-shell-text)";
          e.currentTarget.style.background = "var(--theme-shell-hover)";
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = "var(--theme-shell-text-muted)";
          e.currentTarget.style.background = "transparent";
        }
      }}
    >
      <span style={{
        flexShrink: 0,
        display: "flex",
        color: active ? "var(--theme-accent-teal)" : "inherit",
        opacity: active ? 1 : 0.8,
      }}>
        {Icon}
      </span>
      {!collapsed && (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
    </Link>
  );
}

// ─── section label ────────────────────────────────────────────────────────────
function SectionLabel({ label, collapsed }) {
  if (collapsed) return <div style={{ height: "1px", background: "var(--theme-shell-hover)", margin: "8px 6px" }} />;
  return (
    <div style={{ padding: "0 10px", marginTop: "18px", marginBottom: "4px" }}>
      <span style={{
        fontSize: "10px", fontWeight: 600,
        color: "var(--theme-shell-text-subtle)",
        textTransform: "uppercase", letterSpacing: "0.09em",
      }}>
        {label}
      </span>
    </div>
  );
}

// ─── sidebar ──────────────────────────────────────────────────────────────────
export default function Sidebar({ onClose, forceExpanded }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showShutdownModal, setShowShutdownModal] = useState(false);
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);
  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;
  const isCollapsed = forceExpanded ? false : collapsed;

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => { if (d.enableTranslator) setEnableTranslator(true); }).catch(() => {});
    fetch("/api/version").then(r => r.json()).then(d => { if (d.hasUpdate) setUpdateInfo(d); }).catch(() => {});
  }, []);

  // Auto-collapse on narrow desktop / tablet (between 1024 and 1280px)
  useEffect(() => {
    if (forceExpanded) return;
    const check = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 0;
      if (w >= 1024 && w < 1280) setCollapsed(true);
      else if (w >= 1280) setCollapsed(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [forceExpanded]);

  const handleUpdate = () => { setShowUpdateModal(false); setIsUpdating(true); };

  const handleCopyAndShutdown = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch {}
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        setIsDisconnected(true);
      }
    }, 1000);
  };

  const handleCancelUpdate = () => { setIsUpdating(false); setShutdownCountdown(0); };

  const handleShutdown = async () => {
    setIsShuttingDown(true);
    try { await fetch("/api/shutdown", { method: "POST" }); } catch {}
    setIsShuttingDown(false);
    setShowShutdownModal(false);
    setIsDisconnected(true);
  };

  const w = isCollapsed ? "68px" : (forceExpanded ? "min(340px, calc(100vw - 28px))" : "248px");

  return (
    <>
      <aside style={{
        display: "flex",
        flexDirection: "column",
        width: w,
        height: "calc(100% - 24px)",
        margin: "12px",
        background: "var(--theme-shell-bg)",
        backdropFilter: "blur(20px) saturate(150%)",
        WebkitBackdropFilter: "blur(20px) saturate(150%)",
        border: "1px solid var(--theme-shell-border)",
        borderRadius: "24px",
        boxShadow: "var(--theme-glass-shadow)",
        transition: "width 200ms cubic-bezier(0.4,0,0.2,1), border-radius 200ms ease",
        overflow: "hidden",
        flexShrink: 0,
      }}>

        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "space-between",
          padding: "18px 14px 14px",
          flexShrink: 0,
        }}>
          {!isCollapsed ? (
            <>
              <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: "9px", textDecoration: "none" }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "13px",
                  background: "linear-gradient(135deg, var(--theme-accent-teal) 0%, var(--theme-accent-blue) 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--theme-shell-text)", flexShrink: 0,
                  boxShadow: "0 6px 18px -6px rgba(17, 166, 166, 0.55)",
                }}>
                  {I.logo}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--theme-shell-text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
                    {APP_CONFIG.name}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--theme-shell-text-subtle)", marginTop: "1px" }}>
                    v{APP_CONFIG.version}
                  </div>
                </div>
              </Link>
              {!forceExpanded && (
                <button
                  onClick={() => setCollapsed(true)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "24px", height: "24px", borderRadius: "6px",
                    background: "transparent", border: "none",
                    color: "var(--theme-shell-text-subtle)", cursor: "pointer",
                    transition: "all 150ms ease", flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--theme-shell-hover)"; e.currentTarget.style.color = "var(--theme-shell-text-muted)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--theme-shell-text-subtle)"; }}
                >
                  {I.chevronLeft}
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "34px", height: "34px", borderRadius: "13px",
                background: "linear-gradient(135deg, var(--theme-accent-teal) 0%, var(--theme-accent-blue) 100%)",
                border: "none", color: "var(--theme-shell-text)", cursor: "pointer",
                boxShadow: "0 6px 18px -6px rgba(17, 166, 166, 0.55)",
              }}
              title="Expand sidebar"
            >
              {I.logo}
            </button>
          )}
        </div>

        {/* Update banner */}
        {updateInfo && !isCollapsed && (
          <div style={{ margin: "0 10px 10px", padding: "8px 10px", borderRadius: "8px", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#F59E0B", fontWeight: 600 }}>v{updateInfo.latestVersion} available</span>
              <button onClick={() => setShowUpdateModal(true)} style={{
                display: "flex", alignItems: "center", gap: "3px",
                padding: "2px 7px", borderRadius: "4px",
                background: "#F59E0B", border: "none",
                color: "#000", fontSize: "10px", fontWeight: 700, cursor: "pointer",
              }}>
                {I.update} Update
              </button>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "4px 8px", overflowY: "auto", overflowX: "hidden" }}>
          {NAV_MAIN.map(item => (
            <NavItem key={item.href} {...item} onClose={onClose} collapsed={isCollapsed} />
          ))}

          <SectionLabel label="Analytics" collapsed={isCollapsed} />
          {NAV_ANALYTICS.map(item => (
            <NavItem key={item.href} {...item} onClose={onClose} collapsed={isCollapsed} />
          ))}

          <SectionLabel label="System" collapsed={isCollapsed} />
          {NAV_SYSTEM.map(item => (
            <NavItem key={item.href} {...item} onClose={onClose} collapsed={isCollapsed} />
          ))}
          {enableTranslator && (
            <NavItem href="/dashboard/translator" label="Translator" icon="translate" onClose={onClose} collapsed={isCollapsed} />
          )}
        </nav>

        {/* Footer */}
        <div style={{
          padding: "10px 8px 14px",
          borderTop: "1px solid var(--theme-shell-border)",
          flexShrink: 0,
        }}>
          {!isCollapsed ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "0 4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <div style={{
                  width: "26px", height: "26px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #3B82F6, #A855F7)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--theme-shell-text)", fontSize: "11px", fontWeight: 700, flexShrink: 0,
                }}>
                  A
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--theme-shell-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Admin
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--theme-shell-text-subtle)" }}>
                    Gateway
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowShutdownModal(true)}
                title="Shutdown"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "28px", height: "28px", borderRadius: "7px",
                  background: "transparent", border: "none",
                  color: "rgba(239,68,68,0.45)", cursor: "pointer",
                  transition: "all 150ms ease", flexShrink: 0,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(239,68,68,0.45)"; }}
              >
                {I.power}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowShutdownModal(true)}
              title="Shutdown"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "100%", height: "32px", borderRadius: "7px",
                background: "transparent", border: "none",
                color: "rgba(239,68,68,0.4)", cursor: "pointer",
                transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(239,68,68,0.4)"; }}
            >
              {I.power}
            </button>
          )}
        </div>
      </aside>

      {/* Modals */}
      <ConfirmModal
        isOpen={showShutdownModal}
        onClose={() => setShowShutdownModal(false)}
        onConfirm={handleShutdown}
        title="Close Proxy"
        message="Are you sure you want to close the proxy server?"
        confirmText="Close"
        cancelText="Cancel"
        variant="danger"
        loading={isShuttingDown}
      />
      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update NexRouter"
        message={`Show install command for v${updateInfo?.latestVersion || ""}?`}
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {(isDisconnected || isUpdating) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", padding: "24px" }}>
          {isUpdating ? (
            <ManualUpdatePanel
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div style={{ textAlign: "center", padding: "32px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#ef4444" }}>
                {I.power}
              </div>
              <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--theme-shell-text)", marginBottom: "8px" }}>Server Disconnected</h2>
              <p style={{ color: "var(--theme-shell-text-muted)", marginBottom: "20px", fontSize: "13px" }}>The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>Reload Page</Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = { onClose: PropTypes.func, forceExpanded: PropTypes.bool };

function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div style={{ width: "100%", maxWidth: "460px", borderRadius: "12px", background: "#111113", border: "1px solid var(--theme-shell-border)", padding: "24px", color: "var(--theme-shell-text)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B", flexShrink: 0 }}>
          {I.update}
        </div>
        <div>
          <h2 style={{ fontSize: "15px", fontWeight: 600, marginBottom: "2px" }}>Update NexRouter{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p style={{ fontSize: "12px", color: "var(--theme-shell-text-muted)" }}>
            {isDisconnected ? "Server stopped. Paste the command into a terminal." : isCountingDown ? `Shutting down in ${countdown}s...` : "Copy the install command and shutdown to update."}
          </p>
        </div>
      </div>
      <div style={{ background: "var(--theme-shell-hover)", borderRadius: "7px", padding: "10px 12px", marginBottom: "16px" }}>
        <code style={{ fontSize: "12px", fontFamily: "monospace", color: "#F59E0B", wordBreak: "break-all" }}>{installCmd}</code>
      </div>
      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>Reload Page</Button>
      ) : (
        <div style={{ display: "flex", gap: "8px" }}>
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>Cancel</Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied ? "✓ Copied — shutting down..." : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
