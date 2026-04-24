// Flow-based data layer for the "Browse via Flows" workspace.
//
// Uses two Power Automate cloud flows (Get-Agents, Get-Transcripts) that wrap
// the Dataverse "List rows in environment" action with a FetchXML query.  This
// lets the app query any Dataverse environment the user's flow connection has
// access to — with no MSAL/AAD ceremony, which is required for deployed Code
// Apps where client-side MSAL tokens are unavailable.
//
// Pure helpers (FetchXML builders + error classification) live in
// `flowHelpers.ts` so they can be unit-tested without pulling in the Power
// Apps SDK at module load time.

import { Get_AgentsService } from "../../generated/services/Get_AgentsService";
import { Get_TranscriptsService } from "../../generated/services/Get_TranscriptsService";
import type { DataverseTranscriptRecord } from "../../utils/parseTranscript";
import {
  FlowError,
  buildAgentsFetchXml,
  buildTranscriptsFetchXml,
  downstreamFlowError,
  extractFlowErrorDetails,
  type FlowErrorCategory,
  type FlowErrorDetails,
  type RawAgent,
  type TranscriptFetchOpts,
  type TranscriptPageResult,
} from "./flowHelpers";

// Re-export the shared types/helpers so existing imports of these from
// `./flowDataSource` keep working.
export {
  FlowError,
  buildAgentsFetchXml,
  buildTranscriptsFetchXml,
  classifyDownstream,
  downstreamFlowError,
  extractFlowErrorDetails,
  friendlyFlowError,
  parseDownstreamEnvelope,
} from "./flowHelpers";
export type {
  FlowErrorCategory,
  FlowErrorDetails,
  FlowResource,
  RawAgent,
  TranscriptFetchOpts,
  TranscriptPageResult,
} from "./flowHelpers";

// ── Public API ───────────────────────────────────────────────────────

export async function fetchAgentsViaFlow(
  envUrl: string,
  opts: { top?: number } = {},
): Promise<RawAgent[]> {
  const fetchXml = buildAgentsFetchXml(opts.top ?? 200);
  const result = await Get_AgentsService.Run({ text: envUrl, text_6: fetchXml });

  if (!result.success) {
    const msg = result.error?.message ?? "Get-Agents flow returned an error";
    console.warn("[BrowseFlows] Get-Agents !success", { result });
    throw new FlowError(
      `Flow invocation failed: ${msg}`,
      "flow_failure",
      "FLOW_FAILURE",
      { resource: "agents", raw: JSON.stringify(result.error ?? result).slice(0, 800) },
    );
  }

  const flowErr = extractFlowErrorDetails(result.data);
  if (flowErr) {
    console.warn("[BrowseFlows] Get-Agents errordetails", { flowErr, data: result.data });
    throw downstreamFlowError(flowErr, "agents");
  }

  const valuejson = result.data?.valuejson ?? "[]";
  let parsed: unknown;
  try {
    parsed = JSON.parse(valuejson);
  } catch (e) {
    throw new FlowError(
      `Get-Agents returned invalid JSON in valuejson: ${(e as Error).message}`,
      "parse_error",
      "PARSE_ERROR",
      { resource: "agents", raw: valuejson.slice(0, 800) },
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
    console.warn("[BrowseFlows] Get-Transcripts !success", { result });
    throw new FlowError(
      `Flow invocation failed: ${msg}`,
      "flow_failure",
      "FLOW_FAILURE",
      { resource: "transcripts", raw: JSON.stringify(result.error ?? result).slice(0, 800) },
    );
  }

  const flowErr = extractFlowErrorDetails(result.data);
  if (flowErr) {
    console.warn("[BrowseFlows] Get-Transcripts errordetails", { flowErr, data: result.data });
    throw downstreamFlowError(flowErr, "transcripts");
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
      `Get-Transcripts returned invalid JSON in valuejson: ${(e as Error).message}`,
      "parse_error",
      "PARSE_ERROR",
      { resource: "transcripts", raw: valuejson.slice(0, 800) },
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
 *  Returns the agent count on success, or a structured FlowError on failure
 *  (so the UI can render category-specific messaging). */
export type ValidateResult =
  | { ok: true; agentCount: number }
  | {
      ok: false;
      category: FlowErrorCategory;
      message: string;
      details: FlowErrorDetails;
    };

export async function validateEnvViaFlow(envUrl: string): Promise<ValidateResult> {
  try {
    const agents = await fetchAgentsViaFlow(envUrl, { top: 1 });
    return { ok: true, agentCount: agents.length };
  } catch (e) {
    if (e instanceof FlowError) {
      return { ok: false, category: e.category, message: e.message, details: e.details };
    }
    // Unknown JS-level exception — treat as flow_failure (transport error).
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      category: "flow_failure",
      message: `Unexpected error: ${msg}`,
      details: { raw: msg },
    };
  }
}
