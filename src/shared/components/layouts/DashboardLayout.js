"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/store/notificationStore";
import Sidebar from "../Sidebar";
import Header from "../Header";

// ─── toast icons ─────────────────────────────────────────────────────────────
const IcoCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoError = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IcoWarn = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcoInfo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IcoX = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>;

function getToastConfig(type) {
  if (type === "success") return { icon: IcoCheck, color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)" };
  if (type === "error") return { icon: IcoError, color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };
  if (type === "warning") return { icon: IcoWarn, color: "#F59E0B", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" };
  return { icon: IcoInfo, color: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" };
}

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const notifications = useNotificationStore((state) => state.notifications);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  const isChat = pathname === "/dashboard/basic-chat";

  return (
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "var(--color-bg)", position: "relative" }}>
      {/* Ambient editorial glow — Cuties/Mahiru inspired */}
      <div aria-hidden="true" className="theme-ambient-bg" style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        opacity: 1, zIndex: 0,
      }} />

      {/* Toast notifications */}
      <div style={{ position: "fixed", top: "16px", right: "16px", zIndex: 80, display: "flex", flexDirection: "column", gap: "8px", width: "min(92vw, 360px)" }}>
        {notifications.map((n) => {
          const cfg = getToastConfig(n.type);
          const Icon = cfg.icon;
          return (
            <div key={n.id} style={{
              display: "flex", alignItems: "flex-start", gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              backdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
              <span style={{ color: cfg.color, flexShrink: 0, marginTop: "1px" }}><Icon /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {n.title && <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-main)", marginBottom: "2px" }}>{n.title}</p>}
                <p style={{ fontSize: "12px", color: "var(--color-text-muted)", whiteSpace: "pre-wrap", wordBreak: "break-words" }}>{n.message}</p>
              </div>
              {n.dismissible && (
                <button onClick={() => removeNotification(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-subtle)", flexShrink: 0, display: "flex", padding: "2px" }}>
                  <IcoX />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          className="lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <div className="hidden lg:flex" style={{ flexShrink: 0, alignItems: "stretch" }}>
        <Sidebar />
      </div>

      {/* Sidebar mobile */}
      <div
        className="lg:hidden"
        style={{
          position: "fixed", inset: "0 auto 0 0", zIndex: 50,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)",
          width: "min(92vw, 360px)",
          maxWidth: "min(92vw, 360px)",
          boxShadow: sidebarOpen ? "0 24px 60px rgba(23,33,27,0.24)" : "none",
        }}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} forceExpanded={true} />
      </div>

      {/* Main */}
      <main style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minWidth: 0, position: "relative", overflow: "hidden", zIndex: 1 }}>
        {/* Subtle dot grid background */}
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, rgba(255, 255, 255, 0.025) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent 70%)",
        }} />

        <Header key={pathname} onMenuClick={() => setSidebarOpen(true)} />

        <div style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
          padding: isChat ? "0" : "clamp(10px, 2.5vw, 22px)",
          display: isChat ? "flex" : "block",
          flexDirection: isChat ? "column" : undefined,
        }}
          className="custom-scrollbar"
        >
          <div style={{
            maxWidth: isChat ? "100%" : "1280px",
            margin: isChat ? "0" : "0 auto",
            width: "100%",
            height: isChat ? "100%" : undefined,
            display: isChat ? "flex" : undefined,
            flexDirection: isChat ? "column" : undefined,
          }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
