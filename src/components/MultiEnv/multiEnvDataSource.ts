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

/** Same shape as TranscriptListRow, plus the full record fields needed to feed
 *  parseTranscript so the multi-env path can reuse the full TranscriptList UI
 *  (which depends on parsed properties like turnCount, hasFeedback, etc.). */
export type TranscriptFullRow = TranscriptListRow & {
  content: string;
  metadata: string | undefined;
  schematype: string | undefined;
  schemaversion: string | undefined;
};

export type TranscriptPage = {
  rows: TranscriptFullRow[];
  /** OData `@odata.nextLink` (full URL) for the next page, or null when done. */
  nextLink: string | null;
};

export type AadUserRow = {
  aaduserid: string;
  /** AAD object id used in transcripts (the `id` column on aadusers). */
  objectId: string;
  displayname: string | null;
  mail: string | null;
  userprincipalname: string | null;
  givenname: string | null;
  surname: string | null;
  jobtitle: string | null;
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

function escapeOData(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s\-._@:]/g, "")
    .replace(/'/g, "''");
}

function sanitizeGuid(value: string): string {
  return value.replace(/[^a-fA-F0-9-]/g, "");
}

export type TranscriptPageOpts = {
  /** Server page size — also used to detect end-of-stream when no nextLink is returned. */
  pageSize?: number;
  /** ISO datetime string (yyyy-mm-dd or full ISO). Filters `conversationstarttime ge`. */
  dateFrom?: string;
  /** ISO datetime string. Filters `conversationstarttime le`. */
  dateTo?: string;
  /** Substring to match against the JSON `content` field. */
  contentSearch?: string;
  /** AAD object id of a participant — coarse pre-filter via contains(content,...). */
  participantAadId?: string;
  /** Server-supplied next-link URL. When set, all other filters are ignored
   *  (the URL already encodes the full query). */
  nextLink?: string;
};

export async function fetchTranscriptsPage(
  envApiUrl: string,
  token: string,
  opts: TranscriptPageOpts = {},
): Promise<TranscriptPage> {
  let url: string;
  const headers: HeadersInit = {
    ...authHeaders(token),
    Prefer: `odata.maxpagesize=${opts.pageSize ?? 25}`,
  };

  if (opts.nextLink) {
    url = opts.nextLink;
  } else {
    const clauses: string[] = [];
    if (opts.dateFrom) clauses.push(`conversationstarttime ge ${opts.dateFrom}`);
    if (opts.dateTo) clauses.push(`conversationstarttime le ${opts.dateTo}`);
    if (opts.contentSearch?.trim()) {
      const safe = escapeOData(opts.contentSearch.trim());
      if (safe) clauses.push(`contains(content,'${safe}')`);
    }
    if (opts.participantAadId?.trim()) {
      const safe = escapeOData(opts.participantAadId.trim());
      if (safe) clauses.push(`contains(content,'${safe}')`);
    }
    const filter = clauses.length > 0 ? `&$filter=${encodeURIComponent(clauses.join(" and "))}` : "";
    // We $select content + metadata so the FULL TranscriptList UI (which depends
    // on parseTranscript output) works against env-scoped data.
    url = `${baseUrl(envApiUrl)}/conversationtranscripts?$select=conversationtranscriptid,name,createdon,modifiedon,conversationstarttime,content,metadata,schematype,schemaversion&$orderby=conversationstarttime desc${filter}`;
  }

  const resp = await fetch(url, { headers });
  const text = await resp.text();
  if (!resp.ok) throw new WebApiError(resp.status, friendly(resp.status, text));
  const json = JSON.parse(text) as {
    value: Array<{
      conversationtranscriptid: string;
      name?: string;
      createdon?: string;
      modifiedon?: string;
      conversationstarttime?: string;
      content?: string;
      metadata?: string;
      schematype?: string;
      schemaversion?: string;
    }>;
    "@odata.nextLink"?: string;
  };

  const rows: TranscriptFullRow[] = json.value.map((t) => {
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
      modifiedon: t.modifiedon ?? null,
      conversationstarttime: t.conversationstarttime ?? null,
      botSchemaName,
      content: t.content ?? "",
      metadata: t.metadata,
      schematype: t.schematype,
      schemaversion: t.schemaversion,
    };
  });

  return { rows, nextLink: json["@odata.nextLink"] ?? null };
}

export async function searchAadUsers(
  envApiUrl: string,
  token: string,
  query: string,
): Promise<AadUserRow[]> {
  const safe = escapeOData(query);
  if (!safe) return [];
  const filter = [
    `contains(displayname,'${safe}')`,
    `contains(mail,'${safe}')`,
    `contains(userprincipalname,'${safe}')`,
  ].join(" or ");
  const url = `${baseUrl(envApiUrl)}/aadusers?$select=aaduserid,id,displayname,mail,userprincipalname,givenname,surname,jobtitle&$filter=${encodeURIComponent(filter)}&$top=10`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  const text = await resp.text();
  if (!resp.ok) throw new WebApiError(resp.status, friendly(resp.status, text));
  const json = JSON.parse(text) as {
    value: Array<{
      aaduserid?: string;
      id?: string;
      displayname?: string;
      mail?: string;
      userprincipalname?: string;
      givenname?: string;
      surname?: string;
      jobtitle?: string;
    }>;
  };
  return json.value.map((u) => ({
    aaduserid: u.aaduserid ?? "",
    objectId: u.id ?? u.aaduserid ?? "",
    displayname: u.displayname ?? null,
    mail: u.mail ?? null,
    userprincipalname: u.userprincipalname ?? null,
    givenname: u.givenname ?? null,
    surname: u.surname ?? null,
    jobtitle: u.jobtitle ?? null,
  }));
}

/** Look up a single aaduser by AAD object id (the `id` column).
 *  Returns null when not found (404 is treated as "no match"). */
export async function fetchAadUser(
  envApiUrl: string,
  token: string,
  aadObjectId: string,
): Promise<AadUserRow | null> {
  const safe = sanitizeGuid(aadObjectId);
  if (!safe) return null;
  const url = `${baseUrl(envApiUrl)}/aadusers?$select=aaduserid,id,displayname,mail,userprincipalname,givenname,surname,jobtitle&$filter=id eq '${safe}'&$top=1`;
  const resp = await fetch(url, { headers: authHeaders(token) });
  const text = await resp.text();
  if (!resp.ok) throw new WebApiError(resp.status, friendly(resp.status, text));
  const json = JSON.parse(text) as {
    value: Array<{
      aaduserid?: string;
      id?: string;
      displayname?: string;
      mail?: string;
      userprincipalname?: string;
      givenname?: string;
      surname?: string;
      jobtitle?: string;
    }>;
  };
  const u = json.value[0];
  if (!u) return null;
  return {
    aaduserid: u.aaduserid ?? "",
    objectId: u.id ?? u.aaduserid ?? "",
    displayname: u.displayname ?? null,
    mail: u.mail ?? null,
    userprincipalname: u.userprincipalname ?? null,
    givenname: u.givenname ?? null,
    surname: u.surname ?? null,
    jobtitle: u.jobtitle ?? null,
  };
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
