import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useTranscripts, useTranscript, type TranscriptFilters } from "./hooks/useTranscripts";
import { useFilteredTranscripts } from "./hooks/useFilteredTranscripts";
import { useBotLookup } from "./context/LookupsContext";
import { TranscriptList } from "./components/TranscriptList/TranscriptList";
import { INITIAL_FILTER_STATE, type ListFilterState } from "./state/listFilters";
import "./App.css";

// Code-split the detail view — it is heavy (DebugPanel, MessageTimeline,
// PDF/HTML exporters) and not needed for the initial list render.
const TranscriptDetail = lazy(() =>
  import("./components/TranscriptDetail/TranscriptDetail").then((m) => ({ default: m.TranscriptDetail })),
);
const MultiEnvPanel = lazy(() =>
  import("./components/MultiEnv/MultiEnvPanel").then((m) => ({ default: m.MultiEnvPanel })),
);

const LazyFallback = ({ label }: { label: string }) => (
  <div className="app-root" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
    {label}
  </div>
);

type View = "list" | "detail" | "multienv";

const DEFAULT_PAGE_SIZE = 50;

function App() {
  const [view, setView] = useState<View>("list");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
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

  const { accessibleBots, ready: botsReady } = useBotLookup();
  const accessibleSchemaNames = useMemo(
    () => new Set(accessibleBots.map((b) => b.schemaName).filter(Boolean)),
    [accessibleBots],
  );

  const [filters, setFilters] = useState<TranscriptFilters>({
    pageSize: DEFAULT_PAGE_SIZE,
  });

  const rawPage = useTranscripts(filters);
  const { transcripts, loading, error, hasMore, totalLoaded, loadMore, autoLoading } =
    useFilteredTranscripts(rawPage, accessibleSchemaNames, botsReady, DEFAULT_PAGE_SIZE);
  const { transcript, loading: detailLoading } = useTranscript(selectedId);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setView("detail");
  };

  const handleBack = () => {
    setView("list");
    setSelectedId(undefined);
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
          title="Transcripts in the environment where this app is installed"
        >
          This Environment
        </button>
        <button
          className={`tab-btn ${view === "multienv" ? "active" : ""}`}
          onClick={() => setView("multienv")}
          title="Sign in with your own credentials to browse Dataverse environments cross-tenant (preview)"
        >
          Browse Environments
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
            loading={loading || autoLoading || !botsReady}
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
        {view === "multienv" && (
          <Suspense fallback={<LazyFallback label="Loading Browse Environments..." />}>
            <MultiEnvPanel />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default App;

