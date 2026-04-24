import { describe, it, expect } from "vitest";
import {
  buildAgentsFetchXml,
  buildTranscriptsFetchXml,
  parseDownstreamEnvelope,
  classifyDownstream,
  downstreamFlowError,
  extractFlowErrorDetails,
  FlowError,
} from "../components/BrowseFlows/flowHelpers";

describe("buildAgentsFetchXml", () => {
  it("emits a valid <fetch> with the requested top and bot attributes", () => {
    const xml = buildAgentsFetchXml(50);
    expect(xml).toContain('top="50"');
    expect(xml).toContain('<entity name="bot">');
    expect(xml).toContain('<attribute name="botid"/>');
    expect(xml).toContain('<attribute name="name"/>');
    expect(xml).toContain('<attribute name="schemaname"/>');
  });

  it("defaults top to 200", () => {
    expect(buildAgentsFetchXml()).toContain('top="200"');
  });
});

describe("buildTranscriptsFetchXml", () => {
  it("uses count + page (NOT top) — top + page mix returns Dataverse 0x80040203", () => {
    const xml = buildTranscriptsFetchXml({ pageSize: 50, pageNumber: 2 });
    expect(xml).toContain('count="50"');
    expect(xml).toContain('page="2"');
    expect(xml).not.toMatch(/<fetch[^>]*top=/);
  });

  it("defaults pageNumber to 1", () => {
    const xml = buildTranscriptsFetchXml({ pageSize: 25 });
    expect(xml).toContain('page="1"');
  });

  it("uses bot_conversationtranscriptid logical name (NOT _xxx_value) — guards Dataverse 0x80041103", () => {
    const xml = buildTranscriptsFetchXml({
      pageSize: 50,
      botId: "9dca6051-3b62-48b0-9d26-c6203d276ca3",
    });
    expect(xml).toContain('attribute="bot_conversationtranscriptid"');
    expect(xml).not.toContain("_bot_conversationtranscriptid_value");
    expect(xml).toContain('value="9dca6051-3b62-48b0-9d26-c6203d276ca3"');
  });

  it("strips non-GUID characters from botId before injecting (FetchXML injection guard)", () => {
    const xml = buildTranscriptsFetchXml({
      pageSize: 10,
      botId: 'abc-123"/><script>',
    });
    // The injected payload chars should be gone (script tag broken up,
    // closing-quote escape neutralized). Only [a-fA-F0-9-] survives in `value`.
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("script>");
    // The `value="..."` must contain only sanitized chars.
    const valueMatch = xml.match(/value="([^"]*)"/);
    expect(valueMatch).not.toBeNull();
    expect(valueMatch![1]).toMatch(/^[a-fA-F0-9-]+$/);
  });

  it("includes a paging-cookie attribute when supplied (XML-escaped)", () => {
    const xml = buildTranscriptsFetchXml({
      pageSize: 50,
      pageNumber: 3,
      pagingCookie: '<cookie pagenumber="2" />',
    });
    expect(xml).toContain("paging-cookie=");
    expect(xml).toContain("&lt;cookie");
    expect(xml).not.toContain('pagingCookie="<cookie');
  });

  it("includes date-range filters when provided", () => {
    const xml = buildTranscriptsFetchXml({
      pageSize: 50,
      dateFrom: "2026-01-01T00:00:00Z",
      dateTo: "2026-04-01T00:00:00Z",
    });
    expect(xml).toContain('attribute="createdon" operator="ge"');
    expect(xml).toContain('attribute="createdon" operator="le"');
  });

  it("XML-escapes content-search input (prevents FetchXML injection)", () => {
    const xml = buildTranscriptsFetchXml({
      pageSize: 50,
      contentSearch: '<script>"&\'',
    });
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&quot;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&apos;");
  });

  it("omits the <filter> block when no conditions are supplied", () => {
    const xml = buildTranscriptsFetchXml({ pageSize: 50 });
    expect(xml).not.toContain("<filter>");
  });

  it("orders by createdon descending", () => {
    const xml = buildTranscriptsFetchXml({ pageSize: 50 });
    expect(xml).toContain('<order attribute="createdon" descending="true"/>');
  });
});

describe("extractFlowErrorDetails", () => {
  it("returns null for non-error payloads", () => {
    expect(extractFlowErrorDetails(null)).toBeNull();
    expect(extractFlowErrorDetails(undefined)).toBeNull();
    expect(extractFlowErrorDetails({})).toBeNull();
    expect(extractFlowErrorDetails({ valuejson: "[]" })).toBeNull();
  });

  it("picks up the lowercased property name (errordetails)", () => {
    expect(extractFlowErrorDetails({ errordetails: "boom" })).toBe("boom");
  });

  it("picks up the camelCase property name (errorDetails)", () => {
    expect(extractFlowErrorDetails({ errorDetails: "boom" })).toBe("boom");
  });

  it("stringifies object errors", () => {
    const got = extractFlowErrorDetails({ errordetails: { foo: "bar" } });
    expect(got).toContain('"foo"');
    expect(got).toContain('"bar"');
  });

  it("returns null for empty-string error details", () => {
    expect(extractFlowErrorDetails({ errordetails: "   " })).toBeNull();
  });
});

