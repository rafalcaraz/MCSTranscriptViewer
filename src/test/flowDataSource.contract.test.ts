// Contract tests for flowDataSource.ts — verifies our consumers correctly
// handle the actual response envelope produced by the Get-Agents and
// Get-Transcripts flows.
//
// Ground truth: solution/src/Workflows/Get-Agents-*.json &
//                solution/src/Workflows/Get-Transcripts-*.json
//
// Both flows return the same envelope (Respond_to_a_Power_App_or_flow):
//   {
//     valuejson:    "@if(equals(errorDetails,''), string(rows.value), '')"
//     nextlink:     "@if(equals(errorDetails,''), coalesce(@odata.nextLink,''),'')"
//     count:        "@if(equals(errorDetails,''), length(rows.value), -1)"
//     errordetails: "@variables('errorDetails')"  // empty string on success
//   }
//
// All four fields collapse to "empty/sentinel" values when errorDetails is
// non-empty. Tests below verify both halves of that contract.

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the generated Power Apps services BEFORE importing the module under test.
// vi.mock is hoisted to the top of the file, so any state it references must be
// defined via vi.hoisted() (which hoists alongside it).
const { agentsRunMock, transcriptsRunMock } = vi.hoisted(() => ({
  agentsRunMock: vi.fn(),
  transcriptsRunMock: vi.fn(),
}));

vi.mock("../generated/services/Get_AgentsService", () => ({
  Get_AgentsService: { Run: agentsRunMock },
}));
vi.mock("../generated/services/Get_TranscriptsService", () => ({
  Get_TranscriptsService: { Run: transcriptsRunMock },
}));

// Now safe to import (services are stubbed).
import {
  fetchAgentsViaFlow,
  fetchTranscriptsPageViaFlow,
  validateEnvViaFlow,
  FlowError,
} from "../components/BrowseFlows/flowDataSource";

const ENV = "https://orgname.crm.dynamics.com";

// Helper: build a successful flow envelope (matches the cloud contract).
function ok<T extends Record<string, unknown>>(rows: T[], extras: Partial<{ nextlink: string; count: number }> = {}) {
  return {
    success: true as const,
    data: {
      valuejson: JSON.stringify(rows),
      nextlink: extras.nextlink ?? "",
      count: extras.count ?? rows.length,
      errordetails: "",
    },
  };
}

// Helper: build the error sentinel envelope per the flow's if(equals(...)) contract.
function flowErr(details: string) {
  return {
    success: true as const,
    data: {
      valuejson: "",
      nextlink: "",
      count: -1,
      errordetails: details,
    },
  };
}

// Helper: SDK-level transport failure (no envelope).
function transportFail(message = "network down") {
  return { success: false as const, error: { message } };
}

beforeEach(() => {
  agentsRunMock.mockReset();
  transcriptsRunMock.mockReset();
});

describe("fetchAgentsViaFlow — success path", () => {
  it("passes envUrl as `text` and FetchXML as `text_6` (flow trigger contract)", async () => {
    agentsRunMock.mockResolvedValueOnce(ok([{ botid: "b1", name: "Bot 1", schemaname: "bot1" }]));
    await fetchAgentsViaFlow(ENV, { top: 25 });

    expect(agentsRunMock).toHaveBeenCalledTimes(1);
    const arg = agentsRunMock.mock.calls[0][0];
    expect(arg.text).toBe(ENV);
    expect(typeof arg.text_6).toBe("string");
    expect(arg.text_6).toContain('top="25"');
    expect(arg.text_6).toContain("<entity name=\"bot\">");
  });

  it("parses valuejson (a STRING, not object) into RawAgent[]", async () => {
    agentsRunMock.mockResolvedValueOnce(
      ok([
        { botid: "b1", name: "Alpha", schemaname: "alpha" },
        { botid: "b2", name: null, schemaname: "beta" },
      ]),
    );
    const agents = await fetchAgentsViaFlow(ENV);
    expect(agents).toHaveLength(2);
    expect(agents[0]).toEqual({ botid: "b1", name: "Alpha", schemaname: "alpha" });
    expect(agents[1].name).toBeNull();
  });

  it("treats missing valuejson as empty list (defensive default)", async () => {
    agentsRunMock.mockResolvedValueOnce({ success: true, data: { errordetails: "" } });
    const agents = await fetchAgentsViaFlow(ENV);
    expect(agents).toEqual([]);
  });
});

describe("fetchAgentsViaFlow — error contracts", () => {
  it("throws FlowError when the flow returns the error sentinel (count=-1, errordetails set)", async () => {
    agentsRunMock.mockResolvedValueOnce(flowErr("Dataverse: principal user lacks privilege"));
    await expect(fetchAgentsViaFlow(ENV)).rejects.toBeInstanceOf(FlowError);
  });

  it("classifies a 403 envelope inside errordetails as permission_denied", async () => {
    const downstream = JSON.stringify({
      statusCode: 403,
      body: { error: { code: "0x80040220", message: "principal lacks privilege" } },
    });
    agentsRunMock.mockResolvedValueOnce(flowErr(downstream));

    try {
      await fetchAgentsViaFlow(ENV);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(FlowError);
      const fe = e as FlowError;
      expect(fe.category).toBe("permission_denied");
      expect(fe.message).toBe("You don't have access to view agents in this environment.");
      expect(fe.details.resource).toBe("agents");
    }
  });

  it("throws FlowError on SDK transport failure (!success)", async () => {
    agentsRunMock.mockResolvedValueOnce(transportFail("connection refused"));
    try {
      await fetchAgentsViaFlow(ENV);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(FlowError);
      const fe = e as FlowError;
      expect(fe.category).toBe("flow_failure");
      expect(fe.message).toContain("connection refused");
    }
  });

  it("throws PARSE_ERROR FlowError when valuejson is not valid JSON", async () => {
    agentsRunMock.mockResolvedValueOnce({
      success: true,
      data: { valuejson: "{not json", count: 0, errordetails: "" },
    });
    try {
      await fetchAgentsViaFlow(ENV);
      throw new Error("expected throw");
    } catch (e) {
      const fe = e as FlowError;
      expect(fe.category).toBe("parse_error");
      expect(fe.code).toBe("PARSE_ERROR");
    }
  });
});

