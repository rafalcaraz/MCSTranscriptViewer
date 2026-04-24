// Pure helpers + types for the Browse via Flows data layer.
//
// Split out from `flowDataSource.ts` so unit tests can import these without
// transitively pulling in the Power Apps SDK (which has node-resolution
// quirks that break vitest at module-load time).

import type { DataverseTranscriptRecord } from "../../utils/parseTranscript";

// ── Error type ───────────────────────────────────────────────────────

/**
 * Failure categories surfaced to the UI as distinct banners.
 *
 *   flow_failure       — the flow itself never ran successfully (gateway
 *                        rejected, transport error, no response, MSAL/auth
 *                        problem on the flow connection). User must FIX THE
 *                        FLOW or its connection.
 *   permission_denied  — flow ran, downstream returned 401/403 or a Dataverse
 *                        privilege-denied error. User just lacks access to
 *                        this table in the target environment.
 *   query_error        — flow ran, downstream returned any *other* 4xx
 *                        (typically Dataverse 400 from a malformed FetchXML).
 *                        This is OUR bug in query construction — escalate.
 *   downstream_other   — flow ran, downstream returned 5xx or an unrecognized
 *                        error shape we couldn't classify.
 *   parse_error        — flow returned 200 with a successful body, but we
 *                        couldn't parse `valuejson` as JSON (output schema
 *                        drift?).
 */
export type FlowErrorCategory =
  | "flow_failure"
  | "permission_denied"
  | "query_error"
  | "downstream_other"
  | "parse_error";

/** Which underlying resource the failing flow was reading. Used to render
 *  resource-specific user-facing messages ("agents" vs "transcripts"). */
export type FlowResource = "agents" | "transcripts";

export type FlowErrorDetails = {
  /** Which resource was being fetched when this failed. */
  resource?: FlowResource;
  /** HTTP status from the inner downstream call (e.g. Dataverse), if known. */
  innerStatusCode?: number;
  /** Downstream error code (e.g. Dataverse "0x80040203"), if known. */
  innerErrorCode?: string;
  /** Downstream human-readable error message, if known. */
  innerErrorMessage?: string;
  /** Original raw payload (truncated) for debugging. */
  raw?: string;
};

