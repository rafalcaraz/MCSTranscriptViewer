import { useMemo, useEffect, useRef, useCallback } from "react";
import type { ParsedTranscript, TranscriptType } from "../../types/transcript";
import { formatDuration, isParticipant } from "../../utils/parseTranscript";
import { searchTranscripts, type ContentSearchOptions } from "../../hooks/useTranscripts";
import { useBotLookup, useUserDisplayNames, type BotInfo } from "../../hooks/useLookups";
import { UserSearch } from "./UserSearch";
import { AgentMultiSelect } from "./AgentMultiSelect";
import { ActiveFilters, type RemovableFilterKey } from "./ActiveFilters";
import type { AadUser } from "../../hooks/useLookups";
import { INITIAL_FILTER_STATE, type ListFilterState } from "../../state/listFilters";

const outcomeBadgeClass: Record<string, string> = {
  Resolved: "badge-success",
  Abandoned: "badge-warning",
  Escalated: "badge-danger",
};

const TRANSCRIPT_TYPE_LABELS: Record<TranscriptType, { icon: string; label: string }> = {
  chat: { icon: "💬", label: "Chat" },
  autonomous: { icon: "⚡", label: "Autonomous" },
  evaluation: { icon: "🧪", label: "Eval" },
  design: { icon: "🛠️", label: "Design" },
};