describe("parseDownstreamEnvelope", () => {
  it("returns null when input is not a JSON object", () => {
    expect(parseDownstreamEnvelope("hello world")).toBeNull();
    expect(parseDownstreamEnvelope("[1,2,3]")).toBeNull();
    expect(parseDownstreamEnvelope("")).toBeNull();
  });

  it("extracts statusCode + inner error code/message from the canonical envelope", () => {
    const raw = JSON.stringify({
      statusCode: 400,
      headers: { foo: "bar" },
      body: {
        error: {
          code: "0x80041103",
          message:
            "'conversationtranscript' entity doesn't contain attribute with Name = '_bot_conversationtranscriptid_value'",
        },
      },
    });
    const got = parseDownstreamEnvelope(raw);
    expect(got).not.toBeNull();
    expect(got!.innerStatusCode).toBe(400);
    expect(got!.innerErrorCode).toBe("0x80041103");
    expect(got!.innerErrorMessage).toContain("doesn't contain attribute");
  });

  it("handles a double-encoded body (string-of-JSON)", () => {
    const raw = JSON.stringify({
      statusCode: 400,
      body: JSON.stringify({ error: { code: "0x80040203", message: "top + page conflict" } }),
    });
    const got = parseDownstreamEnvelope(raw);
    expect(got!.innerErrorCode).toBe("0x80040203");
    expect(got!.innerErrorMessage).toBe("top + page conflict");
  });

  it("returns null when neither statusCode nor inner error are present", () => {
    expect(parseDownstreamEnvelope(JSON.stringify({ foo: "bar" }))).toBeNull();
  });

  it("returns null on malformed JSON", () => {
    expect(parseDownstreamEnvelope("{not valid json")).toBeNull();
  });

  it("truncates raw at 800 chars", () => {
    const big = "x".repeat(2000);
    const raw = JSON.stringify({ statusCode: 500, body: { error: { code: "X", message: big } } });
    const got = parseDownstreamEnvelope(raw);
    expect(got!.raw!.length).toBeLessThanOrEqual(800);
  });
});

describe("classifyDownstream", () => {
  it("categorizes HTTP 401/403 as permission_denied", () => {
    expect(classifyDownstream({ innerStatusCode: 401 })).toBe("permission_denied");
    expect(classifyDownstream({ innerStatusCode: 403 })).toBe("permission_denied");
  });

  it("categorizes known Dataverse permission codes as permission_denied", () => {
    expect(classifyDownstream({ innerErrorCode: "0x80040220" })).toBe("permission_denied");
    expect(classifyDownstream({ innerErrorCode: "0x80048306" })).toBe("permission_denied");
    expect(classifyDownstream({ innerErrorCode: "0x8004f519" })).toBe("permission_denied");
  });

  it("categorizes by message keywords (privilege/forbidden/not authorized/no access)", () => {
    expect(
      classifyDownstream({ innerStatusCode: 400, innerErrorMessage: "Principal user lacks privilege" }),
    ).toBe("permission_denied");
    expect(
      classifyDownstream({ innerStatusCode: 400, innerErrorMessage: "User does not have access" }),
    ).toBe("permission_denied");
    expect(classifyDownstream({ innerErrorMessage: "Forbidden" })).toBe("permission_denied");
  });

  it("categorizes other 4xx as query_error (our bug)", () => {
    expect(classifyDownstream({ innerStatusCode: 400, innerErrorCode: "0x80041103" })).toBe(
      "query_error",
    );
    expect(classifyDownstream({ innerStatusCode: 404 })).toBe("query_error");
  });

  it("categorizes 5xx as downstream_other", () => {
    expect(classifyDownstream({ innerStatusCode: 500 })).toBe("downstream_other");
    expect(classifyDownstream({ innerStatusCode: 503 })).toBe("downstream_other");
  });

  it("falls back to downstream_other when status is unknown", () => {
    expect(classifyDownstream({})).toBe("downstream_other");
  });
});

describe("downstreamFlowError", () => {
  it("renders a friendly message for permission_denied (per resource)", () => {
    const raw = JSON.stringify({ statusCode: 403, body: { error: { code: "X", message: "nope" } } });
    const errA = downstreamFlowError(raw, "agents");
    expect(errA).toBeInstanceOf(FlowError);
    expect(errA.category).toBe("permission_denied");
    expect(errA.message).toBe("You don't have access to view agents in this environment.");

    const errT = downstreamFlowError(raw, "transcripts");
    expect(errT.message).toBe("You don't have access to view transcripts in this environment.");
  });

  it("renders a Bad query message including status + code + inner message for query_error", () => {
    const raw = JSON.stringify({
      statusCode: 400,
      body: {
        error: {
          code: "0x80041103",
          message: "entity doesn't contain attribute",
        },
      },
    });
    const err = downstreamFlowError(raw, "transcripts");
    expect(err.category).toBe("query_error");
    expect(err.message).toContain("Bad transcripts query");
    expect(err.message).toContain("400");
    expect(err.message).toContain("0x80041103");
    expect(err.message).toContain("entity doesn't contain attribute");
  });

  it("renders a Downstream message for 5xx (downstream_other)", () => {
    const raw = JSON.stringify({
      statusCode: 503,
      body: { error: { code: "0xDEAD", message: "service unavailable" } },
    });
    const err = downstreamFlowError(raw, "agents");
    expect(err.category).toBe("downstream_other");
    expect(err.message).toContain("Downstream");
    expect(err.message).toContain("503");
    expect(err.message).toContain("agents");
  });

  it("preserves the resource on details for UI consumption", () => {
    const raw = JSON.stringify({ statusCode: 400, body: { error: { code: "X", message: "y" } } });
    const err = downstreamFlowError(raw, "agents");
    expect(err.details.resource).toBe("agents");
    expect(err.details.innerStatusCode).toBe(400);
  });

  it("still produces a FlowError when the raw doesn't match the envelope shape", () => {
    const err = downstreamFlowError("just a plain string error", "transcripts");
    expect(err).toBeInstanceOf(FlowError);
    expect(err.details.raw).toContain("just a plain string error");
  });
});
