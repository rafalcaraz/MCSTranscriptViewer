// Tiny memoized wrapper around parseTranscript. Both single-env and multi-env
// hooks accumulate raw records as the user pages / auto-loads — without this,
// growing the array by 50 means re-parsing all N rows on every append, which
// dominates client-side CPU for big sessions.

import { useRef, useCallback } from "react";
import { parseTranscript, type DataverseTranscriptRecord } from "../utils/parseTranscript";
import type { ParsedTranscript } from "../types/transcript";

export function useParsedTranscriptCache() {
  const cacheRef = useRef<Map<string, ParsedTranscript>>(new Map());

  const parseAll = useCallback((records: DataverseTranscriptRecord[]): ParsedTranscript[] => {
    const cache = cacheRef.current;
    const out: ParsedTranscript[] = new Array(records.length);
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const cached = cache.get(r.conversationtranscriptid);
      if (cached) {
        out[i] = cached;
      } else {
        const parsed = parseTranscript(r);
        cache.set(r.conversationtranscriptid, parsed);
        out[i] = parsed;
      }
    }
    return out;
  }, []);

  const reset = useCallback(() => {
    cacheRef.current = new Map();
  }, []);

  return { parseAll, reset };
}
