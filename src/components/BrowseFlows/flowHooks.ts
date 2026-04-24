// Flow-backed lookup + transcript hooks for the Browse via Flows workspace.
//
// Mirrors the shapes of envHooks.ts (which is MSAL-backed) so the shared
// TranscriptList / TranscriptDetail components work without modification.
// Each hook accepts `envUrl` directly instead of an EnvAuth object because
// there is no token to manage — authentication is handled by the Power
// Automate flow's Dataverse connection.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TranscriptFilters, RawTranscriptPage } from "../../hooks/useTranscripts";
import type {
  BotLookupResult,
  LookupsImpl,
  UserDisplayResult,
  UserSearchResult,
} from "../../context/LookupsContext";
import type { BotInfo } from "../../hooks/useLookups";
import {
  fetchAgentsViaFlow,
  fetchTranscriptsPageViaFlow,
  FlowError,
} from "./flowDataSource";
import {
  useUserDisplayNames as useDefaultEnvUserDisplayNames,
  useAadUserSearch as useDefaultEnvAadUserSearch,
} from "../../hooks/useLookups";
import type { DataverseTranscriptRecord } from "../../utils/parseTranscript";

function errMessage(e: unknown): string {
  if (e instanceof FlowError) return e.message;
  if (e instanceof Error) return e.message;
  return String(e);
}

// ── Bots ─────────────────────────────────────────────────────────────

export function useFlowBotLookup(envUrl: string): BotLookupResult {
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
    if (!envUrl) return;
    (async () => {
      try {
        const rows = await fetchAgentsViaFlow(envUrl);
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
        console.error("[FlowBotLookup] failed:", errMessage(e));
        if (!cancelled) setReady(true); // fail-open: show schema names as-is
      }
    })();
    return () => { cancelled = true; };
  }, [envUrl]);

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

// The `aadusers` Dataverse table is tenant-wide — its rows are the same
// regardless of which environment a transcript came from. So we delegate
// to the default-env hook, which already queries that table via the
// generated AadusersService. No flow needed.
export function useFlowUserDisplayNames(
  _envUrl: string,
  aadObjectIds: string[],
): UserDisplayResult {
  return useDefaultEnvUserDisplayNames(aadObjectIds);
}

// ── User search ──────────────────────────────────────────────────────

// Same reasoning as useFlowUserDisplayNames: aadusers is tenant-scoped,
// so the typeahead works against the default-env Dataverse connection.
export function useFlowAadUserSearch(_envUrl: string): UserSearchResult {
  return useDefaultEnvAadUserSearch();
}

// ── Transcripts ──────────────────────────────────────────────────────

export function useFlowTranscripts(
  envUrl: string,
  filters: TranscriptFilters,
): RawTranscriptPage {
  const [records, setRecords] = useState<DataverseTranscriptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // FetchXML page-based paging state.
  const pageNumberRef = useRef<number>(1);
  const pagingCookieRef = useRef<string>("");

  const pageSize = filters.pageSize || 25;

  // Stable key for the filter params that govern the FIRST page.
  // Re-fetch from scratch whenever this changes.
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        df: filters.dateFrom ?? "",
        dt: filters.dateTo ?? "",
        cs: filters.contentSearch ?? "",
        pa: filters.participantAadId ?? "",
        ps: pageSize,
        env: envUrl,
      }),
    [
      filters.dateFrom,
      filters.dateTo,
      filters.contentSearch,
      filters.participantAadId,
      pageSize,
      envUrl,
    ],
  );

  const fetchFirst = useCallback(async () => {
    if (!envUrl) return;
    setLoading(true);
    setError(null);
    pageNumberRef.current = 1;
    pagingCookieRef.current = "";
    try {
      const page = await fetchTranscriptsPageViaFlow(envUrl, {
        pageSize,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        contentSearch: filters.contentSearch || undefined,
        participantAadId: filters.participantAadId || undefined,
        pageNumber: 1,
      });
      setRecords(page.rows);
      pagingCookieRef.current = page.pagingCookie;
      pageNumberRef.current = 1;
      setHasMore(page.hasMore);
    } catch (e) {
      setError(errMessage(e));
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [
    envUrl,
    pageSize,
    filters.dateFrom,
    filters.dateTo,
    filters.contentSearch,
    filters.participantAadId,
  ]);

  useEffect(() => {
    setRecords([]);
    pageNumberRef.current = 1;
    pagingCookieRef.current = "";
    setHasMore(true);
    void fetchFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore || !envUrl) return;
    const nextPage = pageNumberRef.current + 1;
    const cookie = pagingCookieRef.current;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const page = await fetchTranscriptsPageViaFlow(envUrl, {
          pageSize,
          dateFrom: filters.dateFrom || undefined,
          dateTo: filters.dateTo || undefined,
          contentSearch: filters.contentSearch || undefined,
          participantAadId: filters.participantAadId || undefined,
          pageNumber: nextPage,
          pagingCookie: cookie || undefined,
        });
        setRecords((prev) => [...prev, ...page.rows]);
        pagingCookieRef.current = page.pagingCookie;
        pageNumberRef.current = nextPage;
        setHasMore(page.hasMore);
      } catch (e) {
        setError(errMessage(e));
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [
    loading,
    hasMore,
    envUrl,
    pageSize,
    filters.dateFrom,
    filters.dateTo,
    filters.contentSearch,
    filters.participantAadId,
  ]);

  const refresh = useCallback(() => {
    void fetchFirst();
  }, [fetchFirst]);

  return { records, hasMore, loading, error, loadMore, refresh };
}

// ── LookupsImpl factory ──────────────────────────────────────────────

/** Build a LookupsImpl backed by Power Automate flows for the given env.
 *  Wrap in <LookupsProvider value={impl}> so shared TranscriptList /
 *  TranscriptDetail components can resolve display names without prop-drilling. */
export function createFlowLookupsImpl(envUrl: string): LookupsImpl {
  return {
    useBotLookup: () => useFlowBotLookup(envUrl),
    useUserDisplayNames: (ids) => useFlowUserDisplayNames(envUrl, ids),
    useAadUserSearch: () => useFlowAadUserSearch(envUrl),
  };
}
