// Browse via Flows — full TranscriptList UI backed by Power Automate flows.
//
// Unlike the MSAL Browse Environments tab, this tab requires no sign-in token.
// Authentication is handled by the Dataverse connection on the cloud flows
// (Get-Agents, Get-Transcripts), so it works inside deployed Code Apps where
// client-side MSAL tokens are unavailable.
//
// Layout:
//   1. envUrl input + Validate button (always visible as headerLeading in list)
//   2. Status badge: untested / validating / ✅ valid (N agents) / ❌ error
//   3. After successful validation: full TranscriptList + TranscriptDetail

import {
  useCallback,
  useMemo,
  useState,
  lazy,
  Suspense,
  type CSSProperties,
  type ReactNode,
} from "react";
import { LookupsProvider, useBotLookup } from "../../context/LookupsContext";
import { TranscriptList } from "../TranscriptList/TranscriptList";
import { INITIAL_FILTER_STATE, type ListFilterState } from "../../state/listFilters";
import type { TranscriptFilters } from "../../hooks/useTranscripts";
import { useFilteredTranscripts } from "../../hooks/useFilteredTranscripts";
import { createFlowLookupsImpl, useFlowTranscripts } from "./flowHooks";
import { validateEnvViaFlow } from "./flowDataSource";

const TranscriptDetail = lazy(() =>
  import("../TranscriptDetail/TranscriptDetail").then((m) => ({ default: m.TranscriptDetail })),
);

const DEFAULT_ENV_URL = "https://ralop-prov.crm.dynamics.com";
const DEFAULT_PAGE_SIZE = 50;

type ValidateStatus =
  | { kind: "untested" }
  | { kind: "validating" }
  | { kind: "valid"; agentCount: number }
  | { kind: "error"; message: string };

// ── Styles (inline, reusing CSS vars from the existing app theme) ────

const inputStyle: CSSProperties = {
  padding: "5px 8px",
  fontSize: 13,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  border: "1px solid var(--color-border, #ccc)",
  borderRadius: 4,
  background: "var(--color-input-bg, #fff)",
  color: "var(--color-text, #222)",
  minWidth: 320,
  boxSizing: "border-box",
};

// ── Top-level workspace ──────────────────────────────────────────────

