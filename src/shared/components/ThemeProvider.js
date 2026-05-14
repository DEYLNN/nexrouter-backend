"use client";

// Light-mode-only build: ThemeProvider is a no-op shell.
// Kept exported so existing imports in src/app/layout.js keep working.
export function ThemeProvider({ children }) {
  return <>{children}</>;
}
