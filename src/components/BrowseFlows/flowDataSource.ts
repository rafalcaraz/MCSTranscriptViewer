// Flow-based data layer for the "Browse via Flows" workspace.
//
// Uses two Power Automate cloud flows (Get-Agents, Get-Transcripts) that wrap
// the Dataverse "List rows in environment" action with a FetchXML query.  This
// lets the app query any Dataverse environment the user's flow connection has
// access to — with no MSAL/AAD ceremony, which is required for deployed Code
// Apps where client-side MSAL tokens are unavailable.
//
// Why FetchXML instead of OData params?
// The connector maps to exactly two string inputs (envUrl + fetchXml). Passing
// null/undefined optional OData params through the connector is broken — they
// can cause incorrect query construction on the flow side.  FetchXML is a
// single self-contained string that is always safe to pass.

import { Get_AgentsService } from "../../generated/services/Get_AgentsService";
import { Get_TranscriptsService } from "../../generated/services/Get_TranscriptsService";
import type { DataverseTranscriptRecord } from "../../utils/parseTranscript";

// ── Error type ───────────────────────────────────────────────────────

export class FlowError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "FlowError";
    this.code = code;
  }
}

// ── Public data types ────────────────────────────────────────────────

export type RawAgent = {
  botid: string;
  name: string | null;
  schemaname: string | null;
};

export type TranscriptFetchOpts = {
  pageSize: number;
  botId?: string;
  dateFrom?: string;
  dateTo?: string;
  contentSearch?: string;
  /** Skipped in v1 — would require expensive LIKE scan on the content field.
   *  TODO: add a dedicated Get-TranscriptsByParticipant flow later. */
  participantAadId?: string;
  /** FetchXML page number (1-based). Incremented per loadMore call. */
  pageNumber?: number;
  /** Paging cookie returned by a previous Dataverse response, if available. */
  pagingCookie?: string;
};

export type TranscriptPageResult = {
  rows: DataverseTranscriptRecord[];
  /** Paging cookie from the Dataverse response, if surfaced by the flow. */
  pagingCookie: string;
  pageNumber: number;
  hasMore: boolean;
};

// ── FetchXML helpers ─────────────────────────────────────────────────

/** XML-escape user-controlled strings to prevent FetchXML injection. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Allow only hex characters and hyphens (GUID validation). */
function sanitizeGuid(value: string): string {
  return value.replace(/[^a-fA-F0-9-]/g, "");
}

function buildAgentsFetchXml(top = 200): string {
  return `<fetch top="${top}">
  <entity name="bot">
    <attribute name="botid"/>
    <attribute name="name"/>
    <attribute name="schemaname"/>
  </entity>
</fetch>`;
}

function buildTranscriptsFetchXml(opts: TranscriptFetchOpts): string {
  const pageNum = opts.pageNumber ?? 1;
  const cookieAttr = opts.pagingCookie
    ? ` paging-cookie="${xmlEscape(opts.pagingCookie)}"`
    : "";

  const conditions: string[] = [];

  if (opts.botId) {
    const safeId = sanitizeGuid(opts.botId);
    if (safeId) {
      conditions.push(
        `<condition attribute="_bot_conversationtranscriptid_value" operator="eq" value="${safeId}"/>`,
      );
    }
  }
  if (opts.dateFrom) {
    conditions.push(
      `<condition attribute="createdon" operator="ge" value="${xmlEscape(opts.dateFrom)}"/>`,
    );
  }
  if (opts.dateTo) {
    conditions.push(
      `<condition attribute="createdon" operator="le" value="${xmlEscape(opts.dateTo)}"/>`,
    );
  }
  if (opts.contentSearch?.trim()) {
    conditions.push(
      `<condition attribute="content" operator="like" value="%${xmlEscape(opts.contentSearch.trim())}%"/>`,
    );
  }
  // opts.participantAadId is intentionally skipped — see type declaration above.

  const filterBlock =
    conditions.length > 0
      ? `\n    <filter>\n      ${conditions.join("\n      ")}\n    </filter>`
      : "";

  return `<fetch top="${opts.pageSize}" page="${pageNum}"${cookieAttr}>
  <entity name="conversationtranscript">
    <attribute name="conversationtranscriptid"/>
    <attribute name="name"/>
    <attribute name="createdon"/>
    <attribute name="conversationstarttime"/>
    <attribute name="content"/>
    <attribute name="metadata"/>
    <attribute name="schematype"/>
    <attribute name="schemaversion"/>
    <attribute name="_bot_conversationtranscriptid_value"/>${filterBlock}
    <order attribute="createdon" descending="true"/>
  </entity>
</fetch>`;
}

// ── Error message helpers ────────────────────────────────────────────

/** Pull `errorDetails` from the flow response if the flow reported an
 *  in-flow failure (e.g. Dataverse 4xx surfaced via the flow's catch path).
 *  Returns null when no error is present. The field is typed loosely because
 *  the generated model may not include it until the user refreshes data sources. */
