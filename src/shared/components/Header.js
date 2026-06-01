"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { translate } from "@/i18n/runtime";

// ─── icons ────────────────────────────────────────────────────────────────────
const I = {
  menu: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  chevron: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m9 18 6-6-6-6"/></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  close: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  user: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  logout: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  settings: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  endpoint: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>,
  providers: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="5" rx="1"/><circle cx="18" cy="5.5" r="1" fill="currentColor"/><circle cx="18" cy="12.5" r="1" fill="currentColor"/><circle cx="18" cy="19.5" r="1" fill="currentColor"/></svg>,
  combos: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  usage: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  quota: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  terminal: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  translate: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 8h14M5 8a2 2 0 010-4h14a2 2 0 010 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12"/></svg>,
  settingsPage: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  key: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l3 3"/></svg>,
  monitor: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  dot: <svg width="7" height="7" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="#10B981"/></svg>,
};

const PAGE_ICON_MAP = {
  api: I.endpoint,
  dns: I.providers,
  layers: I.combos,
  bar_chart: I.usage,
  data_usage: I.quota,
  settings: I.settingsPage,
  terminal: I.terminal,
  translate: I.translate,
  vpn_key: I.key,
  monitor: I.monitor,
};

function getPageInfo(pathname) {
  if (!pathname) return { title: "", description: "", breadcrumbs: [] };
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const id = providerMatch[1];
    const info = OAUTH_PROVIDERS[id] || APIKEY_PROVIDERS[id] || AI_PROVIDERS[id];
    if (info) return {
      title: info.name, description: "", breadcrumbs: [
        { label: "Providers", href: "/dashboard/providers" },
        { label: info.name, image: `/providers/${info.id}.png` },
      ],
    };
  }
  if (pathname.includes("/public-models")) return { title: "Models", description: "Control which models are exposed by /v1/models", icon: "models", breadcrumbs: [] };
  if (pathname.includes("/providers")) return { title: "Providers", description: "Manage AI provider connections", icon: "dns", breadcrumbs: [] };
  if (pathname.includes("/combos")) return { title: "Combos", description: "Model combos with fallback routing", icon: "layers", breadcrumbs: [] };
  if (pathname.includes("/usage")) return { title: "Usage", description: "Monitor API usage and token consumption", icon: "bar_chart", breadcrumbs: [] };
  if (pathname.includes("/auth-files")) return { title: "Auth Files", description: "Credential mapping", icon: "vpn_key", breadcrumbs: [] };
  if (pathname.includes("/quota")) return { title: "Quota", description: "Track and manage API quota limits", icon: "data_usage", breadcrumbs: [] };
  if (pathname.includes("/endpoint")) return { title: "Endpoint", description: "API endpoint configuration", icon: "api", breadcrumbs: [] };
  if (pathname.includes("/profile")) return { title: "Settings", description: "Preferences and configuration", icon: "settings", breadcrumbs: [] };
  if (pathname.includes("/translator")) return { title: "Translator", description: "Debug translation flow", icon: "translate", breadcrumbs: [] };
  if (pathname.includes("/console-log")) return { title: "Console", description: "Live server output", icon: "monitor", breadcrumbs: [] };
  if (pathname === "/dashboard") return { title: "Endpoint", description: "API endpoint configuration", icon: "api", breadcrumbs: [] };
  return { title: "", description: "", breadcrumbs: [] };
}

// ─── profile menu ─────────────────────────────────────────────────────────────
function ProfileMenu({ onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "32px", height: "32px", borderRadius: "50%",
          background: open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)",
          border: "1px solid var(--theme-shell-border)",
          color: "var(--theme-shell-text)", cursor: "pointer",
          transition: "all 150ms ease",
        }}
        onMouseEnter={e => { if (!open) e.currentTarget.style.background = "var(--theme-shell-active-bg)"; }}
        onMouseLeave={e => { if (!open) e.currentTarget.style.background = "var(--theme-shell-hover)"; }}
      >
        {I.user}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: "180px", borderRadius: "10px",
          background: "var(--theme-shell-bg)",
          backdropFilter: "blur(18px) saturate(140%)",
          WebkitBackdropFilter: "blur(18px) saturate(140%)",
          border: "1px solid var(--theme-shell-border)",
          boxShadow: "0 16px 48px rgba(23,33,27,0.18)",
          zIndex: 100, overflow: "hidden",
          animation: "fadeIn 100ms ease",
        }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--theme-shell-text)" }}>NexRouter</div>
            <div style={{ fontSize: "11px", color: "var(--theme-shell-text-subtle)", marginTop: "1px" }}>NexRouter</div>
          </div>
          <div style={{ padding: "6px" }}>
            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "7px 8px", borderRadius: "6px",
                fontSize: "13px", color: "var(--theme-shell-text-muted)",
                textDecoration: "none", transition: "all 150ms ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--theme-shell-hover)"; e.currentTarget.style.color = "var(--theme-shell-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--theme-shell-text-muted)"; }}
            >
              {I.settings} Settings
            </Link>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "7px 8px", borderRadius: "6px",
                fontSize: "13px", color: "rgba(239,68,68,0.7)",
                background: "transparent", border: "none",
                cursor: "pointer", transition: "all 150ms ease",
                textAlign: "left",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(239,68,68,0.7)"; }}
            >
              {I.logout} Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── header search ────────────────────────────────────────────────────────────
function HeaderSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const placeholder = useHeaderSearchStore((s) => s.placeholder);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);
  const [focused, setFocused] = useState(false);

  if (!visible) return null;

  return (
    <div style={{ position: "relative", width: "clamp(120px, 28vw, 200px)" }}>
      <span style={{
        position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)",
        color: focused ? "rgba(59,130,246,0.7)" : "rgba(255,255,255,0.25)",
        display: "flex", pointerEvents: "none",
        transition: "color 150ms ease",
      }}>
        {I.search}
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          height: "34px", paddingLeft: "30px", paddingRight: query ? "28px" : "10px",
          borderRadius: "7px",
          border: focused ? "1px solid rgba(59,130,246,0.4)" : "1px solid var(--theme-shell-border)",
          background: focused ? "rgba(59,130,246,0.05)" : "rgba(255,255,255,0.04)",
          color: "var(--theme-shell-text)",
          fontSize: "12px", outline: "none",
          transition: "all 150ms ease",
        }}
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          style={{
            position: "absolute", right: "7px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--theme-shell-text-subtle)", display: "flex", padding: "2px",
          }}
        >
          {I.close}
        </button>
      )}
    </div>
  );
}

// ─── status dot ───────────────────────────────────────────────────────────────
function StatusDot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }} title="Gateway online">
      {I.dot}
      <span style={{ fontSize: "11px", color: "var(--theme-shell-text-subtle)", fontWeight: 500 }}>Live</span>
    </div>
  );
}

// ─── header ───────────────────────────────────────────────────────────────────
export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const router = useRouter();
  const pageInfo = useMemo(() => getPageInfo(pathname), [pathname]);
  const { title, description, icon, breadcrumbs } = pageInfo;

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) { router.push("/login"); router.refresh(); }
    } catch (err) { console.error("Failed to logout:", err); }
  };

  return (
    <header style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "12px",
      height: "60px",
      margin: "12px 12px 0",
      padding: "0 clamp(12px, 2.5vw, 22px)",
      background: "var(--theme-shell-bg)",
      backdropFilter: "blur(20px) saturate(150%)",
      WebkitBackdropFilter: "blur(20px) saturate(150%)",
      border: "1px solid var(--theme-shell-border)",
      borderRadius: "22px",
      boxShadow: "var(--theme-glass-shadow)",
      flexShrink: 0,
      zIndex: 20,
      position: "sticky",
      top: 12,
    }}>

      {/* Left */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
        {showMenuButton && (
          <>
            <button
              onClick={onMenuClick}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "40px", height: "40px", borderRadius: "14px",
                background: "transparent", border: "none",
                color: "var(--theme-shell-text-muted)", cursor: "pointer",
                transition: "all 150ms ease", flexShrink: 0,
              }}
              className="lg:hidden"
              onMouseEnter={e => { e.currentTarget.style.background = "var(--theme-shell-hover)"; e.currentTarget.style.color = "var(--theme-shell-text)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--theme-shell-text-muted)"; }}
            >
              {I.menu}
            </button>
            <style>{`@media (min-width: 1024px) { .mobile-menu-btn { display: none !important; } }`}</style>
          </>
        )}

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 ? (() => {
          const current = breadcrumbs[breadcrumbs.length - 1];
          const parent = [...breadcrumbs].reverse().find((crumb) => crumb.href);
          return (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
              {current.image && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "12px", flexShrink: 0, background: "var(--theme-shell-hover)", border: "1px solid var(--theme-shell-border)" }}>
                  <ProviderIcon src={current.image} alt={current.label} size={30} className="object-contain rounded-lg max-w-[30px] max-h-[30px]" fallbackText={current.label.slice(0, 2).toUpperCase()} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--theme-shell-text)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {translate(current.label)}
                </div>
                {parent && (
                  <div className="hidden lg:block" style={{ fontSize: "12px", color: "var(--theme-shell-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {translate(parent.label)} settings
                  </div>
                )}
              </div>
            </div>
          );
        })() : title ? (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--theme-shell-text)", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {translate(title)}
            </span>
            {description && (
              <span className="hidden lg:block" style={{ fontSize: "12px", color: "var(--theme-shell-text-subtle)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {translate(description)}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <div className="hidden sm:flex">
          <StatusDot />
        </div>
        <HeaderSearch />
        <ProfileMenu onLogout={handleLogout} />
      </div>
    </header>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};

export { HeaderSearch };
