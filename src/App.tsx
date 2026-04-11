import { useState, useCallback } from "react";
import { useTranscripts, useTranscript, type TranscriptFilters } from "./hooks/useTranscripts";
import type { ContentSearchOptions } from "./hooks/useTranscripts";
import { useBotLookup } from "./hooks/useLookups";
import { TranscriptList } from "./components/TranscriptList/TranscriptList";
import { TranscriptDetail } from "./components/TranscriptDetail/TranscriptDetail";
import { AnalyticsSummary } from "./components/Analytics/AnalyticsSummary";
import "./App.css";

type View = "list" | "detail" | "analytics";

const DEFAULT_PAGE_SIZE = 25;

/** All filter state lifted to App so it persists across view changes */
export interface ListFilterState {
  dateFrom: string;
  dateTo: string;
  serverSearchInput: string;
  serverSearch: string;
  clientSearch: string;
  clientSearchIn: ContentSearchOptions["searchIn"];
  outcomeFilter: string;
  agentFilter: string;
  selectedBotIds: string[];
  userSearchQuery: string;
  feedbackFilter: "" | "any" | "likes" | "dislikes";
}

const INITIAL_FILTER_STATE: ListFilterState = {
  dateFrom: "",
  dateTo: "",
  serverSearchInput: "",
  serverSearch: "",
  clientSearch: "",
  clientSearchIn: "all",
  outcomeFilter: "",
  agentFilter: "",
  selectedBotIds: [],
  userSearchQuery: "",
  feedbackFilter: "",
};

function App() {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [listFilters, setListFilters] = useState<ListFilterState>(INITIAL_FILTER_STATE);

  const { accessibleBots, ready: botsReady } = useBotLookup();

  const [filters, setFilters] = useState<TranscriptFilters>({
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const { transcripts, loading, error, hasMore, totalLoaded, loadMore } = useTranscripts(filters);
  const { transcript, loading: detailLoading } = useTranscript(selectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  const handleBack = () => {
    setView("list");
    setSelectedId(undefined);
  };

  const handleFiltersChange = useCallback((newFilters: { dateFrom?: string; dateTo?: string; contentSearch?: string }) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  if (view === "detail") {
    if (detailLoading) {
      return <div className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>Loading transcript...</div>;
    }
    if (transcript) {
      return (
        <TranscriptDetail
          transcript={transcript}
          onBack={handleBack}
          onOpenTranscript={handleSelect}
        />
      );
    }
  }

  return (
    <div className="app-root">
      <nav className="app-nav">
        <button
          className={`tab-btn ${view === "list" ? "active" : ""}`}
          onClick={() => setView("list")}
        >
          Transcripts
        </button>
        <button
          className={`tab-btn ${view === "analytics" ? "active" : ""}`}
          onClick={() => setView("analytics")}
        >
          Analytics
        </button>
        <span className="app-version" title={`Built: ${__BUILD_TIME__}`}>v1.0.5 · {new Date(__BUILD_TIME__).toLocaleString()}</span>
      </nav>
      <div className="app-content">
        {view === "list" && (
          <TranscriptList
            transcripts={transcripts}
            loading={loading || !botsReady}
            error={error}
            hasMore={hasMore}
            totalLoaded={totalLoaded}
            onSelect={handleSelect}
            onLoadMore={loadMore}
            onFiltersChange={handleFiltersChange}
            filterState={listFilters}
            onFilterStateChange={setListFilters}
            accessibleBots={accessibleBots}
          />
        )}
        {view === "analytics" && (
          <AnalyticsSummary transcripts={transcripts} />
        )}
      </div>
    </div>
  );
}

export default App;