function extractFlowErrorDetails(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const ed = (data as Record<string, unknown>)["errorDetails"];
  if (typeof ed === "string") {
    const trimmed = ed.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (ed && typeof ed === "object") {
    try {
      return JSON.stringify(ed);
    } catch {
      return String(ed);
    }
  }
  return null;
}

function friendlyFlowError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("access token") || lower.includes("unauthorized") || lower.includes("401")) {
    return "Flow failed to acquire access token — re-authorize the Dataverse connection on the Get-Agents / Get-Transcripts flows in Power Automate.";
  }
  if (lower.includes("forbidden") || lower.includes("403")) {
    return "Forbidden (403) — your account lacks read permission on this table in the target environment.";
  }
  if (lower.includes("404")) {
    return "Not found (404) — the table may not exist in this environment.";
  }
  return raw.slice(0, 400);
}

// ── Public API ───────────────────────────────────────────────────────

export async function fetchAgentsViaFlow(
  envUrl: string,
  opts: { top?: number } = {},
): Promise<RawAgent[]> {
  const fetchXml = buildAgentsFetchXml(opts.top ?? 200);
  const result = await Get_AgentsService.Run({ text: envUrl, text_6: fetchXml });

  if (!result.success) {
    const msg = result.error?.message ?? "Get-Agents flow returned an error";
    throw new FlowError(friendlyFlowError(msg), "FLOW_ERROR");
  }

  const flowErr = extractFlowErrorDetails(result.data);
  if (flowErr) {
    throw new FlowError(friendlyFlowError(flowErr), "FLOW_ERROR_DETAILS");
  }

  const valuejson = result.data?.valuejson ?? "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(valuejson);
  } catch (e) {
    throw new FlowError(
      `Get-Agents returned invalid JSON: ${(e as Error).message}`,
      "PARSE_ERROR",
    );
  }

  const rows = Array.isArray(parsed) ? parsed : [];
  return (rows as Record<string, unknown>[]).map((r) => ({
    botid: (r["botid"] as string) ?? "",
    name: (r["name"] as string | null) ?? null,
    schemaname: (r["schemaname"] as string | null) ?? null,
  }));
}

export async function fetchTranscriptsPageViaFlow(
  envUrl: string,
  opts: TranscriptFetchOpts,
): Promise<TranscriptPageResult> {
  const fetchXml = buildTranscriptsFetchXml(opts);
  const result = await Get_TranscriptsService.Run({ text: envUrl, text_6: fetchXml });

  if (!result.success) {
    const msg = result.error?.message ?? "Get-Transcripts flow returned an error";
    throw new FlowError(friendlyFlowError(msg), "FLOW_ERROR");
  }

  const flowErr = extractFlowErrorDetails(result.data);
  if (flowErr) {
    throw new FlowError(friendlyFlowError(flowErr), "FLOW_ERROR_DETAILS");
  }

  const valuejson = result.data?.valuejson ?? "[]";
  const nextlink = result.data?.nextlink ?? "";
  const flowCount = result.data?.count ?? 0;

  let rawRows: Record<string, unknown>[] = [];
  let pagingCookie = "";

  try {
    const parsed = JSON.parse(valuejson);
    if (Array.isArray(parsed)) {
      rawRows = parsed as Record<string, unknown>[];
    } else if (parsed && typeof parsed === "object") {
      // Some flow configurations return the full OData envelope.
      // Extract the value array and the FetchXML paging cookie annotation.
      const envelope = parsed as Record<string, unknown>;
      const valueArr = envelope["value"];
      if (Array.isArray(valueArr)) rawRows = valueArr as Record<string, unknown>[];
      const cookie = envelope["@Microsoft.Dynamics.CRM.fetchxmlpagingcookie"];
      if (typeof cookie === "string") pagingCookie = cookie;
    }
  } catch (e) {
    throw new FlowError(
      `Get-Transcripts returned invalid JSON: ${(e as Error).message}`,
      "PARSE_ERROR",
    );
  }

  const rows: DataverseTranscriptRecord[] = rawRows.map((r) => ({
    conversationtranscriptid: (r["conversationtranscriptid"] as string) ?? "",
    name: (r["name"] as string | undefined) ?? undefined,
    createdon: (r["createdon"] as string | undefined) ?? undefined,
    conversationstarttime: (r["conversationstarttime"] as string) ?? "",
    content: (r["content"] as string) ?? "",
    metadata: (r["metadata"] as string | undefined) ?? undefined,
    schematype: (r["schematype"] as string | undefined) ?? undefined,
    schemaversion: (r["schemaversion"] as string | undefined) ?? undefined,
  }));

  // hasMore heuristic (v1):
  //   1. Explicit nextlink from flow → more available
  //   2. flow-returned count > rows loaded so far → more available
  //   3. rows.length >= pageSize → assume more (Dataverse paged out exactly one page)
  const hasMore =
    !!nextlink ||
    (flowCount > 0 && rows.length < flowCount) ||
    rows.length >= opts.pageSize;

  return {
    rows,
    pagingCookie,
    pageNumber: opts.pageNumber ?? 1,
    hasMore,
  };
}

/** Smoke-test the environment URL by fetching a single agent row.
 *  Returns { ok, agentCount, error? }. */
export async function validateEnvViaFlow(
  envUrl: string,
): Promise<{ ok: boolean; agentCount: number; error?: string }> {
  try {
    const agents = await fetchAgentsViaFlow(envUrl, { top: 1 });
    return { ok: true, agentCount: agents.length };
  } catch (e) {
    const msg =
      e instanceof FlowError ? e.message : e instanceof Error ? e.message : String(e);
    return { ok: false, agentCount: 0, error: msg };
  }
}
