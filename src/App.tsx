import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useTranscripts, useTranscript, type TranscriptFilters } from "./hooks/useTranscripts";
import { useBotLookup } from "./hooks/useLookups";
import { TranscriptList } from "./components/TranscriptList/TranscriptList";
import { INITIAL_FILTER_STATE, type ListFilterState } from "./state/listFilters";
import "./App.css";

// Code-split the detail and analytics views — they are heavy (DebugPanel, MessageTimeline,
// PDF/HTML exporters) and not needed for the initial list render. Vite emits a separate
// chunk for each that loads on first navigation and is then cached.
const TranscriptDetail = lazy(() =>
  import("./components/TranscriptDetail/TranscriptDetail").then((m) => ({ default: m.TranscriptDetail })),
);
const AnalyticsSummary = lazy(() =>
  import("./components/Analytics/AnalyticsSummary").then((m) => ({ default: m.AnalyticsSummary })),
);

const LazyFallback = ({ label }: { label: string }) => (
  <div className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
    {label}
  </div>
);

type View = "list" | "detail" | "analytics";

const DEFAULT_PAGE_SIZE = 50;

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
      return <LazyFallback label="Loading transcript..." />;
    }
    if (transcript) {
      return (
        <Suspense fallback={<LazyFallback label="Loading transcript..." />}>
          <TranscriptDetail
            transcript={transcript}
            onBack={handleBack}
            onOpenTranscript={handleSelect}
            allLoadedTranscripts={transcripts}
          />
        </Suspense>
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
          <Suspense fallback={<LazyFallback label="Loading analytics..." />}>
            <AnalyticsSummary transcripts={transcripts} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default App;

