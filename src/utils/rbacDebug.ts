/**
 * RBAC diagnostic logging helper.
 *
 * Toggle in DevTools console:
 *   window.__RBAC_DEBUG = true   // verbose
 *   window.__RBAC_DEBUG = false  // silent
 *
 * Default is ON until we close out the RBAC investigation.
 */

declare global {
  interface Window {
    __RBAC_DEBUG?: boolean;
    __RBAC_LOG?: Array<{ ts: string; tag: string; payload: unknown }>;
  }
}

if (typeof window !== "undefined" && window.__RBAC_DEBUG === undefined) {
  window.__RBAC_DEBUG = true;
  window.__RBAC_LOG = [];
}

export function rbacLog(tag: string, payload: unknown): void {
  if (typeof window === "undefined" || window.__RBAC_DEBUG !== true) return;
  const entry = { ts: new Date().toISOString(), tag, payload };
  (window.__RBAC_LOG ??= []).push(entry);
  // Keep the in-memory ring small (last 200 events)
  if (window.__RBAC_LOG.length > 200) window.__RBAC_LOG.splice(0, window.__RBAC_LOG.length - 200);
  // Use console.info so it shows up in default DevTools filter
  console.info(`%c[RBAC]%c ${tag}`, "color:#fff;background:#b00;padding:1px 4px;border-radius:3px;font-weight:bold;", "color:inherit", payload);
}

export function dumpRbacLog(): void {
  console.table((window.__RBAC_LOG ?? []).map(e => ({ ts: e.ts, tag: e.tag })));
  console.log("Full entries:", window.__RBAC_LOG);
}

if (typeof window !== "undefined") {
  // expose for ad-hoc inspection
  (window as unknown as { dumpRbacLog: typeof dumpRbacLog }).dumpRbacLog = dumpRbacLog;
}
