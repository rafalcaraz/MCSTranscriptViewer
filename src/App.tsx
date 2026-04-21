import { useState, useCallback, useEffect } from "react";
import { useTranscripts, useTranscript, type TranscriptFilters } from "./hooks/useTranscripts";
import { useBotLookup } from "./hooks/useLookups";
import { TranscriptList } from "./components/TranscriptList/TranscriptList";
import { TranscriptDetail } from "./components/TranscriptDetail/TranscriptDetail";
import { AnalyticsSummary } from "./components/Analytics/AnalyticsSummary";
import { INITIAL_FILTER_STATE, type ListFilterState } from "./state/listFilters";
import "./App.css";

type View = "list" | "detail" | "analytics";

const DEFAULT_PAGE_SIZE = 25;

function App() {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const m = window.location.hash.match(/[#&]t=([0-9a-f-]{36})/i);
    return m ? m[1] : undefined;
  });
  const [listFilters, setListFilters] = useState<ListFilterState>(INITIAL_FILTER_STATE);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Sync view with initial deep-link selectedId (set above) and react to back/forward navigation.
  useEffect(() => {
    if (selectedId) setView("detail");
    const onHash = () => {
      const m = window.location.hash.match(/[#&]t=([0-9a-f-]{36})/i);
      if (m) {
        setSelectedId(m[1]);
        setView("detail");
      } else {
        setSelectedId(undefined);
        setView((v) => (v === "detail" ? "list" : v));
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { accessibleBots, ready: botsReady } = useBotLookup();

  const [filters, setFilters] = useState<TranscriptFilters>({
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const { transcripts, loading, error, hasMore, totalLoaded, loadMore } = useTranscripts(filters);
  const { transcript, loading: detailLoading } = useTranscript(selectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView("detail");
    if (typeof window !== "undefined") {
      const newHash = `#t=${id}`;
      if (window.location.hash !== newHash) {
        window.history.pushState(null, "", newHash);
      }
    }
  };

  const handleBack = () => {
    setView("list");
    setSelectedId(undefined);
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.pushState(null, "", window.location.pathname + window.location.search);
    }
  };

  const handleFiltersChange = useCallback((newFilters: { dateFrom?: string; dateTo?: string; contentSearch?: string; participantAadId?: string }) => {
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
          allLoadedTranscripts={transcripts}
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
        <button className="theme-toggle" onClick={() => setDarkMode(d => !d)} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
          {darkMode ? "☀️" : "🌙"}
        </button>
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

