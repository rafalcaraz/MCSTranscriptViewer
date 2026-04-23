import { useState, useEffect, useCallback } from "react";
import { type DataverseTranscriptRecord } from "../utils/parseTranscript";
import { ConversationtranscriptsService } from "../generated/services/ConversationtranscriptsService";
import type { Conversationtranscripts } from "../generated/models/ConversationtranscriptsModel";
import { captureOrgUrlFromRecord } from "../utils/dataverseEnvUrl";

export interface TranscriptFilters {
  dateFrom?: string;
  dateTo?: string;
  contentSearch?: string;
  participantAadId?: string;
  pageSize: number;
}

import type { ParsedTranscript } from "../types/transcript";
import { parseTranscript } from "../utils/parseTranscript";

/** Raw transcript page returned from the data layer — NOT parsed yet.
 *  Consumers run records through useFilteredTranscripts to get parsed
 *  transcripts (and to apply the access filter). Avoids the cost of
 *  parsing rows that will be filtered out. */
export interface RawTranscriptPage {
  records: DataverseTranscriptRecord[];
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  refresh: () => void;
}

// Larger default page = fewer round-trips when client-side bot-access filter
// drops a lot of rows. 50 is a sweet spot — Dataverse keeps response times
// reasonable up to ~100, and parseTranscript is cached per-id so re-parsing
// on append is free.
const DEFAULT_PAGE_SIZE = 50;

function toRecord(dv: Conversationtranscripts): DataverseTranscriptRecord {
  return {
    conversationtranscriptid: dv.conversationtranscriptid,
    name: dv.name,
    createdon: dv.createdon,
    conversationstarttime: dv.conversationstarttime,
    content: dv.content,
    metadata: dv.metadata,
    schematype: dv.schematype,
    schemaversion: dv.schemaversion,
  };
}

function buildODataFilter(filters: TranscriptFilters): string | undefined {
  const clauses: string[] = [];

  if (filters.dateFrom) {
    clauses.push(`conversationstarttime ge ${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    clauses.push(`conversationstarttime le ${filters.dateTo}`);
  }
  if (filters.contentSearch?.trim()) {
    clauses.push(`contains(content,'${escapeOData(filters.contentSearch.trim())}')`);
  }
  if (filters.participantAadId?.trim()) {
    // Coarse server-side pre-filter: any transcript whose JSON content mentions
    // this AAD object ID. The list view applies a strict client-side
    // `isParticipant` check on top to drop non-participant matches.
    clauses.push(`contains(content,'${escapeOData(filters.participantAadId.trim())}')`);
  }

  return clauses.length > 0 ? clauses.join(" and ") : undefined;
}

/** Sanitize user input for use in OData filter strings.
 *  Allows: letters, numbers, spaces, hyphens, dots, @, underscores, colons.
 *  Strips everything else to prevent OData injection. */
function escapeOData(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s\-._@:]/g, "") // Strip unsafe characters
    .replace(/'/g, "''");                   // Escape remaining single quotes
}

export function useTranscripts(filters: TranscriptFilters): RawTranscriptPage {
  const [records, setRecords] = useState<DataverseTranscriptRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();

  const pageSize = filters.pageSize || DEFAULT_PAGE_SIZE;

  const fetchPage = useCallback(async (append: boolean, skipToken?: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await ConversationtranscriptsService.getAll({
        select: [
          "conversationtranscriptid",
          "name",
          "createdon",
          "conversationstarttime",
          "content",
          "metadata",
          "schematype",
          "schemaversion",
        ],
        filter: buildODataFilter(filters),
        orderBy: ["conversationstarttime desc"],
        maxPageSize: pageSize,
        ...(skipToken ? { skipToken } : {}),
      });

      const data = result.data ?? [];
      const newRecords = data.map(toRecord);

      if (append) {
        setRecords((prev) => [...prev, ...newRecords]);
      } else {
        setRecords(newRecords);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultAny = result as any;
      const nextToken =
        resultAny?.skipToken ??
        resultAny?.nextLink ??
        resultAny?.["@odata.nextLink"] ??
        undefined;

      setNextPageToken(nextToken);
      setHasMore(newRecords.length >= pageSize || !!nextToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load transcripts";
      console.error("[Transcripts] Fetch error:", err instanceof Error ? err.message : "Unknown error");
      setError(msg);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [filters, pageSize]);

  useEffect(() => {
    setRecords([]);
    setNextPageToken(undefined);
    setHasMore(true);
    fetchPage(false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPage(true, nextPageToken);
    }
  }, [loading, hasMore, nextPageToken, fetchPage]);

  const refresh = useCallback(() => {
    setRecords([]);
    setNextPageToken(undefined);
    setHasMore(true);
    fetchPage(false);
  }, [fetchPage]);

  return {
    records,
    hasMore,
    loading,
    error,
    loadMore,
    refresh,
  };
}

export function useTranscript(id: string | undefined) {
  const [transcript, setTranscript] = useState<ParsedTranscript | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setTranscript(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        console.error("[Transcript] Fetch timed out after 20s — Power Apps SDK may not be initialized (are you opening a localhost URL outside the Power Apps wrapper?)");
        setLoading(false);
        cancelled = true;
      }
    }, 20000);

    (async () => {
      try {
        const result = await ConversationtranscriptsService.get(id, {
          select: [
            "conversationtranscriptid",
            "name",
            "createdon",
            "conversationstarttime",
            "content",
            "metadata",
            "schematype",
            "schemaversion",
          ],
        });

        if (!cancelled && result.data) {
          captureOrgUrlFromRecord(result.data);
          setTranscript(parseTranscript(toRecord(result.data)));
        }
      } catch (err) {
        console.error("[Transcript] Fetch error:", err instanceof Error ? err.message : "Unknown error");
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; window.clearTimeout(timeoutId); };
  }, [id]);

  return { transcript, loading };
}

/** Client-side structured search on already-loaded parsed transcripts */
export interface ContentSearchOptions {
  query: string;
  searchIn: "all" | "messages" | "thinking" | "toolNames" | "userId";
}

export function searchTranscripts(
  transcripts: ParsedTranscript[],
  options: ContentSearchOptions
): ParsedTranscript[] {
  const q = options.query.toLowerCase().trim();
  if (!q) return transcripts;

  return transcripts.filter((t) => {
    switch (options.searchIn) {
      case "messages":
        return t.messages.some((m) => m.text.toLowerCase().includes(q));
      case "thinking":
        return t.planSteps.some((s) => s.thought?.toLowerCase().includes(q));
      case "toolNames":
        return t.planSteps.some((s) => s.taskDialogId.toLowerCase().includes(q)) ||
               t.availableTools.some((tool) => tool.displayName.toLowerCase().includes(q));
      case "userId":
        return t.userAadObjectId?.toLowerCase().includes(q) ||
               t.messages.some((m) => m.from.aadObjectId?.toLowerCase().includes(q) || m.from.id.toLowerCase().includes(q));
      case "all":
      default:
        return (
          t.messages.some((m) => m.text.toLowerCase().includes(q)) ||
          t.planSteps.some((s) =>
            s.thought?.toLowerCase().includes(q) ||
            s.observation?.toLowerCase().includes(q) ||
            s.taskDialogId.toLowerCase().includes(q)
          ) ||
          t.userAadObjectId?.toLowerCase().includes(q) ||
          t.metadata.botName.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q)
        );
    }
  });
}
