import { useState, useEffect, useCallback, useRef } from "react";
import { AadusersService } from "../generated/services/AadusersService";
import { BotsService } from "../generated/services/BotsService";
import { Office365UsersService } from "../generated/services/Office365UsersService";
import type { Aadusers } from "../generated/models/AadusersModel";
import type { User as GraphSearchUser } from "../generated/models/Office365UsersModel";
import { rbacLog } from "../utils/rbacDebug";

// ── AAD User Lookup ──────────────────────────────────────────────────

export interface AadUser {
  aaduserid: string;
  objectId: string;         // The AAD Object ID used in transcripts
  displayname: string;
  mail: string;
  userprincipalname: string;
  givenname: string;
  surname: string;
  jobtitle: string;
}

function toAadUser(raw: Aadusers): AadUser {
  return {
    aaduserid: raw.aaduserid ?? "",
    objectId: raw.id ?? raw.aaduserid ?? "",
    displayname: raw.displayname ?? "",
    mail: raw.mail ?? "",
    userprincipalname: raw.userprincipalname ?? "",
    givenname: raw.givenname ?? "",
    surname: raw.surname ?? "",
    jobtitle: raw.jobtitle ?? "",
  };
}

function fromGraphSearchUser(raw: GraphSearchUser): AadUser {
  return {
    aaduserid: raw.Id ?? "",
    objectId: raw.Id ?? "",
    displayname: raw.DisplayName ?? "",
    mail: raw.Mail ?? "",
    userprincipalname: raw.UserPrincipalName ?? "",
    givenname: raw.GivenName ?? "",
    surname: raw.Surname ?? "",
    jobtitle: raw.JobTitle ?? "",
  };
}

/**
 * Search AAD users by name or email.
 * Returns matching users for typeahead suggestions.
 *
 * In normal mode (caller has prvReadaaduser) → queries the aadusers virtual
 * table with a contains() filter. In adhoc mode → falls back to the Office
 * 365 Users (Graph) connector via SearchUserV2.
 *
 * Cancellation: an internal request id discards stale responses so a slow
 * Graph reply that arrives after the user typed more characters does NOT
 * overwrite the more-recent results.
 */
