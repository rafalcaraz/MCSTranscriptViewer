import { useState, useEffect, useCallback } from "react";
import { AadusersService } from "../generated/services/AadusersService";
import { BotsService } from "../generated/services/BotsService";
import type { Aadusers } from "../generated/models/AadusersModel";

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

/**
 * Search AAD users by name or email.
 * Returns matching users for typeahead suggestions.
 */
export function useAadUserSearch() {
  const [results, setResults] = useState<AadUser[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
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

      const users = (result.data ?? []).map(toAadUser);
      setResults(users);
    } catch (err) {
      console.error("[AadUserSearch] Error:", err instanceof Error ? err.message : "Unknown error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, search };
}

// ── AAD User Display Name Cache ──────────────────────────────────────

// Cache of AAD Object ID → display name (persists across components)
const _userDisplayCache = new Map<string, string>();
let _pendingUserLookups = new Set<string>();
let _userLookupPromise: Promise<void> | null = null;

/**
 * Resolve AAD Object IDs to display names.
 * Batches lookups and caches results.
 */
export function useUserDisplayNames(aadObjectIds: string[]) {
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Find IDs we haven't resolved yet
    const unresolved = aadObjectIds.filter(
      (id) => id && !_userDisplayCache.has(id) && !_pendingUserLookups.has(id)
    );

    if (unresolved.length === 0) return;

    // Mark as pending
    unresolved.forEach((id) => _pendingUserLookups.add(id));

    // Batch resolve
    const resolve = async () => {
      for (const id of unresolved) {
        try {
          const result = await AadusersService.getAll({
            select: ["aaduserid", "id", "displayname", "mail"],
            filter: `id eq '${sanitizeGuid(id)}'`,
            maxPageSize: 1,
          });
          const user = result.data?.[0];
          _userDisplayCache.set(id, user?.displayname ?? user?.mail ?? id);
        } catch {
          _userDisplayCache.set(id, id); // Fallback to raw ID
        }
        _pendingUserLookups.delete(id);
      }
      setVersion((v) => v + 1);
    };

    // Chain after any existing lookup
    if (_userLookupPromise) {
      _userLookupPromise = _userLookupPromise.then(resolve);
    } else {
      _userLookupPromise = resolve();
    }
  }, [aadObjectIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDisplayName = useCallback((aadObjectId: string | undefined): string => {
    if (!aadObjectId) return "Anonymous";
    return _userDisplayCache.get(aadObjectId) ?? "Loading...";
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

      console.log(`[Bots] Cached ${_botsCache.size} bots`);
    } catch (err) {
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
  return value.replace(/[^a-fA-F0-9\-]/g, "");
}
