// Browse Environments — full UI parity with the "This Environment" tab.
// Same TranscriptList + TranscriptDetail components, just wrapped in an
// env-scoped LookupsProvider so bot/user display names resolve against the
// currently selected env's Dataverse instance. The env picker is embedded
// in the TranscriptList toolbar as a typeahead — no standalone "Environment"
// card.

import { useCallback, useMemo, useState, lazy, Suspense, type ReactNode } from "react";
import { LookupsProvider, useBotLookup } from "../../context/LookupsContext";
import { TranscriptList } from "../TranscriptList/TranscriptList";
import { INITIAL_FILTER_STATE, type ListFilterState } from "../../state/listFilters";
import type { TranscriptFilters } from "../../hooks/useTranscripts";
import { useFilteredTranscripts } from "../../hooks/useFilteredTranscripts";
import { createEnvLookupsImpl, useEnvTranscripts, type EnvAuth } from "./envHooks";
import { EnvCombobox } from "./EnvCombobox";

const TranscriptDetail = lazy(() =>
  import("../TranscriptDetail/TranscriptDetail").then((m) => ({ default: m.TranscriptDetail })),
);

export type EnvOption = {
  apiUrl: string;
  friendlyName: string;
  region: string;
  urlName: string;
  uniqueName: string;
};

interface Props {
  envs: EnvOption[];
  selectedEnvUrl: string;
  onSelectEnv: (apiUrl: string) => void;
  getEnvToken: (envApiUrl: string) => Promise<string>;
}

const DEFAULT_PAGE_SIZE = 50;

export function BrowseEnvironmentsWorkspace({ envs, selectedEnvUrl, onSelectEnv, getEnvToken }: Props) {
  const selectedEnv = envs.find((e) => e.apiUrl === selectedEnvUrl) ?? null;

  const picker = (
    <EnvCombobox envs={envs} selectedEnvUrl={selectedEnvUrl} onSelect={onSelectEnv} />
  );

  if (!selectedEnv) {
    // No env picked yet — render an empty TranscriptList shell so the toolbar
    // (with the env picker) is visible and immediately usable.
    return <EmptyShell picker={picker} envCount={envs.length} />;
  }

  return (
    // Remount the entire sub-tree on env change so every per-env hook (bot
    // cache, user cache, transcripts page state, filter state) starts fresh
    // and never collides across envs.
    <EnvSubtree
      key={selectedEnv.apiUrl}
      envApiUrl={selectedEnv.apiUrl}
      getEnvToken={getEnvToken}
      headerLeading={picker}
    />
  );
}

function EmptyShell({ picker, envCount }: { picker: ReactNode; envCount: number }) {
  const [filterState, setFilterState] = useState<ListFilterState>(INITIAL_FILTER_STATE);
  return (
    <TranscriptList
      transcripts={[]}
      loading={false}
      error={envCount === 0 ? "No environments available" : null}
      hasMore={false}
      totalLoaded={0}
      onSelect={() => undefined}
      onLoadMore={() => undefined}
      onFiltersChange={() => undefined}
      filterState={filterState}
      onFilterStateChange={setFilterState}
      accessibleBots={[]}
      headerLeading={picker}
    />
  );
}

function EnvSubtree({
  envApiUrl,
  getEnvToken,
  headerLeading,
}: {
  envApiUrl: string;
  getEnvToken: (u: string) => Promise<string>;
  headerLeading: ReactNode;
}) {
  const auth = useMemo<EnvAuth>(() => ({ envApiUrl, getToken: getEnvToken }), [envApiUrl, getEnvToken]);
  const lookupsImpl = useMemo(() => createEnvLookupsImpl(auth), [auth]);

  return (
    <LookupsProvider value={lookupsImpl}>
      <EnvTranscriptsView auth={auth} headerLeading={headerLeading} />
    </LookupsProvider>
  );
}

function EnvTranscriptsView({ auth, headerLeading }: { auth: EnvAuth; headerLeading: ReactNode }) {
  const [filterState, setFilterState] = useState<ListFilterState>(INITIAL_FILTER_STATE);
  const [filters, setFilters] = useState<TranscriptFilters>({ pageSize: DEFAULT_PAGE_SIZE });
  const [openId, setOpenId] = useState<string | null>(null);

  const { accessibleBots, ready: botsReady } = useBotLookup();
  const accessibleSchemaNames = useMemo(
    () => new Set(accessibleBots.map((b) => b.schemaName).filter(Boolean)),
    [accessibleBots],
  );

  const rawPage = useEnvTranscripts(auth, filters);
  const { transcripts, loading, error, hasMore, totalLoaded, loadMore, autoLoading } =
    useFilteredTranscripts(rawPage, accessibleSchemaNames, botsReady, DEFAULT_PAGE_SIZE);

  const handleFiltersChange = useCallback(
    (nf: { dateFrom?: string; dateTo?: string; contentSearch?: string; participantAadId?: string }) => {
      setFilters((prev) => ({ ...prev, ...nf }));
    },
    [],
  );

  const selected = useMemo(
    () => transcripts.find((t) => t.conversationtranscriptid === openId) ?? null,
    [transcripts, openId],
  );

  if (openId && selected) {
    return (
      <Suspense fallback={<div style={{ padding: 24 }}>Loading transcript…</div>}>
        <TranscriptDetail
          transcript={selected}
          onBack={() => setOpenId(null)}
          onOpenTranscript={setOpenId}
          allLoadedTranscripts={transcripts}
        />
      </Suspense>
    );
  }

  return (
    <TranscriptList
      transcripts={transcripts}
      loading={loading || autoLoading || !botsReady}
      error={error}
      hasMore={hasMore}
      totalLoaded={totalLoaded}
      onSelect={setOpenId}
      onLoadMore={loadMore}
      onFiltersChange={handleFiltersChange}
      filterState={filterState}
      onFilterStateChange={setFilterState}
      accessibleBots={accessibleBots}
      headerLeading={headerLeading}
    />
  );
}