export class FlowError extends Error {
  code?: string;
  category: FlowErrorCategory;
  details: FlowErrorDetails;
  constructor(
    message: string,
    category: FlowErrorCategory,
    code?: string,
    details: FlowErrorDetails = {},
  ) {
    super(message);
    this.name = "FlowError";
    this.code = code;
    this.category = category;
    this.details = details;
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

export function buildAgentsFetchXml(top = 200): string {
  return `<fetch top="${top}">
  <entity name="bot">
    <attribute name="botid"/>
    <attribute name="name"/>
    <attribute name="schemaname"/>
  </entity>
</fetch>`;
}

export function buildTranscriptsFetchXml(opts: TranscriptFetchOpts): string {
  const pageNum = opts.pageNumber ?? 1;
  const cookieAttr = opts.pagingCookie
    ? ` paging-cookie="${xmlEscape(opts.pagingCookie)}"`
    : "";

  const conditions: string[] = [];

  if (opts.botId) {
    const safeId = sanitizeGuid(opts.botId);
    if (safeId) {
      // FetchXML uses the lookup attribute's logical name (`bot_conversationtranscriptid`).
      // The `_xxx_value` form is OData-only and rejected by FetchXML
      // (Dataverse 0x80041103 "entity doesn't contain attribute").
      conditions.push(
        `<condition attribute="bot_conversationtranscriptid" operator="eq" value="${safeId}"/>`,
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

  // FetchXML: `top` and `page` are mutually exclusive. When using `page`
  // (which we always do, to support pagination), the per-page row limit must
  // be expressed as `count`, not `top`. Mixing them returns Dataverse error
  // 0x80040203: "The top attribute can't be specified with paging attribute page".
  return `<fetch count="${opts.pageSize}" page="${pageNum}"${cookieAttr}>
  <entity name="conversationtranscript">
    <attribute name="conversationtranscriptid"/>
    <attribute name="name"/>
    <attribute name="createdon"/>
    <attribute name="conversationstarttime"/>
    <attribute name="content"/>
    <attribute name="metadata"/>
    <attribute name="schematype"/>
    <attribute name="schemaversion"/>
    <attribute name="bot_conversationtranscriptid"/>${filterBlock}
    <order attribute="createdon" descending="true"/>
  </entity>
</fetch>`;
}

// ── Error message helpers ────────────────────────────────────────────

/** Pull `errorDetails` from the flow response if the flow reported an
 *  in-flow failure (e.g. Dataverse 4xx surfaced via the flow's catch path).
 *  Returns null when no error is present. The field is typed loosely because
 *  the generated model may not include it until the user refreshes data sources. */
export function extractFlowErrorDetails(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  // Power Automate may lowercase the property name (`errordetails`) or
  // preserve camelCase (`errorDetails`) depending on flow definition.
  const ed = rec["errordetails"] ?? rec["errorDetails"];
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

export function friendlyFlowError(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  // Only fire auth-specific mapper when we see *strong* auth signals, not a
  // stray "access token" mention (which some success payloads include).
  if (
    lower.includes("failed to acquire access token") ||
    lower.includes("unauthorized") ||
    lower.includes('"code":401') ||
    lower.includes("code: 401") ||
    lower.includes(" 401 ")
  ) {
    return `Flow failed to acquire access token — re-authorize the Dataverse connection on the Get-Agents / Get-Transcripts flows. (raw: ${trimmed.slice(0, 300)})`;
  }
  if (lower.includes("forbidden") || lower.includes('"code":403')) {
    return `Forbidden (403) — your account lacks read permission on this table in the target environment. (raw: ${trimmed.slice(0, 300)})`;
  }
  if (lower.includes('"code":404')) {
    return `Not found (404) — the table may not exist in this environment. (raw: ${trimmed.slice(0, 300)})`;
  }
  return trimmed.slice(0, 600);
}

/** Try to parse the {statusCode, headers, body:{error:{code,message}}} envelope
 *  that Power Automate stuffs into `errordetails` when its inner Dataverse
 *  call returns a 4xx. Returns null if the input doesn't match that shape. */
export function parseDownstreamEnvelope(raw: string): FlowErrorDetails | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const env = JSON.parse(trimmed) as {
      statusCode?: number;
      body?: { error?: { code?: string; message?: string } } | string;
    };
    let body = env.body;
    if (typeof body === "string") {
      // Some shapes double-encode body.
      try {
        body = JSON.parse(body) as { error?: { code?: string; message?: string } };
      } catch {
        body = undefined;
      }
    }
    const innerErr = body && typeof body === "object" ? body.error : undefined;
    if (env.statusCode == null && !innerErr) return null;
    return {
      innerStatusCode: env.statusCode,
      innerErrorCode: innerErr?.code,
      innerErrorMessage: innerErr?.message,
      raw: trimmed.slice(0, 800),
    };
  } catch {
    return null;
  }
}

/** Dataverse error codes that indicate a privilege / access failure
 *  (the caller's identity lacks rights on the table, not a bad query). */
const DATAVERSE_PERMISSION_CODES = new Set([
  "0x80040220", // PrivilegeDenied (SecLib::AccessCheckEx)
  "0x80048306", // CrmSecurityError
  "0x80040265", // PrivilegeCreateIsDisabledForOrganization-style perms
  "0x8004f519", // PrincipalPrivilegeDenied
]);

function isPermissionDenied(details: FlowErrorDetails): boolean {
  if (details.innerStatusCode === 401 || details.innerStatusCode === 403) return true;
  if (
    details.innerErrorCode &&
    DATAVERSE_PERMISSION_CODES.has(details.innerErrorCode.toLowerCase())
  ) {
    return true;
  }
  const msg = details.innerErrorMessage?.toLowerCase() ?? "";
  if (
    msg.includes("privilege") ||
    msg.includes("not authorized") ||
    msg.includes("does not have access") ||
    msg.includes("forbidden")
  ) {
    return true;
  }
  return false;
}

export function classifyDownstream(details: FlowErrorDetails): FlowErrorCategory {
  if (isPermissionDenied(details)) return "permission_denied";
  const status = details.innerStatusCode;
  if (status != null && status >= 400 && status < 500) return "query_error";
  return "downstream_other";
}

function resourceLabel(resource: FlowResource | undefined): string {
  if (resource === "agents") return "agents";
  if (resource === "transcripts") return "transcripts";
  return "data";
}

/** Build a FlowError for a downstream (errordetails) failure with a
 *  user-facing message and full structured details. */
export function downstreamFlowError(
  rawErrorDetails: string,
  resource: FlowResource,
): FlowError {
  const parsed = parseDownstreamEnvelope(rawErrorDetails) ?? {
    raw: rawErrorDetails.slice(0, 800),
  };
  const details: FlowErrorDetails = { ...parsed, resource };
  const category = classifyDownstream(details);
  const label = resourceLabel(resource);

  let message: string;
  switch (category) {
    case "permission_denied":
      message = `You don't have access to view ${label} in this environment.`;
      break;
    case "query_error": {
      const status = details.innerStatusCode ? `${details.innerStatusCode} ` : "";
      const codePart = details.innerErrorCode ? ` [${details.innerErrorCode}]` : "";
      const inner = details.innerErrorMessage ?? "(no message)";
      message = `Bad ${label} query (${status}error${codePart}): ${inner}`;
      break;
    }
    default: {
      const status = details.innerStatusCode ? `${details.innerStatusCode} ` : "";
      const codePart = details.innerErrorCode ? ` [${details.innerErrorCode}]` : "";
      const inner = details.innerErrorMessage ?? friendlyFlowError(rawErrorDetails);
      message = `Downstream ${status}error${codePart} fetching ${label}: ${inner}`;
    }
  }

  return new FlowError(message, category, category.toUpperCase(), details);
}
