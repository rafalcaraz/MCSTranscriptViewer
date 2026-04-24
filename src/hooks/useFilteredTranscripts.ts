// Wraps a raw transcript-page hook and restricts the result set to transcripts
// whose `metadata.botName` (schema name) is in the user's accessible-bots list.
//
// Why client-side? The `_bot_conversationtranscriptid_value` lookup on the
// conversationtranscript table doesn't match `botid` from /bots (KNOWLEDGE.md),
// and `metadata` is a JSON string column we can't index — so we can't push
// this filter to the server reliably.
//
// Performance: we cheaply extract bot name from each raw record's small
// `metadata` JSON field (NOT the heavy `content` field) BEFORE deep-parsing.
// Only records that pass the access filter incur the full parseTranscript
// cost. Combined with auto-load-more, the user sees ~targetPageSize visible
// rows quickly without ever waiting on parsing throwaway data.

import { useEffect, useMemo, useRef, useState } from "react";
import type { ParsedTranscript } from "../types/transcript";
import type { DataverseTranscriptRecord } from "../utils/parseTranscript";
import { extractBotName } from "../utils/parseTranscript";
import { useParsedTranscriptCache } from "./useParsedTranscriptCache";

export interface RawTranscriptPageInput {
  records: DataverseTranscriptRecord[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
}

export interface FilteredTranscriptPage {
  /** Parsed transcripts that passed the access filter, in source order. */
  transcripts: ParsedTranscript[];
  totalLoaded: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
  /** True while we're auto-fetching additional pages because the current
   *  filtered set is smaller than the target page size. */
  autoLoading: boolean;
  /** Raw rows the server returned that were hidden because the user
   *  doesn't have access to the source bot. */
  hiddenCount: number;
}

/** Maximum number of consecutive auto-loadMore calls per filter change. Caps
 *  the bandwidth cost in pathological "user has access to almost nothing"
 *  scenarios. 10 pages × 50 = 500 raw rows scanned. */
const MAX_AUTO_LOADS = 10;

export function useFilteredTranscripts(
  raw: RawTranscriptPageInput,
  accessibleSchemaNames: Set<string>,
  lookupReady: boolean,
  targetPageSize = 50,
): FilteredTranscriptPage {
  // Normalize once. Set lookups are O(1) so per-row check is cheap.
  // Schema names should be case-stable but Dataverse occasionally round-trips
  // them with different casing — lowercasing avoids spurious mismatches.
  const accessibleLower = useMemo(() => {
    const s = new Set<string>();
    accessibleSchemaNames.forEach((n) => s.add(n.toLowerCase()));
    return s;
  }, [accessibleSchemaNames]);

  // Cheap pre-filter: parse only the small `metadata` field per record.
  // We never touch `content` (the heavy field) here.
  const visibleRecords = useMemo(() => {
    if (!lookupReady) return raw.records;
    if (accessibleLower.size === 0) return [] as DataverseTranscriptRecord[];
    return raw.records.filter((r) => accessibleLower.has(extractBotName(r).toLowerCase()));
  }, [raw.records, accessibleLower, lookupReady]);

  // Deep parse — cached per id so re-runs (e.g. on append) are O(new rows).
  const { parseAll, reset: resetParseCache } = useParsedTranscriptCache();
  const transcripts = useMemo(() => parseAll(visibleRecords), [visibleRecords, parseAll]);

  // When the access filter changes we want to drop stale parsed entries.
  // (Records keyed by id, so a different filter set might surface previously
  // hidden rows we never parsed — the cache will lazy-fill them.)
  const filterKey = useMemo(
    () => `${lookupReady ? "1" : "0"}|${[...accessibleLower].sort().join(",")}`,
    [accessibleLower, lookupReady],
  );
  const lastFilterKeyRef = useRef<string>("");
  useEffect(() => {
    if (filterKey !== lastFilterKeyRef.current) {
      lastFilterKeyRef.current = filterKey;
      resetParseCache();
    }
  }, [filterKey, resetParseCache]);

  // Auto-load-more: keep fetching until visible.length >= targetPageSize OR
  // hasMore is false OR we've hit the safety cap.
  const autoLoadCountRef = useRef(0);
  const [autoLoading, setAutoLoading] = useState(false);
  useEffect(() => {
    if (filterKey !== lastFilterKeyRef.current) {
      autoLoadCountRef.current = 0;
    }
  }, [filterKey]);

  useEffect(() => {
    if (!lookupReady) return;
    if (raw.loading) return;
    if (!raw.hasMore) {
      setAutoLoading(false);
      return;
    }
    if (visibleRecords.length >= targetPageSize) {
      setAutoLoading(false);
      autoLoadCountRef.current = 0;
      return;
    }
    if (autoLoadCountRef.current >= MAX_AUTO_LOADS) {
      setAutoLoading(false);
      return;
    }
    autoLoadCountRef.current += 1;
    setAutoLoading(true);
    raw.loadMore();
  }, [raw, visibleRecords.length, lookupReady, targetPageSize]);

  return {
    transcripts,
    totalLoaded: transcripts.length,
    hasMore: raw.hasMore,
    loading: raw.loading,
    error: raw.error,
    loadMore: raw.loadMore,
    refresh: () => { resetParseCache(); raw.refresh(); },
    autoLoading,
    hiddenCount: raw.records.length - visibleRecords.length,
  };
}
