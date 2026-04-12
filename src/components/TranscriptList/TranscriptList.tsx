import { useMemo } from "react";
import type { ParsedTranscript } from "../../types/transcript";
import { formatDuration } from "../../utils/parseTranscript";
import { searchTranscripts, type ContentSearchOptions } from "../../hooks/useTranscripts";
import { useBotLookup, useUserDisplayNames, type BotInfo } from "../../hooks/useLookups";
import { UserSearch } from "./UserSearch";
import type { AadUser } from "../../hooks/useLookups";
import type { ListFilterState } from "../../App";

const outcomeBadgeClass: Record<string, string> = {
  Resolved: "badge-success",
  Abandoned: "badge-warning",
  Escalated: "badge-danger",
};

interface TranscriptListProps {
  transcripts: ParsedTranscript[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalLoaded: number;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
  onFiltersChange: (filters: { dateFrom?: string; dateTo?: string; contentSearch?: string }) => void;
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
    update({ serverSearchInput: user.objectId, serverSearch: user.objectId, userSearchQuery: `${user.displayname} (${user.mail})` });
    onFiltersChange({
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      contentSearch: user.objectId,
    });
  };

  const applyServerFilters = () => {
    update({ serverSearch: f.serverSearchInput });
    onFiltersChange({
      dateFrom: f.dateFrom || undefined,
      dateTo: f.dateTo || undefined,
      contentSearch: f.serverSearchInput || undefined,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") applyServerFilters();
  };

  const clientFiltered = useMemo(() => {
    let results = transcripts;

    // Agent filter (by schema name from metadata)
    if (f.selectedBotIds.length > 0) {
      const selected = new Set(f.selectedBotIds);
      results = results.filter((t) => selected.has(t.metadata.botName));
    }

    // Outcome filter
    if (f.outcomeFilter) {
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

    // Client-side content search
    if (f.clientSearch.trim()) {
      results = searchTranscripts(results, { query: f.clientSearch, searchIn: f.clientSearchIn });
    }

    return results;
  }, [transcripts, f.selectedBotIds, f.outcomeFilter, f.feedbackFilter, f.clientSearch, f.clientSearchIn]);

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

      {/* Server-side filters */}
      <div className="filter-section">
        <div className="filter-label">🔍 Server Filters</div>
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
            <label>Content Search (server-side)</label>
            <input
              placeholder="Search in transcript content (user ID, text, tool names...)"
              value={f.serverSearchInput}
              onChange={(e) => update({ serverSearchInput: e.target.value })}
              onKeyDown={handleKeyDown}
              style={{ width: "100%" }}
            />
          </div>
          <button className="apply-btn" onClick={applyServerFilters} disabled={loading}>
            {loading ? "Loading..." : "Apply"}
          </button>
        </div>
        <UserSearch onUserSelect={handleUserSelect} initialQuery={f.userSearchQuery} />
      </div>

      {/* Client-side refinement filters */}
      <div className="filter-section">
        <div className="filter-label">🔎 Refine Loaded Results</div>
        <div className="list-toolbar">
          {accessibleBots.length > 0 && (
            <select
              value={f.selectedBotIds.length === 1 ? f.selectedBotIds[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  update({ selectedBotIds: [] });
                } else {
                  update({ selectedBotIds: [val] });
                }
              }}
            >
              <option value="">All Agents</option>
              {accessibleBots.map((bot) => (
                <option key={bot.schemaName} value={bot.schemaName}>
                  {bot.displayName || bot.schemaName}
                </option>
              ))}
            </select>
          )}
          <select
            value={f.clientSearchIn}
            onChange={(e) => update({ clientSearchIn: e.target.value as ContentSearchOptions["searchIn"] })}
          >
            <option value="all">All Fields</option>
            <option value="messages">Messages Only</option>
            <option value="thinking">Agent Thinking Only</option>
            <option value="toolNames">Tool Names Only</option>
            <option value="userId">User ID Only</option>
          </select>
          <input
            placeholder="Refine search within loaded results..."
            value={f.clientSearch}
            onChange={(e) => update({ clientSearch: e.target.value })}
            style={{ flex: 1 }}
          />
          <select
            value={f.outcomeFilter}
            onChange={(e) => update({ outcomeFilter: e.target.value })}
          >
            <option value="">All Outcomes</option>
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
        </div>
      </div>

      {error && (
        <div className="error-banner">⚠️ {error}</div>
      )}

      <table className="transcript-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th>User</th>
            <th>Conversation Start</th>
            <th>Channel</th>
            <th>Turns</th>
            <th>Duration</th>
            <th>Feedback</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {clientFiltered.map((t) => (
            <tr key={t.conversationtranscriptid} onClick={() => onSelect(t.conversationtranscriptid)}>
              <td><strong>{getDisplayName(t.metadata.botName, t.metadata.botId) || "—"}</strong></td>
              <td>{getUserDisplayName(t.userAadObjectId)}</td>
              <td>{new Date(t.conversationstarttime).toLocaleString()}</td>
              <td>{t.channelId ?? "—"}</td>
              <td>{t.turnCount}</td>
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
              </td>
            </tr>
          ))}
          {clientFiltered.length === 0 && !loading && (
            <tr><td colSpan={8} style={{ textAlign: "center", color: "#888", padding: "24px" }}>
              {f.serverSearch || f.dateFrom || f.dateTo ? "No transcripts match your filters" : "No transcripts found"}
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

      {hasMore && !loading && (
        <div style={{ textAlign: "center", padding: "16px" }}>
          <button className="load-more-btn" onClick={onLoadMore}>
            Load More
          </button>
        </div>
      )}
    </div>
  );
}