export function useAadUserSearch() {
  const [results, setResults] = useState<AadUser[]>([]);
  const [loading, setLoading] = useState(false);
  const reqIdRef = useRef(0);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      let users: AadUser[];

      if (_adhocMode) {
        const t0 = performance.now();
        rbacLog("Office365UsersService.SearchUserV2 → REQUEST", { query, top: 10 });
        const result = await Office365UsersService.SearchUserV2(query, 10);
        if (reqId !== reqIdRef.current) return; // stale response — drop
        const value = result.data?.value ?? [];
        users = value.map(fromGraphSearchUser);
        rbacLog("Office365UsersService.SearchUserV2 → RESPONSE", {
          elapsedMs: Math.round(performance.now() - t0),
          rowCount: users.length,
        });
      } else {
        const filter = [
          `contains(displayname,'${escapeOData(query)}')`,
          `contains(mail,'${escapeOData(query)}')`,
          `contains(userprincipalname,'${escapeOData(query)}')`,
        ].join(" or ");

        const result = await AadusersService.getAll({
          select: ["aaduserid", "id", "displayname", "mail", "userprincipalname", "givenname", "surname", "jobtitle"],
          filter,
          maxPageSize: 10,
        });
        if (reqId !== reqIdRef.current) return;
        users = (result.data ?? []).map(toAadUser);
      }

      setResults(users);
    } catch (err) {
      if (reqId !== reqIdRef.current) return;
      console.error("[AadUserSearch] Error:", err instanceof Error ? err.message : "Unknown error");
      setResults([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  return { results, loading, search };
}

// ── AAD User Display Name Cache ──────────────────────────────────────
//
// Two-tier resolution model:
//
//   Normal mode (caller has prvReadaaduser on aadusers virtual table):
//     - List render & detail mount both resolve via AadusersService.getAll
//       with `id eq '<guid>'`. Names cached in L1 (Map) + L2 (sessionStorage).
//
//   Adhoc mode (caller can't read aadusers — typical "Bot Transcript Viewer"):
//     - First aadusers query that returns 0 rows flips `_adhocMode = true`
//       (persisted to sessionStorage so it survives component remounts).
//     - From that point on, list-render lookups become PURE CACHE READS:
//       no network calls, unresolved ids show as raw GUIDs.
//     - Detail mount passes `{ eager: true }` → falls back to
//       Office365UsersService.UserProfile_V2 (Graph connector,
//       caller-identity, default-license `User.ReadBasic.All`) for each
//       unresolved participant id. Result cached → list rows pick up the
//       name on the next render.

const SS_DISPLAY_PREFIX = "udn:v1:"; // user display name cache key prefix
const SS_ADHOC_FLAG = "udn:adhoc:v1";

const _userDisplayCache = new Map<string, string>();
const _pendingUserLookups = new Set<string>();
let _userLookupPromise: Promise<void> | null = null;
let _adhocMode = loadAdhocFlag();

function loadFromSession(id: string): string | null {
  try {
    const raw = sessionStorage.getItem(SS_DISPLAY_PREFIX + id);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { name?: unknown };
    return typeof obj?.name === "string" ? obj.name : null;
  } catch {
    return null;
  }
}

function saveToSession(id: string, name: string): void {
  try {
    sessionStorage.setItem(
      SS_DISPLAY_PREFIX + id,
      JSON.stringify({ name, ts: Date.now() })
    );
  } catch {
    // sessionStorage unavailable (private mode, quota, SSR) → silent no-op
  }
}

function loadAdhocFlag(): boolean {
  try {
    return sessionStorage.getItem(SS_ADHOC_FLAG) === "1";
  } catch {
    return false;
  }
}

function persistAdhocFlag(): void {
  try {
    sessionStorage.setItem(SS_ADHOC_FLAG, "1");
  } catch {
    // sessionStorage unavailable → flag still kept in module memory
  }
}

/**
 * Public setter for adhoc mode. Called by App.tsx boot probe when the
 * aadusers `top:1` probe returns 0 rows (caller lacks `prvReadaaduser`),
 * so the typeahead and display-name lookups can switch to the Graph
 * fallback proactively rather than waiting for a list-render to flip
 * the flag mid-resolve.
 */
export function setAdhocMode(value: boolean): void {
  _adhocMode = value;
  try {
    if (value) sessionStorage.setItem(SS_ADHOC_FLAG, "1");
    else sessionStorage.removeItem(SS_ADHOC_FLAG);
  } catch {
    // sessionStorage unavailable → flag still kept in module memory
  }
}

export function getAdhocMode(): boolean {
  return _adhocMode;
}

/** TEST-ONLY: reset module state between vi tests. Not exported via index. */
export function __resetUserDisplayCacheForTests(): void {
  _userDisplayCache.clear();
  _pendingUserLookups.clear();
  _userLookupPromise = null;
  _adhocMode = false;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith(SS_DISPLAY_PREFIX) || k === SS_ADHOC_FLAG)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

async function resolveViaGraph(id: string): Promise<string | null> {
  const t0 = performance.now();
  rbacLog("Office365UsersService.UserProfile_V2 → REQUEST", { id });
  try {
    const result = await Office365UsersService.UserProfile_V2(id, "displayName,mail");
    const user = result.data;
    const name = user?.displayName ?? user?.mail ?? null;
    rbacLog("Office365UsersService.UserProfile_V2 → RESPONSE", {
      elapsedMs: Math.round(performance.now() - t0),
      id,
      hasName: !!name,
    });
    return name;
  } catch (err) {
    rbacLog("Office365UsersService.UserProfile_V2 → ERROR", {
      elapsedMs: Math.round(performance.now() - t0),
      id,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export interface UseUserDisplayNamesOptions {
  /**
   * If true, in adhoc mode the hook will eagerly fall back to the Office 365
   * Users (Graph) connector for cache misses. List-render call sites should
   * leave this false; transcript-detail call sites should pass true so the
   * single open transcript triggers the Graph lookup.
   */
  eager?: boolean;
}

/**
 * Resolve AAD Object IDs to display names.
 * Batches lookups, caches results in memory + sessionStorage, and falls
 * back to the Graph connector for limited users (see comments above).
 */
export function useUserDisplayNames(
  aadObjectIds: string[],
  options?: UseUserDisplayNamesOptions
) {
  const eager = !!options?.eager;
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Hydrate L1 from L2 for any ids we haven't seen yet.
    let hydrated = false;
    for (const id of aadObjectIds) {
      if (id && !_userDisplayCache.has(id)) {
        const cached = loadFromSession(id);
        if (cached !== null) {
          _userDisplayCache.set(id, cached);
          hydrated = true;
        }
      }
    }
    if (hydrated) setVersion((v) => v + 1);

    const unresolved = aadObjectIds.filter(
      (id) => id && !_userDisplayCache.has(id) && !_pendingUserLookups.has(id)
    );
    if (unresolved.length === 0) return;

    // In adhoc mode, list-render call sites stop hitting the network.
    // Only the eager (transcript-open) path triggers Graph fallback.
    if (_adhocMode && !eager) return;

    unresolved.forEach((id) => _pendingUserLookups.add(id));

    const resolve = async () => {
      for (const id of unresolved) {
        let resolvedName: string | null = null;

        if (!_adhocMode) {
          try {
            const result = await AadusersService.getAll({
              select: ["aaduserid", "id", "displayname", "mail"],
              filter: `id eq '${sanitizeGuid(id)}'`,
              maxPageSize: 1,
            });
            const user = result.data?.[0];
            if (user) {
              resolvedName = user.displayname ?? user.mail ?? null;
            } else {
              _adhocMode = true;
              persistAdhocFlag();
              rbacLog("AAD lookup → 0 rows; flipping to adhoc mode (Graph fallback)", { id });
            }
          } catch (err) {
            rbacLog("AadusersService.getAll → ERROR", {
              id,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }

        if (resolvedName === null && _adhocMode && eager) {
          resolvedName = await resolveViaGraph(id);
        }

        if (resolvedName !== null) {
          _userDisplayCache.set(id, resolvedName);
          saveToSession(id, resolvedName);
        }
        // If still null (adhoc + non-eager, or Graph failed), DON'T poison
        // the cache with the raw id — getDisplayName falls back to showing
        // the GUID, and a future eager call (transcript open) can still
        // trigger the Graph fallback.
        _pendingUserLookups.delete(id);
      }
      setVersion((v) => v + 1);
    };

    if (_userLookupPromise) {
      _userLookupPromise = _userLookupPromise.then(resolve);
    } else {
      _userLookupPromise = resolve();
    }
  }, [aadObjectIds.join(","), eager]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDisplayName = useCallback((aadObjectId: string | undefined): string => {
    if (!aadObjectId) return "Anonymous";
    const cached = _userDisplayCache.get(aadObjectId);
    if (cached) return cached;
    const fromSession = loadFromSession(aadObjectId);
    if (fromSession !== null) {
      _userDisplayCache.set(aadObjectId, fromSession);
      return fromSession;
    }
    return _adhocMode ? aadObjectId : "Loading...";
  }, []);

  return { getDisplayName };
}

// ── Bot Display Name Lookup ──────────────────────────────────────────

export interface BotInfo {
  botid: string;
  displayName: string;
  schemaName: string;
}

// In-memory cache so we only fetch bots once
// NOTE: this cache is module-scoped & persists for the page lifetime —
// see rbacLog "Bots cache state" entries to spot leaks across persona switches.
let _botsCache: Map<string, BotInfo> | null = null;
let _botsCacheBySchema: Map<string, BotInfo> | null = null;
let _botsFetchPromise: Promise<void> | null = null;

async function fetchBots() {
  if (_botsCache) return;
  if (_botsFetchPromise) {
    await _botsFetchPromise;
    return;
  }

  _botsFetchPromise = (async () => {
    const t0 = performance.now();
    rbacLog("BotsService.getAll → REQUEST", {
      source: "Dataverse direct (BotsService → @microsoft/power-apps/data getClient)",
      table: "bots",
      select: ["botid", "name", "schemaname"],
      maxPageSize: 500,
      note: "expected to run under MSAL caller identity & respect Dataverse RBAC",
    });
    try {
      const result = await BotsService.getAll({
        select: ["botid", "name", "schemaname"],
        maxPageSize: 500,
      });

      _botsCache = new Map();
      _botsCacheBySchema = new Map();

      for (const bot of result.data ?? []) {
        const info: BotInfo = {
          botid: bot.botid,
          displayName: bot.name ?? bot.schemaname ?? "",
          schemaName: bot.schemaname ?? "",
        };
        _botsCache.set(bot.botid, info);
        if (bot.schemaname) {
          _botsCacheBySchema.set(bot.schemaname.toLowerCase(), info);
        }
      }

      const sample = (result.data ?? []).slice(0, 5).map(b => ({
        botid: b.botid,
        name: b.name,
        schemaname: b.schemaname,
      }));
      rbacLog("BotsService.getAll → RESPONSE", {
        elapsedMs: Math.round(performance.now() - t0),
        rowCount: (result.data ?? []).length,
        cachedSize: _botsCache.size,
        sampleFirst5: sample,
        rawKeys: Object.keys((result as unknown as Record<string, unknown>) ?? {}),
      });
      console.log(`[Bots] Cached ${_botsCache.size} bots`);
    } catch (err) {
      rbacLog("BotsService.getAll → ERROR", {
        elapsedMs: Math.round(performance.now() - t0),
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      console.error("[Bots] Failed to fetch:", err instanceof Error ? err.message : "Unknown error");
      _botsCache = new Map();
      _botsCacheBySchema = new Map();
    }
  })();

  await _botsFetchPromise;
}

/**
 * Hook to get bot display names and the list of accessible bots.
 * Fetches all bots once and caches them. Re-fetches when data mode changes.
 */
export function useBotLookup() {
  const [ready, setReady] = useState(!!_botsCache);
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (_botsCache && _botsCache.size > 0) {
      setReady(true);
      return;
    }

    fetchBots().then(() => {
      setReady(true);
      setVersion((v) => v + 1);
    });
  }, []);

  const getDisplayName = useCallback((schemaName: string, botId?: string): string => {
    if (!_botsCache || !_botsCacheBySchema) return schemaName;

    if (botId) {
      const byId = _botsCache.get(botId);
      if (byId) return byId.displayName || schemaName;
    }

    const bySchema = _botsCacheBySchema.get(schemaName.toLowerCase());
    if (bySchema) return bySchema.displayName || schemaName;

    return schemaName;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  /** All bots the user has access to */
  const accessibleBots: BotInfo[] = _botsCache ? Array.from(_botsCache.values()) : [];

  /** All accessible bot IDs */
  const accessibleBotIds: string[] = accessibleBots.map((b) => b.botid);

  return { getDisplayName, ready, accessibleBots, accessibleBotIds };
}

/**
 * Build an OData filter clause that scopes transcripts to the given bot IDs.
 * Uses the _bot_conversationtranscriptid_value lookup field.
 */
export function buildBotScopeFilter(botIds: string[]): string | undefined {
  if (botIds.length === 0) return undefined;
  const clauses = botIds.map((id) => `_bot_conversationtranscriptid_value eq '${sanitizeGuid(id)}'`);
  return `(${clauses.join(" or ")})`;
}

function escapeOData(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s\-._@:]/g, "")
    .replace(/'/g, "''");
}

/** Sanitize a GUID — strip anything that isn't hex or hyphens */
function sanitizeGuid(value: string): string {
  return value.replace(/[^a-fA-F0-9-]/g, "");
}
