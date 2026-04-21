/**
 * Captures and exposes the current Dataverse environment's Web API URL.
 *
 * The Power Apps Code App SDK does not publicly expose the org URL, but for
 * single-record retrieves the SDK passes the raw response payload through to
 * the caller — including the `@odata.context` annotation that contains the
 * full instance URL, e.g.:
 *
 *   "@odata.context": "https://ralop-prov.crm.dynamics.com/api/data/v9.2/$metadata#conversationtranscripts/$entity"
 *
 * We grab that the first time we see it and cache it in localStorage so the
 * link is available even before the next single-record fetch.
 */

const STORAGE_KEY = "mcsViewer.dataverseOrgUrl";

let cached: string | null = null;

/** Returns the cached Dataverse org URL (e.g. "https://ralop-prov.crm.dynamics.com"), or null. */
export function getDataverseOrgUrl(): string | null {
  if (cached) return cached;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) cached = stored;
  } catch {
    // localStorage may be unavailable in some embedded contexts
  }
  return cached;
}

/**
 * Inspect a record returned by the Power Apps SDK for its `@odata.context`
 * annotation and, if present, extract+cache the org URL.
 *
 * Safe to call repeatedly with any record-shaped object; no-op when the
 * annotation is missing or already cached.
 */
export function captureOrgUrlFromRecord(record: unknown): void {
  if (cached) return;
  if (!record || typeof record !== "object") return;
  const ctx = (record as Record<string, unknown>)["@odata.context"];
  if (typeof ctx !== "string") return;

  // Format: https://<org>.crm.dynamics.com/api/data/vX.Y/$metadata#...
  // Take everything up to and including "/api/data/vX.Y" so we can append "/<entitySet>(<id>)".
  const m = ctx.match(/^(https:\/\/[^/]+\/api\/data\/v\d+(?:\.\d+)?)\//i);
  if (!m) return;
  const apiBase = m[1];
  // Strip the "/api/data/vX.Y" suffix to get the bare host base for general use.
  const host = apiBase.replace(/\/api\/data\/v\d+(?:\.\d+)?$/i, "");
  cached = host;
  try {
    localStorage.setItem(STORAGE_KEY, host);
  } catch {
    // ignore
  }
}

/**
 * Build the Web API URL for a specific record:
 *   <orgUrl>/api/data/v9.2/<entitySet>(<id>)
 * Returns null when the org URL has not been discovered yet.
 */
export function buildRecordWebApiUrl(entitySet: string, id: string): string | null {
  const host = getDataverseOrgUrl();
  if (!host) return null;
  return `${host}/api/data/v9.2/${entitySet}(${id})`;
}
