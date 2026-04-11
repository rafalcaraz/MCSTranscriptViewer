import { describe, it, expect } from "vitest";
import { parseTranscript, formatTimestamp, formatDuration, shortToolName } from "../utils/parseTranscript";
import {
  basicMcpTranscript,
  pvaStudioReactionsTranscript,
  teamsReactionsTranscript,
  knowledgeTranscript,
  advancedEventsTranscript,
  adaptiveCardTranscript,
  noUserMessagesTranscript,
} from "./fixtures/transcripts";

// ── Basic Parsing ─────────────────────────────────────────────────────

describe("parseTranscript — basic", () => {
  it("parses metadata correctly", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.metadata.botName).toBe("msftcsa_testbot");
    expect(result.metadata.botId).toBe("036e624a-test");
    expect(result.metadata.aadTenantId).toBe("tenant-test");
  });

  it("extracts messages with correct roles", () => {
    const result = parseTranscript(basicMcpTranscript);
    const userMsgs = result.messages.filter((m) => m.role === "user");
    const botMsgs = result.messages.filter((m) => m.role === "bot");
    expect(userMsgs.length).toBe(1);
    expect(botMsgs.length).toBe(2); // greeting + response
    expect(userMsgs[0].text).toBe("What campaigns are active?");
  });

  it("extracts session info", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.sessionInfo).toBeDefined();
    expect(result.sessionInfo!.outcome).toBe("Abandoned");
    expect(result.sessionInfo!.turnCount).toBe(4);
    expect(result.globalOutcome).toBe("Abandoned");
    expect(result.globalOutcomeReason).toBe("UserExit");
  });

  it("computes duration from session times", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.totalDurationSeconds).toBe(285); // 4min 45s
  });

  it("extracts channel ID", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.channelId).toBe("pva-studio");
  });
});

// ── Plan Steps ────────────────────────────────────────────────────────

describe("parseTranscript — plan steps", () => {
  it("merges triggered + bind + finished into one step", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.planSteps).toHaveLength(1);
    const step = result.planSteps[0];
    expect(step.thought).toContain("active campaigns");
    expect(step.arguments).toEqual({ status: "active" });
    expect(step.observation).toContain("7 interactions");
    expect(step.executionTime).toBe("00:00:02.25");
    expect(step.state).toBe("completed");
  });

  it("preserves replyToId on plan steps", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.planSteps[0].replyToId).toBe("msg-user-001");
  });
});

// ── User Identity ─────────────────────────────────────────────────────

describe("parseTranscript — user identity", () => {
  it("extracts AAD Object ID from user messages", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.userAadObjectId).toBe("aad-user-123");
  });

  it("falls back to startConversation event when no user messages", () => {
    const result = parseTranscript(noUserMessagesTranscript);
    expect(result.userAadObjectId).toBe("aad-nouser-789");
    expect(result.messages.filter((m) => m.role === "user")).toHaveLength(0);
  });
});

// ── Reactions ─────────────────────────────────────────────────────────

describe("parseTranscript — reactions", () => {
  it("parses pva-studio reactions (object feedback)", () => {
    const result = parseTranscript(pvaStudioReactionsTranscript);
    expect(result.reactions).toHaveLength(2);
    expect(result.reactions[0].reaction).toBe("like");
    expect(result.reactions[0].feedbackText).toBe("thumbs up from test pane");
    expect(result.reactions[1].reaction).toBe("dislike");
    expect(result.reactions[1].feedbackText).toBe("not helpful");
  });

  it("parses Teams reactions (double-encoded JSON feedback)", () => {
    const result = parseTranscript(teamsReactionsTranscript);
    const like = result.reactions.find((r) => r.reaction === "like");
    expect(like).toBeDefined();
    expect(like!.feedbackText).toBe("thumbs up test");
  });

  it("marks orphan reactions correctly", () => {
    const result = parseTranscript(teamsReactionsTranscript);
    const orphans = result.reactions.filter((r) => r.isOrphan);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].feedbackText).toBe("feedback on old message");
    expect(orphans[0].replyToId).toBe("nonexistent-msg-from-prior-session");
  });

  it("computes feedback counts", () => {
    const result = parseTranscript(pvaStudioReactionsTranscript);
    expect(result.hasFeedback).toBe(true);
    expect(result.likeCount).toBe(1);
    expect(result.dislikeCount).toBe(1);
  });

  it("marks no feedback correctly", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.hasFeedback).toBe(false);
    expect(result.likeCount).toBe(0);
    expect(result.dislikeCount).toBe(0);
  });
});

// ── Knowledge Sources ─────────────────────────────────────────────────

describe("parseTranscript — knowledge", () => {
  it("extracts knowledge search sources", () => {
    const result = parseTranscript(knowledgeTranscript);
    expect(result.knowledgeSearches).toHaveLength(1);
    expect(result.knowledgeSearches[0].knowledgeSources).toHaveLength(2);
    expect(result.knowledgeSearches[0].knowledgeSources[0]).toContain("Healthcare");
  });

  it("extracts knowledge response with query and citations", () => {
    const result = parseTranscript(knowledgeTranscript);
    expect(result.knowledgeResponses).toHaveLength(1);
    expect(result.knowledgeResponses[0].query).toBe("can you tell me a joke");
    expect(result.knowledgeResponses[0].completionState).toBe("Answered");
    expect(result.knowledgeResponses[0].response).toContain("scarecrow");
    expect(result.knowledgeResponses[0].citations).toHaveLength(1);
  });

  it("extracts knowledge trace info", () => {
    const result = parseTranscript(knowledgeTranscript);
    expect(result.knowledgeTrace).toBeDefined();
    expect(result.knowledgeTrace!.isKnowledgeSearched).toBe(true);
    expect(result.knowledgeTrace!.completionState).toBe("Answered");
  });

  it("handles redacted bot messages (empty text, no attachments)", () => {
    const result = parseTranscript(knowledgeTranscript);
    const redacted = result.messages.find((m) => m.textFormat === "system" && m.text.includes("not stored"));
    expect(redacted).toBeDefined();
  });
});