export function BrowseFlowsWorkspace() {
  const [inputUrl, setInputUrl] = useState(DEFAULT_ENV_URL);
  const [validatedUrl, setValidatedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ValidateStatus>({ kind: "untested" });

  const handleValidate = useCallback(async () => {
    const url = inputUrl.trim();
    if (!url) return;
    setStatus({ kind: "validating" });
    const result = await validateEnvViaFlow(url);
    if (result.ok) {
      setStatus({ kind: "valid", agentCount: result.agentCount });
      setValidatedUrl(url);
    } else {
      setStatus({ kind: "error", message: result.error ?? "Unknown error" });
      setValidatedUrl(null);
    }
  }, [inputUrl]);

  const statusBadge = (): ReactNode => {
    switch (status.kind) {
      case "untested":
        return (
          <span style={{ color: "var(--color-text-muted, #888)", fontSize: 13 }}>
            Not tested
          </span>
        );
      case "validating":
        return (
          <span style={{ color: "var(--color-text-muted, #888)", fontSize: 13 }}>
            Validating…
          </span>
        );
      case "valid":
        return (
          <span style={{ color: "var(--color-success, #2a7a2a)", fontWeight: 600, fontSize: 13 }}>
            ✅ Valid — {status.agentCount} agent(s) visible
          </span>
        );
      case "error":
        return (
          <span style={{ color: "var(--color-error, #c00)", fontSize: 13 }}>
            ❌ {status.message}
          </span>
        );
    }
  };

  const urlBar = (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <input
        value={inputUrl}
        onChange={(e) => {
          setInputUrl(e.target.value);
          setStatus({ kind: "untested" });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") void handleValidate();
        }}
        placeholder="https://org.crm.dynamics.com"
        style={inputStyle}
        aria-label="Environment URL"
      />
      <button
        onClick={() => void handleValidate()}
        disabled={status.kind === "validating" || !inputUrl.trim()}
        style={{ padding: "5px 12px", fontSize: 13, whiteSpace: "nowrap" }}
      >
        {status.kind === "validating" ? "Validating…" : "Validate"}
      </button>
      {statusBadge()}
    </div>
  );

  // Until validated, render a splash / error card rather than the transcript shell.
  if (!validatedUrl || status.kind !== "valid") {
    return (
      <div
        style={{
          padding: 24,
          maxWidth: 900,
          margin: "0 auto",
          color: "var(--color-text, #222)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Browse via Flows</h2>
        <p style={{ opacity: 0.75, fontSize: 13, marginTop: 0 }}>
          Query conversation transcripts from any Dataverse environment using
          the Power Automate cloud flows. No MSAL sign-in required — the
          flow&apos;s Dataverse connection handles authentication.
        </p>
        {urlBar}
        {status.kind === "error" && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              background: "var(--color-error-bg, #fee2e2)",
              borderRadius: 6,
              color: "var(--color-error, #900)",
              fontSize: 13,
              border: "1px solid var(--color-error-border, #fca5a5)",
            }}
          >
            <strong>Connection failed</strong>
            <br />
            {status.message}
            <br />
            <br />
            <em>Common causes:</em>
            <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
              <li>
                The flow&apos;s Dataverse connection needs re-authorization in
                Power Automate
              </li>
              <li>
                Your account lacks read permission on the{" "}
                <code>bot</code> or <code>conversationtranscript</code> tables
                in the target environment
              </li>
              <li>
                The environment URL format is incorrect (expected:
                https://orgname.crm.dynamics.com)
              </li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Remount the subtree on every new validated url so per-env hook state
  // (bot cache, transcript page state, filter state) starts fresh.
  return (
    <FlowsSubtree
      key={validatedUrl}
      envUrl={validatedUrl}
      headerLeading={urlBar}
    />
  );
}

// ── Subtree (mounted once per validated env) ─────────────────────────

function FlowsSubtree({
  envUrl,
  headerLeading,
}: {
  envUrl: string;
  headerLeading: ReactNode;
}) {
  const lookupsImpl = useMemo(() => createFlowLookupsImpl(envUrl), [envUrl]);
  return (
    <LookupsProvider value={lookupsImpl}>
      <FlowTranscriptsView envUrl={envUrl} headerLeading={headerLeading} />
    </LookupsProvider>
  );
}

// ── Inner view (bot lookup + transcript list + detail) ───────────────

function FlowTranscriptsView({
  envUrl,
  headerLeading,
}: {
  envUrl: string;
  headerLeading: ReactNode;
}) {
  const [filterState, setFilterState] = useState<ListFilterState>(INITIAL_FILTER_STATE);
  const [filters, setFilters] = useState<TranscriptFilters>({ pageSize: DEFAULT_PAGE_SIZE });
  const [openId, setOpenId] = useState<string | null>(null);

  const { accessibleBots, ready: botsReady } = useBotLookup();
  const accessibleSchemaNames = useMemo(
    () => new Set(accessibleBots.map((b) => b.schemaName).filter(Boolean)),
    [accessibleBots],
  );

  const rawPage = useFlowTranscripts(envUrl, filters);
  const { transcripts, loading, error, hasMore, totalLoaded, loadMore, autoLoading } =
    useFilteredTranscripts(rawPage, accessibleSchemaNames, botsReady, DEFAULT_PAGE_SIZE);

  const handleFiltersChange = useCallback(
    (nf: {
      dateFrom?: string;
      dateTo?: string;
      contentSearch?: string;
      participantAadId?: string;
    }) => {
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