interface TranscriptListProps {
  transcripts: ParsedTranscript[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalLoaded: number;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
  onFiltersChange: (filters: { dateFrom?: string; dateTo?: string; contentSearch?: string; participantAadId?: string }) => void;
  filterState: ListFilterState;
  onFilterStateChange: (state: ListFilterState) => void;
  accessibleBots: BotInfo[];
}

export function TranscriptList({
  transcripts,
  loading,
  error,
  hasMore,
  totalLoaded,
  onSelect,
  onLoadMore,
  onFiltersChange,
  filterState: f,
  onFilterStateChange: setF,
  accessibleBots,
}: TranscriptListProps) {
  const { getDisplayName } = useBotLookup();

  const update = (patch: Partial<ListFilterState>) => setF({ ...f, ...patch });

  const handleUserSelect = (user: AadUser) => {
    update({
      participantAadId: user.objectId,
      userSearchQuery: `${user.displayname} (${user.mail})`,
    });
    onFiltersChange({
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      contentSearch: f.serverSearch || undefined,
      participantAadId: user.objectId,
    });
  };

  const applyServerFilters = () => {
    update({ serverSearch: f.serverSearchInput });
    onFiltersChange({
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      contentSearch: f.serverSearchInput || undefined,
      participantAadId: f.participantAadId || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyServerFilters();
  };

  /** Removes a single filter by key. Updates local state and re-issues the
   *  server fetch when the filter is server-impacting (date / search / participant). */
  const removeFilter = (key: RemovableFilterKey) => {
    switch (key) {
      case "dateRange":
        update({ dateFrom: "", dateTo: "" });
        onFiltersChange({
          dateFrom: undefined,
          dateTo: undefined,
          contentSearch: f.serverSearch || undefined,
          participantAadId: f.participantAadId || undefined,
        });
        return;
      case "serverSearch":
        update({ serverSearch: "", serverSearchInput: "" });
        onFiltersChange({
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          contentSearch: undefined,
          participantAadId: f.participantAadId || undefined,
        });
        return;
      case "participantAadId":
        update({ participantAadId: "", userSearchQuery: "" });
        onFiltersChange({
          dateFrom: f.dateFrom || undefined,
          dateTo: f.dateTo || undefined,
          contentSearch: f.serverSearch || undefined,
          participantAadId: undefined,
        });
        return;
      case "selectedBotIds":
        update({ selectedBotIds: [] });
        return;
      case "transcriptTypeFilter":
        update({ transcriptTypeFilter: "" });
        return;
      case "outcomeFilter":
        update({ outcomeFilter: "" });
        return;
      case "feedbackFilter":
        update({ feedbackFilter: "" });
        return;
      case "minTurns":
        update({ minTurns: "" });
        return;
      case "clientSearch":
        update({ clientSearch: "" });
        return;
    }
  };

  const clearAllFilters = () => {
    setF(INITIAL_FILTER_STATE);
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      contentSearch: undefined,
      participantAadId: undefined,
    });
  };

  const hasAnyFilter =
    !!(f.dateFrom || f.dateTo || f.serverSearch || f.participantAadId ||
       f.selectedBotIds.length > 0 || f.transcriptTypeFilter || f.outcomeFilter ||
       f.feedbackFilter || (parseInt(f.minTurns, 10) > 0) || f.clientSearch.trim());

  const clientFiltered = useMemo(() => {
    let results = transcripts;

    // Hide connected-agent (child) sessions when toggle is on. We auto-learn
    // the set of "child" schemas from any loaded transcript that invoked them
    // — so as soon as a parent is in the list, its children get filtered out.
    if (f.hideConnectedAgentSessions) {
      const childSchemas = new Set<string>();
      for (const t of transcripts) {
        for (const s of t.invokedChildAgentSchemaNames) childSchemas.add(s);
      }
      if (childSchemas.size > 0) {
        results = results.filter((t) => !childSchemas.has(t.metadata.botName));
      }
    }

    // Agent filter (by schema name from metadata)
    if (f.selectedBotIds.length > 0) {
      const selected = new Set(f.selectedBotIds);
      results = results.filter((t) => selected.has(t.metadata.botName));
    }

    // Outcome filter — special-case "Handoff" to match our derived hasHandoff
    // flag, so it catches D365 LCW (outcome=HandOff), trace-only handoffs, and
    // custom *Handoff events (Genesys, Salesforce, etc.).
    if (f.outcomeFilter === "Handoff") {
      results = results.filter((t) => t.hasHandoff);
    } else if (f.outcomeFilter) {
      results = results.filter((t) => t.globalOutcome === f.outcomeFilter);
    }

    // Feedback filter
    if (f.feedbackFilter === "any") {
      results = results.filter((t) => t.hasFeedback);
    } else if (f.feedbackFilter === "likes") {
      results = results.filter((t) => t.likeCount > 0);
    } else if (f.feedbackFilter === "dislikes") {
      results = results.filter((t) => t.dislikeCount > 0);
    }

    // Transcript type filter
    if (f.transcriptTypeFilter) {
      results = results.filter((t) => t.transcriptType === f.transcriptTypeFilter);
    }

    // Minimum turns filter
    const minTurns = parseInt(f.minTurns, 10);
    if (minTurns > 0) {
      results = results.filter((t) => t.turnCount >= minTurns);
    }

    // Strict participant filter: drop transcripts where the AAD GUID was only
    // matched as a substring in content (e.g. as a reaction author from a
    // different identity) rather than the actual conversation participant.
    if (f.participantAadId) {
      const aadId = f.participantAadId;
      results = results.filter((t) => isParticipant(t, aadId));
    }

    // Client-side content search
    if (f.clientSearch.trim()) {
      results = searchTranscripts(results, { query: f.clientSearch, searchIn: f.clientSearchIn });
    }

    return results;
  }, [transcripts, f.selectedBotIds, f.outcomeFilter, f.feedbackFilter, f.transcriptTypeFilter, f.minTurns, f.clientSearch, f.clientSearchIn, f.participantAadId, f.hideConnectedAgentSessions]);

  // Pre-compute child-agent schema set for badging purposes (independent of the hide toggle).
  const childAgentSchemas = useMemo(() => {
    const s = new Set<string>();
    for (const t of transcripts) {
      for (const cs of t.invokedChildAgentSchemaNames) s.add(cs);
    }
    return s;
  }, [transcripts]);

  // Resolve user display names for visible transcripts
  const userAadIds = useMemo(
    () => [...new Set(clientFiltered.map((t) => t.userAadObjectId).filter(Boolean) as string[])],
    [clientFiltered]
  );
  const { getDisplayName: getUserDisplayName } = useUserDisplayNames(userAadIds);

  return (
    <div className="list-page">
      <div className="list-header">
        <h1>Conversation Transcripts</h1>
        <span>
          {clientFiltered.length} shown
          {clientFiltered.length !== totalLoaded && ` (of ${totalLoaded} loaded)`}
          {hasMore && " — more available"}
        </span>
      </div>

      {/* Unified filter toolbar */}
      <div className="filter-section">
        <div className="list-toolbar">
          <div className="filter-group">
            <label>From</label>
            <input
              type="date"
              value={f.dateFrom}
              onChange={(e) => update({ dateFrom: e.target.value })}
            />
          </div>
          <div className="filter-group">
            <label>To</label>
            <input
              type="date"
              value={f.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
            />
          </div>
          <div className="filter-group" style={{ flex: 1 }}>
            <label>Search conversations</label>
            <input
              placeholder="Search by message text, user, topic..."
              value={f.serverSearchInput}
              onChange={(e) => update({ serverSearchInput: e.target.value })}
              onKeyDown={handleKeyDown}
              style={{ width: "100%" }}
            />
          </div>
          <button className="apply-btn" onClick={applyServerFilters} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>
        </div>
        <div className="list-toolbar" style={{ marginTop: 8 }}>
          {accessibleBots.length > 0 && (
            <AgentMultiSelect
              agents={accessibleBots}
              selectedSchemaNames={f.selectedBotIds}
              onChange={(schemaNames) => update({ selectedBotIds: schemaNames })}
            />
          )}
          <select
            value={f.transcriptTypeFilter}
            onChange={(e) => update({ transcriptTypeFilter: e.target.value as ListFilterState["transcriptTypeFilter"] })}
          >
            <option value="">All Types</option>
            <option value="chat">💬 Chat</option>
            <option value="autonomous">⚡ Autonomous</option>
            <option value="design">🛠️ Design</option>
          </select>
          <select
            value={f.outcomeFilter}
            onChange={(e) => update({ outcomeFilter: e.target.value })}
          >
            <option value="">All Outcomes</option>
            <option value="Handoff">🚪 Handed off</option>
            <option value="Abandoned">Abandoned</option>
            <option value="Resolved">Resolved</option>
            <option value="Escalated">Escalated</option>
          </select>
          <select
            value={f.feedbackFilter}
            onChange={(e) => update({ feedbackFilter: e.target.value as ListFilterState["feedbackFilter"] })}
          >
            <option value="">All Feedback</option>
            <option value="any">Has Feedback</option>
            <option value="likes">Has 👍</option>
            <option value="dislikes">Has 👎</option>
          </select>
          <input
            type="number"
            min="0"
            placeholder="Min turns"
            value={f.minTurns}
            onChange={(e) => update({ minTurns: e.target.value })}
            style={{ width: 90 }}
          />
          <select
            value={f.clientSearchIn}
            onChange={(e) => update({ clientSearchIn: e.target.value as ContentSearchOptions["searchIn"] })}
          >
            <option value="all">All Fields</option>
            <option value="messages">Messages</option>
            <option value="thinking">Agent Thinking</option>
            <option value="toolNames">Tool Names</option>
            <option value="userId">User ID</option>
          </select>
          <input
            placeholder="Refine within results..."
            value={f.clientSearch}
            onChange={(e) => update({ clientSearch: e.target.value })}
            style={{ flex: 1, minWidth: 150 }}
          />
          <label
            className="filter-toggle"
            title="Hide transcripts that are the child-agent side of a connected-agent invocation. Auto-detected from any parent transcript currently loaded."
          >
            <input
              type="checkbox"
              checked={f.hideConnectedAgentSessions}
              onChange={(e) => update({ hideConnectedAgentSessions: e.target.checked })}
            />
            <span>Hide connected agent sessions</span>
          </label>
        </div>
        <UserSearch
          key={f.participantAadId || "empty"}
          onUserSelect={handleUserSelect}
          initialQuery={f.userSearchQuery}
        />
      </div>

      <ActiveFilters
        f={f}
        agents={accessibleBots}
        onRemove={removeFilter}
        onClearAll={clearAllFilters}
      />

      {error && (
        <div className="error-banner">⚠️ {error}</div>
      )}

      <table className="transcript-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>User</th>
            <th>Conversation Start</th>
            <th>Type</th>
            <th>Turns</th>
            <th>Duration</th>
            <th>Feedback</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {clientFiltered.map((t) => (
            <tr
              key={t.conversationtranscriptid}
              onClick={() => onSelect(t.conversationtranscriptid)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(t.conversationtranscriptid);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open transcript ${getDisplayName(t.metadata.botName, t.metadata.botId) || "unnamed"} from ${new Date(t.conversationstarttime).toLocaleString()}`}
            >
              <td>
                <strong>{getDisplayName(t.metadata.botName, t.metadata.botId) || "—"}</strong>
                {childAgentSchemas.has(t.metadata.botName) && (
                  <span
                    className="badge connected-agent-row-badge"
                    title="Connected agent session — this transcript is the child-agent side of an invocation made by another loaded transcript."
                  >
                    🔗 child
                  </span>
                )}
              </td>
              <td>{getUserDisplayName(t.userAadObjectId)}</td>
              <td>{new Date(t.conversationstarttime).toLocaleString()}</td>
              <td>
                <span className={`type-badge ${t.transcriptType}`}>
                  {TRANSCRIPT_TYPE_LABELS[t.transcriptType].icon} {TRANSCRIPT_TYPE_LABELS[t.transcriptType].label}
                </span>
              </td>
              <td>
                {t.turnCount}
                {t.userAttachmentCount > 0 && (
                  <span
                    className="turn-attachment-badge"
                    title={`${t.userAttachmentCount} user message${t.userAttachmentCount === 1 ? "" : "s"} included an attachment (image or file)`}
                  >
                    📎{t.userAttachmentCount}
                  </span>
                )}
              </td>
              <td>{t.totalDurationSeconds != null ? formatDuration(t.totalDurationSeconds) : "—"}</td>
              <td>
                {t.hasFeedback ? (
                  <span className="feedback-summary">
                    {t.likeCount > 0 && <span title={`${t.likeCount} thumbs up`}>👍{t.likeCount}</span>}
                    {t.dislikeCount > 0 && <span title={`${t.dislikeCount} thumbs down`}>👎{t.dislikeCount}</span>}
                  </span>
                ) : "—"}
              </td>
              <td>
                <span className={`badge ${outcomeBadgeClass[t.globalOutcome ?? ""] ?? "badge-info"}`}>
                  {t.globalOutcome ?? "Unknown"}
                </span>
                {t.hasHandoff && (
                  <span
                    className="handoff-row-icon"
                    title={
                      t.handoffs.length > 0
                        ? `Handed off (${[...new Set(t.handoffs.map(h => h.provider))].join(", ")})`
                        : "Handed off to human/external agent"
                    }
                    aria-label="Handed off"
                  >
                    {" 🚪"}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {clientFiltered.length === 0 && !loading && (
            <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "32px 16px" }}>
              {hasAnyFilter ? (
                <div className="empty-state">
                  <div className="empty-state-title">No transcripts match your filters</div>
                  <div className="empty-state-hint">
                    {totalLoaded > 0
                      ? `${totalLoaded} transcripts loaded — none match the active filters above.`
                      : `0 transcripts loaded from the server with the current date / search filters.`}
                  </div>
                  <div className="empty-state-actions">
                    <button type="button" className="empty-state-btn primary" onClick={clearAllFilters}>
                      Clear all filters
                    </button>
                    {hasMore && (
                      <button type="button" className="empty-state-btn" onClick={onLoadMore} disabled={loading}>
                        Load more from server
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-title">No transcripts found</div>
                  <div className="empty-state-hint">
                    Nothing was returned by the server. Try expanding the date range or check that you have access to a Copilot Studio environment with transcripts.
                  </div>
                </div>
              )}
            </td></tr>
          )}
          {loading && (
            <>
              {[...Array(6)].map((_, i) => (
                <tr key={`skeleton-${i}`} className="skeleton-row">
                  <td><div className="skeleton-bar" style={{ width: `${60 + Math.random() * 30}%` }} /></td>
                  <td><div className="skeleton-bar" style={{ width: `${50 + Math.random() * 40}%` }} /></td>
                  <td><div className="skeleton-bar" style={{ width: "75%" }} /></td>
                  <td><div className="skeleton-bar" style={{ width: "60%" }} /></td>
                  <td><div className="skeleton-bar" style={{ width: "30%" }} /></td>
                  <td><div className="skeleton-bar" style={{ width: "40%" }} /></td>
                  <td><div className="skeleton-bar" style={{ width: "25%" }} /></td>
                  <td><div className="skeleton-bar" style={{ width: `${40 + Math.random() * 30}%` }} /></td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>

      {/* Infinite scroll sentinel */}
      {hasMore && (
        <InfiniteScrollSentinel loading={loading} onLoadMore={onLoadMore} />
      )}
    </div>
  );
}

/** Triggers onLoadMore when scrolled into view */
function InfiniteScrollSentinel({ loading, onLoadMore }: { loading: boolean; onLoadMore: () => void }) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && !loading) {
        onLoadMore();
      }
    },
    [loading, onLoadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: "200px", // Trigger 200px before reaching the bottom
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersection]);

  return (
    <div ref={sentinelRef} style={{ textAlign: "center", padding: "16px" }}>
      {loading && (
        <span style={{ color: "#888", fontSize: 13 }}>Loading more...</span>
      )}
    </div>
  );
}

