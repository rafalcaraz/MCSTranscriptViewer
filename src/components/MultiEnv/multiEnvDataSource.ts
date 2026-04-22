// Direct Dataverse Web API client for an arbitrary environment.
// Used by the Multi-Env tab — independent from the Code App SDK so we can
// query environments other than the one the app was published against.

import type { DataverseTranscriptRecord } from "../../utils/parseTranscript";

export type AgentRow = {
  botid: string;
  name: string | null;
  schemaname: string | null;
};

export type TranscriptListRow = {
  conversationtranscriptid: string;
  name: string | null;
  createdon: string | null;
  conversationstarttime: string | null;
  modifiedon: string | null;
  /** Schema name of the bot, parsed from the small `metadata` JSON.
   *  Required for client-side scoping because the `_bot_conversationtranscriptid_value`
   *  lookup field on the table does NOT match `botid` from /bots — see KNOWLEDGE.md. */
  botSchemaName: string | null;
};

export class WebApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "WebApiError";
  }
}

function friendly(statusCode: number, body: string): string {
  if (statusCode === 401) return "Unauthorized (401). The token was rejected for this environment.";
  if (statusCode === 403) return "Forbidden (403). Your account doesn't have privileges to read this table in this environment.";
  if (statusCode === 404) return "Not found (404). The table may not exist in this environment.";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) return `${statusCode}: ${parsed.error.message}`;
  } catch { /* ignore */ }
  return `${statusCode}: ${body.slice(0, 300) || "(no body)"}`;
}

function baseUrl(envApiUrl: string): string {
  return `${envApiUrl.replace(/\/$/, "")}/api/data/v9.2`;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "OData-Version": "4.0",
    "OData-MaxVersion": "4.0",
  };
}

export async function fetchAgents(envApiUrl: string, token: string): Promise<AgentRow[]> {
  const url = `${baseUrl(envApiUrl)}/bots?$select=botid,name,schemaname&$orderby=name asc&$top=200`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  const text = await resp.text();
  if (!resp.ok) throw new WebApiError(resp.status, friendly(resp.status, text));
  const json = JSON.parse(text) as { value: Array<{ botid: string; name?: string; schemaname?: string }> };
  return json.value.map((b) => ({
    botid: b.botid,
    name: b.name ?? null,
    schemaname: b.schemaname ?? null,
  }));
}

export async function fetchTranscriptList(
  envApiUrl: string,
  token: string,
  opts: { top?: number; contentSearch?: string } = {},
): Promise<TranscriptListRow[]> {
  const top = opts.top ?? 50;
  const clauses: string[] = [];
  // NOTE: We deliberately do NOT filter by bot at the server level.
  // The `_bot_conversationtranscriptid_value` lookup on conversationtranscript
  // does not reliably point at the right bot record (see KNOWLEDGE.md). Instead
  // we $select the small `metadata` JSON and filter client-side by schema name.
  if (opts.contentSearch?.trim()) {
    const safe = opts.contentSearch.trim()
      .replace(/[^a-zA-Z0-9\s\-._@:]/g, "")
      .replace(/'/g, "''");
    if (safe) clauses.push(`contains(content,'${safe}')`);
  }
  const filter = clauses.length > 0 ? `&$filter=${encodeURIComponent(clauses.join(" and "))}` : "";
  const url = `${baseUrl(envApiUrl)}/conversationtranscripts?$select=conversationtranscriptid,name,createdon,conversationstarttime,modifiedon,metadata&$orderby=conversationstarttime desc&$top=${top}${filter}`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  const text = await resp.text();
  if (!resp.ok) throw new WebApiError(resp.status, friendly(resp.status, text));
  const json = JSON.parse(text) as {
    value: Array<{
      conversationtranscriptid: string;
      name?: string;
      createdon?: string;
      conversationstarttime?: string;
      modifiedon?: string;
      metadata?: string;
    }>;
  };
  return json.value.map((t) => {
    let botSchemaName: string | null = null;
    if (t.metadata) {
      try {
        const m = JSON.parse(t.metadata) as { BotName?: string };
        if (m.BotName) botSchemaName = m.BotName;
      } catch { /* metadata not JSON — leave null */ }
    }
    return {
      conversationtranscriptid: t.conversationtranscriptid,
      name: t.name ?? null,
      createdon: t.createdon ?? null,
      conversationstarttime: t.conversationstarttime ?? null,
      modifiedon: t.modifiedon ?? null,
      botSchemaName,
    };
  });
}

export async function fetchTranscriptRecord(
  envApiUrl: string,
  token: string,
  transcriptId: string,
): Promise<DataverseTranscriptRecord> {
  const url = `${baseUrl(envApiUrl)}/conversationtranscripts(${transcriptId})?$select=conversationtranscriptid,name,createdon,conversationstarttime,content,metadata,schematype,schemaversion`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  const text = await resp.text();
  if (!resp.ok) throw new WebApiError(resp.status, friendly(resp.status, text));
  const json = JSON.parse(text) as {
    conversationtranscriptid: string;
    name?: string;
    createdon?: string;
    conversationstarttime?: string;
    content?: string;
    metadata?: string;
    schematype?: string;
    schemaversion?: string;
  };
  return {
    conversationtranscriptid: json.conversationtranscriptid,
    name: json.name,
    createdon: json.createdon,
    conversationstarttime: json.conversationstarttime ?? "",
    content: json.content ?? "",
    metadata: json.metadata,
    schematype: json.schematype,
    schemaversion: json.schemaversion,
  };
}
