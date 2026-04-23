// Env-scoped lookup + transcripts hooks for the Browse Environments tab.
//
// These mirror the shapes of the default-env hooks (useBotLookup,
// useUserDisplayNames, useAadUserSearch, useTranscripts) but talk directly to
// the Dataverse Web API of an arbitrary environment using a user-supplied
// OAuth token. They use React state for caching (no module-level singletons)
// so two envs can be open without colliding.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DataverseTranscriptRecord } from "../../utils/parseTranscript";
import type { TranscriptFilters, RawTranscriptPage } from "../../hooks/useTranscripts";
import type {
  BotLookupResult,
  LookupsImpl,
  UserDisplayResult,
  UserSearchResult,
} from "../../context/LookupsContext";
import type { AadUser, BotInfo } from "../../hooks/useLookups";
import {
  fetchAadUser,
  fetchAgents,
  fetchTranscriptsPage,
  searchAadUsers,
  WebApiError,
} from "./multiEnvDataSource";

export type EnvAuth = {
  envApiUrl: string;
  getToken: (envApiUrl: string) => Promise<string>;
};

function errMessage(e: unknown): string {
  if (e instanceof WebApiError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

// ── Bots ─────────────────────────────────────────────────────────────

export function useEnvBotLookup({ envApiUrl, getToken }: EnvAuth): BotLookupResult {
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [ready, setReady] = useState(false);
  const bySchemaRef = useRef<Map<string, BotInfo>>(new Map());
  const byIdRef = useRef<Map<string, BotInfo>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setBots([]);
    bySchemaRef.current = new Map();
    byIdRef.current = new Map();
    if (!envApiUrl) return;
    (async () => {
      try {
        const token = await getToken(envApiUrl);
        const rows = await fetchAgents(envApiUrl, token);
        if (cancelled) return;
        const list: BotInfo[] = rows.map((r) => ({
          botid: r.botid,
          displayName: r.name ?? r.schemaname ?? "",
          schemaName: r.schemaname ?? "",
        }));
        const bySchema = new Map<string, BotInfo>();
        const byId = new Map<string, BotInfo>();
        for (const b of list) {
          byId.set(b.botid, b);
          if (b.schemaName) bySchema.set(b.schemaName.toLowerCase(), b);
        }
        bySchemaRef.current = bySchema;
        byIdRef.current = byId;
        setBots(list);
        setReady(true);
      } catch (e) {
        console.error("[EnvBotLookup] failed:", errMessage(e));
        if (!cancelled) setReady(true); // fail-open: show schema names as-is
      }
    })();
    return () => { cancelled = true; };
  }, [envApiUrl, getToken]);

  const getDisplayName = useCallback((schemaName: string, botId?: string): string => {
    if (botId) {
      const byId = byIdRef.current.get(botId);
      if (byId) return byId.displayName || schemaName;
    }
    const bySchema = bySchemaRef.current.get(schemaName.toLowerCase());
    if (bySchema) return bySchema.displayName || schemaName;
    return schemaName;
  }, []);

  return {
    getDisplayName,
    ready,
    accessibleBots: bots,
    accessibleBotIds: bots.map((b) => b.botid),
  };
}

// ── User display names ───────────────────────────────────────────────

export function useEnvUserDisplayNames({ envApiUrl, getToken }: EnvAuth, aadObjectIds: string[]): UserDisplayResult {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const pendingRef = useRef<Set<string>>(new Set());
  const [, setVersion] = useState(0);

  const idsKey = useMemo(() => aadObjectIds.filter(Boolean).sort().join(","), [aadObjectIds]);

  useEffect(() => {
    if (!envApiUrl) return;
    const ids = idsKey ? idsKey.split(",") : [];
    const unresolved = ids.filter((id) => id && !cacheRef.current.has(id) && !pendingRef.current.has(id));
    if (unresolved.length === 0) return;
    unresolved.forEach((id) => pendingRef.current.add(id));

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken(envApiUrl);
        for (const id of unresolved) {
          try {
            const u = await fetchAadUser(envApiUrl, token, id);
            cacheRef.current.set(id, u?.displayname ?? u?.mail ?? id);
          } catch {
            cacheRef.current.set(id, id);
          } finally {
            pendingRef.current.delete(id);
          }
        }
        if (!cancelled) setVersion((v) => v + 1);
      } catch (e) {
        console.error("[EnvUserDisplayNames] failed:", errMessage(e));
        unresolved.forEach((id) => pendingRef.current.delete(id));
      }
    })();
    return () => { cancelled = true; };
  }, [envApiUrl, getToken, idsKey]);

  const getDisplayName = useCallback((id: string | undefined): string => {
    if (!id) return "Anonymous";
    return cacheRef.current.get(id) ?? "Loading...";
  }, []);

  return { getDisplayName };
}

