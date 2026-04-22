import { useEffect, useMemo, useState } from "react";
import { parseTranscript } from "../../utils/parseTranscript";
import type { ParsedTranscript } from "../../types/transcript";
import { TranscriptDetail } from "../TranscriptDetail/TranscriptDetail";
import {
  fetchAgents,
  fetchTranscriptList,
  fetchTranscriptRecord,
  WebApiError,
  type AgentRow,
  type TranscriptListRow,
} from "./multiEnvDataSource";

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
  /** Acquires an access token scoped to the given env's resource. */
  getEnvToken: (envApiUrl: string) => Promise<string>;
}

type LoadState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: T }
  | { kind: "error"; message: string };

export function MultiEnvWorkspace({ envs, selectedEnvUrl, onSelectEnv, getEnvToken }: Props) {
  const [envFilter, setEnvFilter] = useState("");
  const [agentsState, setAgentsState] = useState<LoadState<AgentRow[]>>({ kind: "idle" });
  const [selectedSchemaName, setSelectedSchemaName] = useState<string>("");
  const [contentSearch, setContentSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [transcriptsState, setTranscriptsState] = useState<LoadState<TranscriptListRow[]>>({ kind: "idle" });
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);
  const [openTranscriptState, setOpenTranscriptState] = useState<LoadState<ParsedTranscript>>({ kind: "idle" });

  const filteredEnvs = useMemo(() => {
    const q = envFilter.trim().toLowerCase();
    if (!q) return envs;
    return envs.filter((e) =>
      e.friendlyName.toLowerCase().includes(q) ||
      e.urlName.toLowerCase().includes(q) ||
      e.uniqueName.toLowerCase().includes(q) ||
      e.region.toLowerCase().includes(q) ||
      e.apiUrl.toLowerCase().includes(q),
    );
  }, [envs, envFilter]);

  const selectedEnv = envs.find((e) => e.apiUrl === selectedEnvUrl);

  useEffect(() => {
    // Reset per-env state when the selected env changes.
    setSelectedSchemaName("");
    setContentSearch("");
    setAppliedSearch("");
    setOpenTranscriptId(null);
    setOpenTranscriptState({ kind: "idle" });
    setAgentsState({ kind: "idle" });
    setTranscriptsState({ kind: "idle" });
    if (!selectedEnv) return;

    let cancelled = false;
    const loadAgents = async () => {
      setAgentsState({ kind: "loading" });
      try {
        const token = await getEnvToken(selectedEnv.apiUrl);
        const agents = await fetchAgents(selectedEnv.apiUrl, token);
        if (!cancelled) setAgentsState({ kind: "ok", data: agents });
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof WebApiError ? e.message : (e as Error).message ?? String(e);
          setAgentsState({ kind: "error", message: msg });
        }
      }
    };
    void loadAgents();
    return () => { cancelled = true; };
  }, [selectedEnv, getEnvToken]);

  useEffect(() => {
    if (!selectedEnv) return;
    let cancelled = false;
    const loadTranscripts = async () => {
      setTranscriptsState({ kind: "loading" });
      try {
        const token = await getEnvToken(selectedEnv.apiUrl);
        const list = await fetchTranscriptList(selectedEnv.apiUrl, token, {
          contentSearch: appliedSearch || undefined,
          top: 100,
        });
        if (!cancelled) setTranscriptsState({ kind: "ok", data: list });
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof WebApiError ? e.message : (e as Error).message ?? String(e);
          setTranscriptsState({ kind: "error", message: msg });
        }
      }
    };
    void loadTranscripts();
    return () => { cancelled = true; };
  }, [selectedEnv, appliedSearch, getEnvToken]);

  // Client-side scoping. The conversationtranscript table is owned by a Microsoft
  // service principal, so Dataverse RLS does NOT scope rows by which /bots the user
  // can read — a "Transcript Viewer" sees every transcript in the env. We must
  // enforce access scoping ourselves by intersecting metadata.BotName with the
  // user's accessible bot schema names (which IS RLS-scoped via /bots).
  const accessibleSchemaNames = useMemo(() => {
    if (agentsState.kind !== "ok") return new Set<string>();
    return new Set(agentsState.data.map((a) => a.schemaname).filter((s): s is string => !!s));
  }, [agentsState]);

  const visibleTranscripts = useMemo(() => {
    if (transcriptsState.kind !== "ok") return [] as TranscriptListRow[];
    let rows = transcriptsState.data;
    // Always scope to accessible bots once we know who they are.
    if (agentsState.kind === "ok" && accessibleSchemaNames.size > 0) {
      rows = rows.filter((r) => r.botSchemaName !== null && accessibleSchemaNames.has(r.botSchemaName));
    }
    // Further narrow by selected agent (schema name).
    if (selectedSchemaName) {
      rows = rows.filter((r) => r.botSchemaName === selectedSchemaName);
    }
    return rows;
  }, [transcriptsState, agentsState, accessibleSchemaNames, selectedSchemaName]);

  const hiddenByAccessCount = useMemo(() => {
    if (transcriptsState.kind !== "ok" || agentsState.kind !== "ok") return 0;
    return transcriptsState.data.length - transcriptsState.data.filter((r) => r.botSchemaName !== null && accessibleSchemaNames.has(r.botSchemaName)).length;
  }, [transcriptsState, agentsState, accessibleSchemaNames]);

  const openTranscript = async (id: string) => {
    if (!selectedEnv) return;
    setOpenTranscriptId(id);
    setOpenTranscriptState({ kind: "loading" });
    try {
      const token = await getEnvToken(selectedEnv.apiUrl);
      const record = await fetchTranscriptRecord(selectedEnv.apiUrl, token, id);
      const parsed = parseTranscript(record);
      setOpenTranscriptState({ kind: "ok", data: parsed });
    } catch (e) {
      const msg = e instanceof WebApiError ? e.message : (e as Error).message ?? String(e);
      setOpenTranscriptState({ kind: "error", message: msg });
    }
  };

  const closeTranscript = () => {
    setOpenTranscriptId(null);
    setOpenTranscriptState({ kind: "idle" });
  };

  // === Detail view ===
  if (openTranscriptId) {
    return (
      <div className="me-workspace">
        {openTranscriptState.kind === "loading" && (
          <div className="me-card"><div className="me-sub">Loading transcript…</div></div>
        )}
        {openTranscriptState.kind === "error" && (
          <div className="me-card error">
            <strong>Error loading transcript:</strong> {openTranscriptState.message}
            <div><button className="me-btn ghost" onClick={closeTranscript}>Back</button></div>
          </div>
        )}
        {openTranscriptState.kind === "ok" && (
          <TranscriptDetail
            transcript={openTranscriptState.data}
            onBack={closeTranscript}
            allLoadedTranscripts={[]}
          />
        )}
      </div>
    );
  }

  // === List view ===
  return (
    <div className="me-workspace">
      <section className="me-card">
        <h3>Environment</h3>
        <div className="me-field">
          <input
            type="text"
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            placeholder="Filter environments…"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className="me-field">
          <select
            value={selectedEnvUrl}
            onChange={(e) => onSelectEnv(e.target.value)}
          >
            <option value="">— Pick an environment —</option>
            {filteredEnvs.map((env) => (
              <option key={env.apiUrl} value={env.apiUrl}>
                {env.friendlyName} ({env.region})
              </option>
            ))}
          </select>
        </div>
        <div className="me-summary">
          {filteredEnvs.length} of {envs.length} environment{envs.length === 1 ? "" : "s"}
          {selectedEnv && (<> · Selected: <strong>{selectedEnv.friendlyName}</strong></>)}
        </div>
      </section>

      {selectedEnv && (
        <>
          <section className="me-card">
            <h3>Agent</h3>
            {agentsState.kind === "loading" && <div className="me-sub">Loading agents…</div>}
            {agentsState.kind === "error" && (
              <div className="me-error-inline"><strong>Couldn&apos;t load agents:</strong> {agentsState.message}</div>
            )}
            {agentsState.kind === "ok" && (
              <>
                <div className="me-field">
                  <select value={selectedSchemaName} onChange={(e) => setSelectedSchemaName(e.target.value)}>
                    <option value="">All accessible agents</option>
                    {agentsState.data.map((a) => (
                      <option key={a.botid} value={a.schemaname ?? ""} disabled={!a.schemaname}>
                        {a.name ?? "(unnamed)"}{a.schemaname ? ` — ${a.schemaname}` : " (no schema)"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="me-summary">
                  {agentsState.data.length} agent{agentsState.data.length === 1 ? "" : "s"} you can access in this env. Transcripts are scoped to these agents (the conversationtranscript table is owned by a Microsoft service principal, so server-side row security doesn&apos;t enforce per-bot access).
                </div>
              </>
            )}
          </section>

          <section className="me-card">
            <h3>Transcripts</h3>
            <div className="me-field">
              <input
                type="text"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") setAppliedSearch(contentSearch); }}
                placeholder="Search content (press Enter)…"
                spellCheck={false}
                autoComplete="off"
              />
              <div className="me-actions" style={{ marginTop: "0.5rem" }}>
                <button className="me-btn" onClick={() => setAppliedSearch(contentSearch)}>Apply</button>
                {appliedSearch && (
                  <button className="me-btn ghost" onClick={() => { setContentSearch(""); setAppliedSearch(""); }}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            {transcriptsState.kind === "loading" && <div className="me-sub">Loading transcripts…</div>}
            {transcriptsState.kind === "error" && (
              <div className="me-error-inline"><strong>Couldn&apos;t load transcripts:</strong> {transcriptsState.message}</div>
            )}
            {transcriptsState.kind === "ok" && visibleTranscripts.length === 0 && (
              <div className="me-sub">
                {transcriptsState.data.length === 0
                  ? "No transcripts found."
                  : selectedSchemaName
                    ? "No transcripts in the loaded set match the selected agent."
                    : "No transcripts in the loaded set are tied to agents you have access to."}
              </div>
            )}
            {transcriptsState.kind === "ok" && visibleTranscripts.length > 0 && (
              <ul className="me-list">
                {visibleTranscripts.map((t) => {
                  const agent = agentsState.kind === "ok"
                    ? agentsState.data.find((a) => a.schemaname === t.botSchemaName)
                    : undefined;
                  return (
                    <li key={t.conversationtranscriptid}>
                      <button
                        className="me-link-row"
                        onClick={() => void openTranscript(t.conversationtranscriptid)}
                      >
                        <strong>{t.name ?? t.conversationtranscriptid.slice(0, 8)}</strong>
                        <span className="me-list-meta">
                          {agent?.name && <> · {agent.name}</>}
                          {!agent?.name && t.botSchemaName && <> · {t.botSchemaName}</>}
                          {t.conversationstarttime && <> · {new Date(t.conversationstarttime).toLocaleString()}</>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {transcriptsState.kind === "ok" && (
              <div className="me-summary">
                Showing {visibleTranscripts.length} of {transcriptsState.data.length} loaded
                {hiddenByAccessCount > 0 && (
                  <> · {hiddenByAccessCount} hidden (not your accessible agents)</>
                )}
              </div>
            )}
          </section>

          <section className="me-card">
            <p className="me-sub" style={{ margin: 0 }}>
              <strong>Preview note:</strong> Bot/user display names inside the transcript detail come from the default environment, so they may show as IDs when viewing transcripts from a different env. We&apos;ll wire up env-scoped lookups in a follow-up.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