describe("fetchTranscriptsPageViaFlow — value envelope variants", () => {
  it("handles valuejson as a stringified ARRAY (canonical Get-Transcripts shape)", async () => {
    transcriptsRunMock.mockResolvedValueOnce(
      ok(
        [
          {
            conversationtranscriptid: "t1",
            content: "{}",
            conversationstarttime: "2026-01-01T00:00:00Z",
          },
        ],
        { nextlink: "", count: 1 },
      ),
    );
    const page = await fetchTranscriptsPageViaFlow(ENV, { pageSize: 50 });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].conversationtranscriptid).toBe("t1");
    expect(page.pagingCookie).toBe("");
    expect(page.hasMore).toBe(false);
  });

  it("handles valuejson as a stringified ODATA ENVELOPE (alternate flow output config)", async () => {
    const envelope = {
      value: [
        {
          conversationtranscriptid: "t9",
          content: "{}",
          conversationstarttime: "2026-01-01T00:00:00Z",
        },
      ],
      "@Microsoft.Dynamics.CRM.fetchxmlpagingcookie":
        '<cookie pagenumber="2" pagingcookie="abc"/>',
    };
    transcriptsRunMock.mockResolvedValueOnce({
      success: true,
      data: {
        valuejson: JSON.stringify(envelope),
        nextlink: "",
        count: 1,
        errordetails: "",
      },
    });
    const page = await fetchTranscriptsPageViaFlow(ENV, { pageSize: 50 });
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0].conversationtranscriptid).toBe("t9");
    expect(page.pagingCookie).toContain("pagenumber");
  });

  it("hasMore is true when nextlink is non-empty", async () => {
    transcriptsRunMock.mockResolvedValueOnce(
      ok(
        [{ conversationtranscriptid: "t1", content: "{}", conversationstarttime: "x" }],
        { nextlink: "https://...next", count: 1 },
      ),
    );
    const page = await fetchTranscriptsPageViaFlow(ENV, { pageSize: 50 });
    expect(page.hasMore).toBe(true);
  });

  it("hasMore is true when row count == pageSize (assume more)", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      conversationtranscriptid: `t${i}`,
      content: "{}",
      conversationstarttime: "x",
    }));
    transcriptsRunMock.mockResolvedValueOnce(ok(rows, { nextlink: "", count: 50 }));
    const page = await fetchTranscriptsPageViaFlow(ENV, { pageSize: 50 });
    expect(page.hasMore).toBe(true);
  });

  it("propagates resource='transcripts' on FlowError details", async () => {
    agentsRunMock.mockResolvedValueOnce(flowErr("boom")); // wrong service to prove isolation
    transcriptsRunMock.mockResolvedValueOnce(
      flowErr(
        JSON.stringify({
          statusCode: 400,
          body: { error: { code: "0x80041103", message: "bad attribute" } },
        }),
      ),
    );
    try {
      await fetchTranscriptsPageViaFlow(ENV, { pageSize: 50 });
      throw new Error("expected throw");
    } catch (e) {
      const fe = e as FlowError;
      expect(fe.details.resource).toBe("transcripts");
      expect(fe.category).toBe("query_error");
    }
  });
});

describe("validateEnvViaFlow", () => {
  it("returns ok=true with agentCount on success", async () => {
    agentsRunMock.mockResolvedValueOnce(
      ok([{ botid: "b1", name: "Bot 1", schemaname: "bot1" }], { count: 1 }),
    );
    const r = await validateEnvViaFlow(ENV);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.agentCount).toBe(1);
  });

  it("requests top:1 (cheap probe) — verified by FetchXML in trigger args", async () => {
    agentsRunMock.mockResolvedValueOnce(ok([], { count: 0 }));
    await validateEnvViaFlow(ENV);
    expect(agentsRunMock.mock.calls[0][0].text_6).toContain('top="1"');
  });

  it("returns ok=false with category + message on permission_denied", async () => {
    agentsRunMock.mockResolvedValueOnce(
      flowErr(
        JSON.stringify({
          statusCode: 403,
          body: { error: { code: "0x80040220", message: "lacks privilege" } },
        }),
      ),
    );
    const r = await validateEnvViaFlow(ENV);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.category).toBe("permission_denied");
      expect(r.message).toContain("don't have access");
    }
  });

  it("returns ok=false flow_failure on transport error", async () => {
    agentsRunMock.mockResolvedValueOnce(transportFail("ECONNRESET"));
    const r = await validateEnvViaFlow(ENV);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.category).toBe("flow_failure");
  });
});