// ── User search ──────────────────────────────────────────────────────

export function useEnvAadUserSearch({ envApiUrl, getToken }: EnvAuth): UserSearchResult {
  const [results, setResults] = useState<AadUser[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !envApiUrl) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken(envApiUrl);
      const rows = await searchAadUsers(envApiUrl, token, query);
      setResults(rows.map((u) => ({
        aaduserid: u.aaduserid,
        objectId: u.objectId,
        displayname: u.displayname ?? "",
        mail: u.mail ?? "",
        userprincipalname: u.userprincipalname ?? "",
        givenname: u.givenname ?? "",
        surname: u.surname ?? "",
        jobtitle: u.jobtitle ?? "",
      })));
    } catch (e) {
      console.error("[EnvAadUserSearch] failed:", errMessage(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [envApiUrl, getToken]);

  return { results, loading, search };
}

// ── Transcripts ──────────────────────────────────────────────────────

export function useEnvTranscripts(auth: EnvAuth, filters: TranscriptFilters): RawTranscriptPage {
  const { envApiUrl, getToken } = auth;
  const [records, setRecords] = useState<DataverseTranscriptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const nextLinkRef = useRef<string | null>(null);

  const pageSize = filters.pageSize || 25;
  // Stable key for the filter parameters that affect the FIRST page request.
  // We re-fetch from scratch whenever this changes.
  const filterKey = useMemo(() => JSON.stringify({
    df: filters.dateFrom ?? "",
    dt: filters.dateTo ?? "",
    cs: filters.contentSearch ?? "",
    pa: filters.participantAadId ?? "",
    ps: pageSize,
    env: envApiUrl,
  }), [filters.dateFrom, filters.dateTo, filters.contentSearch, filters.participantAadId, pageSize, envApiUrl]);

  const fetchFirst = useCallback(async () => {
    if (!envApiUrl) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken(envApiUrl);
      const page = await fetchTranscriptsPage(envApiUrl, token, {
        pageSize,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        contentSearch: filters.contentSearch || undefined,
        participantAadId: filters.participantAadId || undefined,
      });
      const recs: DataverseTranscriptRecord[] = page.rows.map((r) => ({
        conversationtranscriptid: r.conversationtranscriptid,
        name: r.name ?? undefined,
        createdon: r.createdon ?? undefined,
        conversationstarttime: r.conversationstarttime ?? "",
        content: r.content,
        metadata: r.metadata,
        schematype: r.schematype,
        schemaversion: r.schemaversion,
      }));
      setRecords(recs);
      nextLinkRef.current = page.nextLink;
      setHasMore(!!page.nextLink || recs.length >= pageSize);
    } catch (e) {
      setError(errMessage(e));
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [envApiUrl, getToken, pageSize, filters.dateFrom, filters.dateTo, filters.contentSearch, filters.participantAadId]);

  useEffect(() => {
    setRecords([]);
    nextLinkRef.current = null;
    setHasMore(true);
    void fetchFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore || !nextLinkRef.current || !envApiUrl) return;
    const link = nextLinkRef.current;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getToken(envApiUrl);
        const page = await fetchTranscriptsPage(envApiUrl, token, { nextLink: link, pageSize });
        const recs: DataverseTranscriptRecord[] = page.rows.map((r) => ({
          conversationtranscriptid: r.conversationtranscriptid,
          name: r.name ?? undefined,
          createdon: r.createdon ?? undefined,
          conversationstarttime: r.conversationstarttime ?? "",
          content: r.content,
          metadata: r.metadata,
          schematype: r.schematype,
          schemaversion: r.schemaversion,
        }));
        setRecords((prev) => [...prev, ...recs]);
        nextLinkRef.current = page.nextLink;
        setHasMore(!!page.nextLink);
      } catch (e) {
        setError(errMessage(e));
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [loading, hasMore, envApiUrl, getToken, pageSize]);

  const refresh = useCallback(() => { void fetchFirst(); }, [fetchFirst]);

  return {
    records,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}

// ── LookupsImpl factory ──────────────────────────────────────────────

/** Build a LookupsImpl for the given env so the shared TranscriptList /
 *  TranscriptDetail components can resolve display names against that env's
 *  Dataverse instead of the default one. */
export function createEnvLookupsImpl(auth: EnvAuth): LookupsImpl {
  return {
    useBotLookup: () => useEnvBotLookup(auth),
    useUserDisplayNames: (ids) => useEnvUserDisplayNames(auth, ids),
    useAadUserSearch: () => useEnvAadUserSearch(auth),
  };
}