// ── Advanced Events ───────────────────────────────────────────────────

describe("parseTranscript — advanced events", () => {
  it("extracts error traces", () => {
    const result = parseTranscript(advancedEventsTranscript);
    const errors = result.advancedEvents.filter((e) => e.category === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0].label).toContain("FlowActionBadRequest");
    expect(errors[0].details.errorMessage).toContain("BadGateway");
  });

  it("extracts server errors", () => {
    const result = parseTranscript(advancedEventsTranscript);
    const serverErrors = result.advancedEvents.filter((e) => e.category === "serverError");
    expect(serverErrors).toHaveLength(1);
    expect(serverErrors[0].details.reasonCode).toBe("RequestFailure");
  });

  it("extracts variable assignments (filters system vars)", () => {
    const result = parseTranscript(advancedEventsTranscript);
    const vars = result.advancedEvents.filter((e) => e.category === "variable");
    expect(vars).toHaveLength(1); // GlobalUserName only, CurrentTime filtered
    expect(vars[0].label).toContain("GlobalUserName");
  });

  it("extracts dialog redirects", () => {
    const result = parseTranscript(advancedEventsTranscript);
    const redirects = result.advancedEvents.filter((e) => e.category === "redirect");
    expect(redirects).toHaveLength(1);
  });

  it("extracts escalation events", () => {
    const result = parseTranscript(advancedEventsTranscript);
    const escalations = result.advancedEvents.filter((e) => e.category === "escalation");
    expect(escalations).toHaveLength(1);
    expect(escalations[0].label).toContain("Escalation");
  });

  it("sets hasErrors flag", () => {
    const result = parseTranscript(advancedEventsTranscript);
    expect(result.hasErrors).toBe(true);
  });

  it("hasErrors is false when no errors", () => {
    const result = parseTranscript(basicMcpTranscript);
    expect(result.hasErrors).toBe(false);
  });
});

// ── Adaptive Cards ────────────────────────────────────────────────────

describe("parseTranscript — adaptive cards", () => {
  it("stores attachments on messages with adaptive cards", () => {
    const result = parseTranscript(adaptiveCardTranscript);
    const cardMsg = result.messages.find((m) => m.textFormat === "adaptive-card");
    expect(cardMsg).toBeDefined();
    expect(cardMsg!.attachments).toHaveLength(1);
    expect(cardMsg!.attachments![0].contentType).toBe("application/vnd.microsoft.card.adaptive");
  });

  it("identifies OAuth cards", () => {
    const result = parseTranscript(adaptiveCardTranscript);
    const oauthMsg = result.messages.find((m) => m.textFormat === "oauth-card");
    expect(oauthMsg).toBeDefined();
  });

  it("shows user action for empty user messages", () => {
    const result = parseTranscript(adaptiveCardTranscript);
    const userAction = result.messages.find((m) => m.role === "user" && m.textFormat === "system");
    expect(userAction).toBeDefined();
    expect(userAction!.text).toContain("User action");
  });
});

// ── Utility Functions ─────────────────────────────────────────────────

describe("utility functions", () => {
  it("formatTimestamp converts epoch seconds to locale string", () => {
    const result = formatTimestamp(1775589131);
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("formatDuration handles seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formatDuration handles minutes + seconds", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("formatDuration handles exact minutes", () => {
    expect(formatDuration(120)).toBe("2m");
  });

  it("shortToolName extracts last segment", () => {
    expect(shortToolName("MCP:schema.topic:list_interactions")).toBe("list_interactions");
    expect(shortToolName("P:UniversalSearchTool")).toBe("UniversalSearchTool");
    expect(shortToolName("simple_name")).toBe("simple_name");
  });
});

// ── Client-side Search ─────────────────────────────────────────────────

describe("client-side search", () => {
  // Inline search logic to avoid importing from useTranscripts (which pulls in Power Apps SDK)
  function searchByField(transcripts: ReturnType<typeof parseTranscript>[], query: string, field: string) {
    const q = query.toLowerCase();
    return transcripts.filter((t) => {
      if (field === "messages") return t.messages.some((m) => m.text.toLowerCase().includes(q));
      if (field === "thinking") return t.planSteps.some((s) => s.thought?.toLowerCase().includes(q));
      // all
      return t.messages.some((m) => m.text.toLowerCase().includes(q)) ||
        t.planSteps.some((s) => s.thought?.toLowerCase().includes(q) || s.observation?.toLowerCase().includes(q));
    });
  }

  it("filters by message text", () => {
    const transcript = parseTranscript(basicMcpTranscript);
    const results = searchByField([transcript], "campaigns", "messages");
    expect(results).toHaveLength(1);
  });

  it("filters by thinking", () => {
    const transcript = parseTranscript(basicMcpTranscript);
    const results = searchByField([transcript], "active campaigns", "thinking");
    expect(results).toHaveLength(1);
  });

  it("returns empty for no match", () => {
    const transcript = parseTranscript(basicMcpTranscript);
    const results = searchByField([transcript], "nonexistent xyz", "all");
    expect(results).toHaveLength(0);
  });
});
