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
import type { FlowErrorCategory, FlowErrorDetails } from "./flowDataSource";

const TranscriptDetail = lazy(() =>
  import("../TranscriptDetail/TranscriptDetail").then((m) => ({ default: m.TranscriptDetail })),
);

const DEFAULT_ENV_URL = "https://ORGNAME.crm.dynamics.com";
const DEFAULT_PAGE_SIZE = 50;

type ValidateStatus =
  | { kind: "untested" }
  | { kind: "validating" }
  | { kind: "valid"; agentCount: number }
  | {
      kind: "error";
      category: FlowErrorCategory;
      message: string;
      details: FlowErrorDetails;
    };

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

// ── Error theme: distinct visuals per failure category ───────────────
//
// Operators reading these on screen need to distinguish *at a glance*:
//   - flow_failure       → red, "fix the flow"
//   - permission_denied  → blue, "you don't have access" (not actionable from
//                          the app — they need rights granted in target env)
//   - query_error        → amber, "our query is wrong" (escalate, fix code)
//   - downstream_other   → orange, "downstream service failed in an
//                          unrecognized way"
//   - parse_error        → purple, "flow output schema drifted"
const ERROR_THEME: Record<
  FlowErrorCategory,
  {
    badgeIcon: string;
    badgeLabel: string;
    badgeColor: string;
    cardBg: string;
    cardBorder: string;
    cardText: string;
    title: string;
    subtitle: string;
    hints: string[];
  }
> = {
  flow_failure: {
    badgeIcon: "🔴",
    badgeLabel: "Flow failed",
    badgeColor: "var(--color-error, #c00)",
    cardBg: "var(--color-error-bg, #fee2e2)",
    cardBorder: "var(--color-error-border, #fca5a5)",
    cardText: "var(--color-error, #900)",
    title: "Flow failed to run",
    subtitle:
      "The Power Automate flow itself never produced a successful response. " +
      "This points at the flow definition, its connections, or the gateway.",
    hints: [
      "Open Power Automate → flow → Run history. If you see no new run for this attempt, the gateway rejected the request before invocation.",
      "Re-authorize the flow's Dataverse connection (it may have expired).",
      "Verify the connection reference IDs in power.config.json still match the deployed flow's workflow GUIDs.",
      "Re-run `npx power-apps push` after editing the flow definition.",
    ],
  },
  permission_denied: {
    badgeIcon: "🔒",
    badgeLabel: "Access denied",
    badgeColor: "#1d4ed8",
    cardBg: "#dbeafe",
    cardBorder: "#93c5fd",
    cardText: "#1e3a8a",
    title: "Access denied in the target environment",
    subtitle:
      "The flow ran fine, but the identity it uses to call Dataverse doesn't " +
      "have read permission on this table in the target environment. Nothing " +
      "to fix in the app — get rights granted (or use a different env).",
    hints: [
      "Have an environment admin grant read perms on the bot / conversationtranscript tables for the user that owns the flow's Dataverse connection.",
      "Or pick a different environment URL where you do have access.",
    ],
  },
  query_error: {
    badgeIcon: "🐛",
    badgeLabel: "Query bug",
    badgeColor: "#b07a00",
    cardBg: "#fef9c3",
    cardBorder: "#fde047",
    cardText: "#713f12",
    title: "Bad query — likely a bug in the app",
    subtitle:
      "The flow ran fine, but Dataverse rejected the query we sent. This is " +
      "almost always a bug in the FetchXML we constructed (wrong attribute " +
      "name, illegal combination of FetchXML attributes, etc.). Escalate.",
    hints: [
      "Check the message below for the exact attribute / clause Dataverse complained about.",
      "Compare against the FetchXML built in flowDataSource.ts (buildAgentsFetchXml / buildTranscriptsFetchXml).",
    ],
  },
  downstream_other: {
    badgeIcon: "⚠️",
    badgeLabel: "Downstream error",
    badgeColor: "#c2410c",
    cardBg: "#ffedd5",
    cardBorder: "#fdba74",
    cardText: "#7c2d12",
    title: "Downstream service returned an unexpected error",
    subtitle:
      "The flow ran fine, but Dataverse (or the service the flow called) " +
      "responded with an error that doesn't fit the usual permission/query " +
      "patterns. Could be transient (5xx) or an unrecognized failure shape.",
    hints: [
      "Retry — if it was transient (5xx) the next attempt may succeed.",
      "If it persists, expand 'Raw payload' below and share with engineering.",
    ],
  },
  parse_error: {
    badgeIcon: "🟣",
    badgeLabel: "Flow output unparseable",
    badgeColor: "#7c3aed",
    cardBg: "#ede9fe",
    cardBorder: "#c4b5fd",
    cardText: "#4c1d95",
    title: "Flow returned 200, but its output couldn't be parsed",
    subtitle:
      "The flow finished without an `errordetails` value, but the `valuejson` " +
      "field wasn't valid JSON. The flow's output schema may have drifted.",
    hints: [
      "Open the flow and verify the final 'Respond to PowerApp' action returns valuejson as a string.",
      "After re-saving the flow, run `npx power-apps refresh-data-source get_agents` (and get_transcripts) to re-sync the typed model.",
    ],
  },
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
      setStatus({
        kind: "error",
        category: result.category,
        message: result.message,
        details: result.details,
      });
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
          <span style={{ color: ERROR_THEME[status.category].badgeColor, fontSize: 13 }}>
            {ERROR_THEME[status.category].badgeIcon} {ERROR_THEME[status.category].badgeLabel}
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
        {status.kind === "error" && <ErrorCard status={status} />}
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

// ── ErrorCard: category-aware status panel ───────────────────────────

function ErrorCard({
  status,
}: {
  status: {
    kind: "error";
    category: FlowErrorCategory;
    message: string;
    details: FlowErrorDetails;
  };
}) {
  const theme = ERROR_THEME[status.category];
  const { details } = status;
  const hasInner =
    details.innerStatusCode != null ||
    details.innerErrorCode != null ||
    details.innerErrorMessage != null;

  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        background: theme.cardBg,
        borderRadius: 6,
        color: theme.cardText,
        fontSize: 13,
        border: `1px solid ${theme.cardBorder}`,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
        {theme.badgeIcon} {theme.title}
      </div>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>{theme.subtitle}</div>

      <div
        style={{
          background: "rgba(0,0,0,0.06)",
          padding: "8px 10px",
          borderRadius: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          marginBottom: 10,
          wordBreak: "break-word",
        }}
      >
        {status.message}
      </div>

      {hasInner && (
        <div style={{ marginBottom: 10, fontSize: 12 }}>
          <strong>Downstream details:</strong>
          <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
            {details.innerStatusCode != null && (
              <li>
                Status: <code>{details.innerStatusCode}</code>
              </li>
            )}
            {details.innerErrorCode && (
              <li>
                Error code: <code>{details.innerErrorCode}</code>
              </li>
            )}
            {details.innerErrorMessage && (
              <li>
                Message: <code>{details.innerErrorMessage}</code>
              </li>
            )}
          </ul>
        </div>
      )}

      <div>
        <em>What to try:</em>
        <ul style={{ margin: "4px 0 0 0", paddingLeft: 20 }}>
          {theme.hints.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      </div>

      {details.raw && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.75 }}>
            Raw payload
          </summary>
          <pre
            style={{
              marginTop: 6,
              padding: 8,
              background: "rgba(0,0,0,0.06)",
              borderRadius: 4,
              fontSize: 11,
              maxHeight: 240,
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {details.raw}
          </pre>
        </details>
      )}
    </div>
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
