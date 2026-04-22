import { describe, it, expect } from "vitest";
import { parseTranscript, formatTimestamp, formatDuration, shortToolName, prettyAgentName } from "../utils/parseTranscript";
import type { DataverseTranscriptRecord } from "../utils/parseTranscript";
import {
  basicMcpTranscript,
  pvaStudioReactionsTranscript,
  teamsReactionsTranscript,
  knowledgeTranscript,
  advancedEventsTranscript,
  adaptiveCardTranscript,
  noUserMessagesTranscript,
  autonomousTranscript,
  evaluationTranscript,
  chatTranscript,
  newAdvancedEventsTranscript,
  multiAgentTranscript,
  handoffTranscript,
  fakeHandoffTraceTranscript,
  d365LcwHandoffTranscript,
  fakeHandoffOutcomeTranscript,
  handoffNonLcwTranscript,
  voiceFirstClassHandoffTranscript,
  studioAuthorHandoffTranscript,
  voiceSessionTranscript,
  lcwConfiguredByAuthorTranscript,
  voiceEndAndPrrTranscript,
  voicePrrAnsweredTranscript,
  autonomousPlanExecutionTranscript,
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

// ── Export Transcript ─────────────────────────────────────────────────

describe("generateTranscriptHTML", () => {
  async function getGenerator() {
    const { generateTranscriptHTML } = await import("../utils/exportTranscript");
    return generateTranscriptHTML;
  }

  it("generates valid HTML document", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<title>");
  });

  it("includes agent name in header", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript, "Test Agent Display");
    expect(html).toContain("Test Agent Display");
  });

  it("includes user display name when provided", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript, undefined, "John Doe");
    expect(html).toContain("John Doe");
  });

  it("falls back to bot schema name when no display name", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript);
    expect(html).toContain("msftcsa_testbot");
  });

  it("includes all user and bot messages", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript);
    expect(html).toContain("What campaigns are active?");
    expect(html).toContain("Hello, how can I help?");
    expect(html).toContain("7 active campaigns");
  });

  it("includes conversation metadata", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript);
    expect(html).toContain("test-basic-001");
    expect(html).toContain("Abandoned");
  });

  it("includes outcome badge styling", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript);
    expect(html).toContain("badge-warning");
  });

  it("includes export footer", async () => {
    const generate = await getGenerator();
    const transcript = parseTranscript(basicMcpTranscript);
    const html = generate(transcript);
    expect(html).toContain("Exported from MCS Conversation Viewer");
  });
});

// ── Transcript Type Classification ────────────────────────────────────

describe("parseTranscript — transcript type classification", () => {
  it("classifies autonomous transcripts (pva-autonomous channel + triggerTest)", () => {
    const parsed = parseTranscript(autonomousTranscript);
    expect(parsed.transcriptType).toBe("autonomous");
  });

  it("classifies evaluation fixture as chat (evaluation disabled pending confirmed signal)", () => {
    const parsed = parseTranscript(evaluationTranscript);
    expect(parsed.transcriptType).toBe("chat");
  });

  it("classifies design transcripts (isDesignMode, no test flags in channelData)", () => {
    const parsed = parseTranscript(basicMcpTranscript);
    expect(parsed.transcriptType).toBe("design");
  });

  it("classifies chat transcripts (no test flags, no design mode)", () => {
    const parsed = parseTranscript(chatTranscript);
    expect(parsed.transcriptType).toBe("chat");
  });

  it("autonomous takes priority over other flags", () => {
    const parsed = parseTranscript(autonomousTranscript);
    expect(parsed.transcriptType).toBe("autonomous");
  });

  it("design mode with testMode+enableDiagnostics is still design (test pane)", () => {
    const parsed = parseTranscript(basicMcpTranscript);
    expect(parsed.transcriptType).toBe("design");
  });
});

// ── New Advanced Events ───────────────────────────────────────────────

describe("parseTranscript — new advanced events", () => {
  it("extracts IntentRecognition events", () => {
    const parsed = parseTranscript(newAdvancedEventsTranscript);
    const intent = parsed.advancedEvents.find((e) => e.category === "intentRecognition");
    expect(intent).toBeDefined();
    expect(intent!.label).toContain("ServiceNowHelp");
    expect(intent!.label).toContain("92%");
    expect(intent!.icon).toBe("🎯");
  });

  it("extracts NodeTraceData events", () => {
    const parsed = parseTranscript(newAdvancedEventsTranscript);
    const node = parsed.advancedEvents.find((e) => e.category === "nodeTrace");
    expect(node).toBeDefined();
    expect(node!.label).toContain("ConditionGroup");
    expect(node!.icon).toBe("📍");
  });

  it("extracts endOfConversation as catch-all activity", () => {
    const parsed = parseTranscript(newAdvancedEventsTranscript);
    const eoc = parsed.advancedEvents.find((e) => e.category === "activity" && e.label === "endOfConversation");
    expect(eoc).toBeDefined();
    expect(eoc!.icon).toBe("📋");
  });

  it("extracts pvaSetContext as catch-all activity", () => {
    const parsed = parseTranscript(newAdvancedEventsTranscript);
    const ctx = parsed.advancedEvents.find((e) => e.category === "activity" && e.label === "pvaSetContext");
    expect(ctx).toBeDefined();
  });

  it("extracts ConsentNotProvidedByUser error", () => {
    const parsed = parseTranscript(newAdvancedEventsTranscript);
    const err = parsed.advancedEvents.find((e) => e.category === "error");
    expect(err).toBeDefined();
    expect(err!.label).toContain("ConsentNotProvidedByUser");
  });

  it("chat transcript has no test-related classification", () => {
    const parsed = parseTranscript(chatTranscript);
    expect(parsed.transcriptType).toBe("chat");
    expect(parsed.channelId).toBe("msteams");
  });
});


// ── isParticipant helper ──────────────────────────────────────────────

describe("isParticipant", () => {
  it("returns true when AAD ID matches the resolved userAadObjectId", async () => {
    const { isParticipant } = await import("../utils/parseTranscript");
    const t = parseTranscript(basicMcpTranscript);
    expect(t.userAadObjectId).toBe("aad-user-123");
    expect(isParticipant(t, "aad-user-123")).toBe(true);
  });

  it("is case-insensitive", async () => {
    const { isParticipant } = await import("../utils/parseTranscript");
    const t = parseTranscript(basicMcpTranscript);
    expect(isParticipant(t, "AAD-User-123")).toBe(true);
  });

  it("returns false when AAD ID is unrelated", async () => {
    const { isParticipant } = await import("../utils/parseTranscript");
    const t = parseTranscript(basicMcpTranscript);
    expect(isParticipant(t, "some-other-guid")).toBe(false);
  });

  it("returns true when AAD ID matches a user-role message author", async () => {
    const { isParticipant } = await import("../utils/parseTranscript");
    const t = parseTranscript(basicMcpTranscript);
    // basicMcpTranscript user message author is aad-user-123
    expect(isParticipant(t, "aad-user-123")).toBe(true);
  });

  it("returns false when AAD ID only matches a non-participant role", async () => {
    // Synthesize a transcript where the GUID appears as a bot/from id but never as a user participant.
    const { isParticipant } = await import("../utils/parseTranscript");
    const t = parseTranscript(basicMcpTranscript);
    // Bot ids in basicMcpTranscript are "bot-xyz" with no aadObjectId set
    expect(isParticipant(t, "bot-xyz")).toBe(false);
  });
});

// ── Attachment classification ────────────────────────────────────────

describe("classifyAttachments", () => {
  it("classifies an uploaded file (specific mime, no inline html) as upload", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      {
        contentType: "image/png",
        content: { kind: "conversationFileReference", value: "ref-guid-upload" },
      },
    ]);
    expect(s).toBeDefined();
    expect(s!.kind).toBe("upload");
    expect(s!.items[0].referenceId).toBe("ref-guid-upload");
    expect(s!.items[0].contentType).toBe("image/png");
  });

  it("classifies an inline paste (wildcard mime + html <img> from skype) as paste", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      {
        contentType: "image/*",
        content: { kind: "conversationFileReference", value: "ref-paste" },
      },
      {
        contentType: "text/html",
        content: '<p>look</p><p><img alt="Funny cat" src="https://us-api.asm.skype.com/v1/objects/0-wus-d1-xxx/views/imgo" width="250" height="250"></p>',
      },
    ]);
    expect(s).toBeDefined();
    expect(s!.kind).toBe("paste");
    expect(s!.items[0].altText).toBe("Funny cat");
    expect(s!.items[0].width).toBe(250);
    expect(s!.items[0].height).toBe(250);
  });

  it("treats specific-mime + skype inline html as paste (not upload) — HTML signal wins", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      {
        contentType: "image/jpeg",
        content: { kind: "conversationFileReference", value: "ref-x" },
      },
      {
        contentType: "text/html",
        content: '<p><img src="https://us-api.asm.skype.com/v1/objects/abc/views/imgo"></p>',
      },
    ]);
    expect(s!.kind).toBe("paste");
  });

  it("ignores generic alt=\"image\"", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      { contentType: "image/*", content: { kind: "conversationFileReference", value: "r" } },
      { contentType: "text/html", content: '<img alt="image" src="https://us-api.asm.skype.com/x">' },
    ]);
    expect(s!.items[0].altText).toBeUndefined();
  });

  it("classifies adaptive card as card", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: { type: "AdaptiveCard", version: "1.3" },
      },
    ]);
    expect(s!.kind).toBe("card");
    expect(s!.items[0].label).toBe("Adaptive Card");
  });

  it("classifies non-image file (PDF) as file", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      {
        contentType: "application/pdf",
        content: { kind: "conversationFileReference", value: "pdf-ref" },
      },
    ]);
    expect(s!.kind).toBe("file");
    expect(s!.items[0].label).toBe("PDF");
  });

  it("returns undefined when there are no attachments", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    expect(classifyAttachments([])).toBeUndefined();
  });

  it("ignores text/html only (no media attachment)", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    // text/html alone shouldn't generate any items
    const s = classifyAttachments([
      { contentType: "text/html", content: "<p>just text</p>" },
    ]);
    expect(s).toBeUndefined();
  });

  it("computes aggregate kind = unknown for mixed items", async () => {
    const { classifyAttachments } = await import("../utils/parseTranscript");
    const s = classifyAttachments([
      { contentType: "image/png", content: { kind: "conversationFileReference", value: "a" } },
      { contentType: "application/pdf", content: { kind: "conversationFileReference", value: "b" } },
    ]);
    expect(s!.kind).toBe("unknown");
    expect(s!.items).toHaveLength(2);
  });
});

describe("parseTranscript — userAttachmentCount", () => {
  it("counts user messages with non-card attachments", async () => {
    const t = parseTranscript(adaptiveCardTranscript);
    // adaptive card attachments are on bot messages, so userAttachmentCount should be 0
    expect(t.userAttachmentCount).toBe(0);
  });
});

// ── Multi-agent (connected agents) ────────────────────────────────────

describe("prettyAgentName", () => {
  it("strips publisher prefix and splits CamelCase", () => {
    expect(prettyAgentName("msftcsa_HelpDeskAgent")).toBe("Help Desk Agent");
    expect(prettyAgentName("msftcsa_Cybersecurity")).toBe("Cybersecurity");
  });
  it("preserves all-caps acronyms", () => {
    expect(prettyAgentName("msftcsa_MainITAgent")).toBe("Main IT Agent");
    expect(prettyAgentName("cr290_APIHelper")).toBe("API Helper");
  });
  it("handles names with no prefix", () => {
    expect(prettyAgentName("HelpDeskAgent")).toBe("Help Desk Agent");
  });
  it("handles empty string", () => {
    expect(prettyAgentName("")).toBe("");
  });
});

describe("parseTranscript — multi-agent (connected agents)", () => {
  it("extracts connected-agent invocations in chronological order", () => {
    const t = parseTranscript(multiAgentTranscript);
    expect(t.connectedAgentInvocations).toHaveLength(2);
    expect(t.connectedAgentInvocations[0].childSchemaName).toBe("msftcsa_HelpDeskAgent");
    expect(t.connectedAgentInvocations[1].childSchemaName).toBe("msftcsa_Cybersecurity");
  });

  it("captures parent display name", () => {
    const t = parseTranscript(multiAgentTranscript);
    expect(t.parentAgentSchemaName).toBe("msftcsa_MainITAgent");
    expect(t.parentAgentDisplayName).toBe("Main IT Agent");
  });

  it("links the planner thought to each invocation", () => {
    const t = parseTranscript(multiAgentTranscript);
    expect(t.connectedAgentInvocations[0].thought).toContain("Routing to Help-Desk-Agent");
    expect(t.connectedAgentInvocations[1].thought).toContain("Cybersecurity specialist");
  });

  it("populates pretty display names on invocations", () => {
    const t = parseTranscript(multiAgentTranscript);
    expect(t.connectedAgentInvocations[0].childDisplayName).toBe("Help Desk Agent");
    expect(t.connectedAgentInvocations[0].parentDisplayName).toBe("Main IT Agent");
    expect(t.connectedAgentInvocations[1].childDisplayName).toBe("Cybersecurity");
  });

  it("tags bot messages within child windows with the child agent", () => {
    const t = parseTranscript(multiAgentTranscript);
    const helpdeskMsg = t.messages.find((m) => m.id === "msg-helpdesk-1");
    const cyberMsg = t.messages.find((m) => m.id === "msg-cyber-1");
    expect(helpdeskMsg?.speakingAgent?.schemaName).toBe("msftcsa_HelpDeskAgent");
    expect(helpdeskMsg?.speakingAgent?.isChild).toBe(true);
    expect(helpdeskMsg?.speakingAgent?.displayName).toBe("Help Desk Agent");
    expect(cyberMsg?.speakingAgent?.schemaName).toBe("msftcsa_Cybersecurity");
    expect(cyberMsg?.speakingAgent?.isChild).toBe(true);
  });

  it("tags bot messages outside child windows with the parent agent", () => {
    const t = parseTranscript(multiAgentTranscript);
    const greetMsg = t.messages.find((m) => m.id === "msg-parent-greet");
    const parent2 = t.messages.find((m) => m.id === "msg-parent-2");
    expect(greetMsg?.speakingAgent?.schemaName).toBe("msftcsa_MainITAgent");
    expect(greetMsg?.speakingAgent?.isChild).toBe(false);
    expect(parent2?.speakingAgent?.isChild).toBe(false);
  });

  it("captures message ids inside each invocation window", () => {
    const t = parseTranscript(multiAgentTranscript);
    expect(t.connectedAgentInvocations[0].messageIds).toContain("msg-helpdesk-1");
    expect(t.connectedAgentInvocations[1].messageIds).toContain("msg-cyber-1");
  });

  it("does not tag user messages with a speakingAgent", () => {
    const t = parseTranscript(multiAgentTranscript);
    const userMsgs = t.messages.filter((m) => m.role === "user");
    for (const m of userMsgs) {
      expect(m.speakingAgent).toBeUndefined();
    }
  });

  it("captures invokedChildAgentSchemaNames (deduped)", () => {
    const t = parseTranscript(multiAgentTranscript);
    expect(t.invokedChildAgentSchemaNames.sort()).toEqual([
      "msftcsa_Cybersecurity",
      "msftcsa_HelpDeskAgent",
    ]);
  });

  it("leaves single-agent transcripts untouched (no invocations, no speakingAgent)", () => {
    const t = parseTranscript(basicMcpTranscript);
    expect(t.connectedAgentInvocations).toHaveLength(0);
    expect(t.parentAgentSchemaName).toBeUndefined();
    expect(t.invokedChildAgentSchemaNames).toEqual([]);
    for (const m of t.messages) {
      expect(m.speakingAgent).toBeUndefined();
    }
  });
});


describe("parseTranscript — handoff events", () => {
  const parsed = parseTranscript(handoffTranscript);

  it("extracts both *Handoff events and ignores non-handoff events", () => {
    expect(parsed.handoffs).toHaveLength(2);
    expect(parsed.handoffs.map(h => h.eventName).sort()).toEqual(["GenesysHandoff", "SalesforceHandoff"]);
  });

  it("derives provider name by stripping 'Handoff' suffix", () => {
    const providers = parsed.handoffs.map(h => h.provider).sort();
    expect(providers).toEqual(["Genesys", "Salesforce"]);
  });

  it("flags string vs structured payloads correctly", () => {
    const genesys = parsed.handoffs.find(h => h.provider === "Genesys")!;
    expect(genesys.isValueString).toBe(true);
    expect(genesys.isValueStructured).toBe(false);
    expect(typeof genesys.value).toBe("string");

    const sf = parsed.handoffs.find(h => h.provider === "Salesforce")!;
    expect(sf.isValueString).toBe(false);
    expect(sf.isValueStructured).toBe(true);
    expect((sf.value as { caseNumber: string }).caseNumber).toBe("CASE-001");
  });

  it("preserves replyToId so callouts can be threaded inline", () => {
    expect(parsed.handoffs[0].replyToId).toBe("msg-bot-1");
  });

  it("does not produce handoffs for unrelated transcripts", () => {
    expect(parseTranscript(basicMcpTranscript).handoffs).toEqual([]);
  });
});

describe("parseTranscript — hasHandoff flag", () => {
  it("is true when a *Handoff event is present", () => {
    expect(parseTranscript(handoffTranscript).hasHandoff).toBe(true);
  });

  it("is false for transcripts with no handoff signal", () => {
    expect(parseTranscript(basicMcpTranscript).hasHandoff).toBe(false);
  });

  it("is FALSE when only a stray HandOff trace exists but outcome is Abandoned (PVA Escalate-not-configured pattern)", () => {
    const parsed = parseTranscript(fakeHandoffTraceTranscript);
    expect(parsed.globalOutcome).toBe("Abandoned");
    expect(parsed.hasHandoff).toBe(false);
  });

  it("is TRUE for a real D365 LCW handoff (outcome=HandOff + RequestedBy* + channelId=lcw)", () => {
    const parsed = parseTranscript(d365LcwHandoffTranscript);
    expect(parsed.globalOutcome).toBe("HandOff");
    expect(parsed.globalOutcomeReason).toBe("AgentTransferRequestedByUser");
    expect(parsed.channelId).toBe("lcw");
    expect(parsed.hasHandoff).toBe(true);
  });

  it("is FALSE when outcome=HandOff but reason is AgentTransferFromQuestionMaxAttempts (PVA fake-out)", () => {
    const parsed = parseTranscript(fakeHandoffOutcomeTranscript);
    expect(parsed.globalOutcome).toBe("HandOff");
    expect(parsed.globalOutcomeReason).toBe("AgentTransferFromQuestionMaxAttempts");
    expect(parsed.hasHandoff).toBe(false);
  });

  it("is FALSE when outcome=HandOff + RequestedBy* but channel is not lcw (no human queue gated)", () => {
    const parsed = parseTranscript(handoffNonLcwTranscript);
    expect(parsed.globalOutcome).toBe("HandOff");
    expect(parsed.globalOutcomeReason).toBe("AgentTransferRequestedByUser");
    expect(parsed.channelId).not.toBe("lcw");
    expect(parsed.hasHandoff).toBe(false);
  });
});

describe("parseTranscript — D365 Omnichannel handoff synthesis", () => {
  it("synthesizes a single HandoffEvent with provider 'D365 Omnichannel' for a real LCW handoff", () => {
    const parsed = parseTranscript(d365LcwHandoffTranscript);
    expect(parsed.handoffs).toHaveLength(1);
    const h = parsed.handoffs[0];
    expect(h.provider).toBe("D365 Omnichannel");
    expect(h.eventName).toBe("D365OmnichannelHandoff");
    expect(h.isValueStructured).toBe(true);
  });

  it("dedupes duplicate HandOff traces (D365 emits 2x — only one synthesized event)", () => {
    const parsed = parseTranscript(d365LcwHandoffTranscript);
    // Source has 2 HandOff traces; we collapse to a single synthesized event.
    expect(parsed.handoffs.filter((h) => h.provider === "D365 Omnichannel")).toHaveLength(1);
  });

  it("attaches the synthesized event to the bot transfer message id (so it renders inline)", () => {
    const parsed = parseTranscript(d365LcwHandoffTranscript);
    const h = parsed.handoffs[0];
    expect(h.replyToId).toBe("msg-bot-transfer");
    const v = h.value as Record<string, unknown>;
    expect(v.transferMessage).toMatch(/transferring you to a representative/i);
  });

  it("does NOT synthesize a D365 handoff for the fake-out (RequestedBy* check fails)", () => {
    const parsed = parseTranscript(fakeHandoffOutcomeTranscript);
    expect(parsed.handoffs).toHaveLength(0);
  });

  it("does NOT synthesize when channel is not lcw (channel gate)", () => {
    const parsed = parseTranscript(handoffNonLcwTranscript);
    expect(parsed.handoffs).toHaveLength(0);
  });
});

describe("parseTranscript — first-class handoff activity (type=handoff)", () => {
  it("detects D365 Voice handoff (conversationconductor + transferToAgent) → 1 event", () => {
    const parsed = parseTranscript(voiceFirstClassHandoffTranscript);
    expect(parsed.channelId).toBe("conversationconductor");
    expect(parsed.hasHandoff).toBe(true);
    expect(parsed.handoffs).toHaveLength(1);
    const h = parsed.handoffs[0];
    expect(h.eventName).toBe("handoff");
    expect(h.provider).toBe("Salesforce");
    expect(h.isValueStructured).toBe(true);
  });

  it("detects Studio author-configured handoff and does NOT double-count with LCW synthesis or trace", () => {
    const parsed = parseTranscript(studioAuthorHandoffTranscript);
    expect(parsed.hasHandoff).toBe(true);
    expect(parsed.handoffs).toHaveLength(1);
    expect(parsed.handoffs[0].eventName).toBe("handoff");
    expect(parsed.handoffs[0].provider).toBe("Copilot Studio");
  });

  it("does NOT fire on the OOB Escalate fake-out (HandOff trace only, no handoff activity)", () => {
    const parsed = parseTranscript(fakeHandoffTraceTranscript);
    expect(parsed.hasHandoff).toBe(false);
    expect(parsed.handoffs).toHaveLength(0);
  });
});

describe("parseTranscript — D365 Voice context (pvaSetContext)", () => {
  const parsed = parseTranscript(voiceSessionTranscript);

  it("extracts phone numbers, ids, and locale from pvaSetContext value", () => {
    const v = parsed.voiceContext!;
    expect(v).toBeDefined();
    expect(v.organizationPhone).toBe("+18334895405");
    expect(v.customerPhone).toBe("+13204346038");
    expect(v.liveWorkItemId).toBe("3b867b92-aaaa-bbbb-cccc-ddddeeeeffff");
    expect(v.sessionId).toBe("91d91471-aaaa-bbbb-cccc-ddddeeeeffff");
    expect(v.locale).toBe("en-US");
  });

  it("extracts IVR + voice config + Nuance session from channelData", () => {
    const v = parsed.voiceContext!;
    expect(v.channelSpecifier).toBe("IVR");
    expect(v.voices?.["en-US"]?.voiceName).toBe("de-DE-Seraphina:DragonHDLatestNeural");
    expect(v.nuanceSessionId).toBe("ceea9a40-1234-1234-1234-abcabcabcabc");
  });

  it("preserves the bot message's speak SSML on ChatMessage.speak", () => {
    const botMsg = parsed.messages.find((m) => m.id === "msg-bot-1");
    expect(botMsg?.speak).toContain("<speak");
    expect(botMsg?.speak).toContain("Seraphina");
  });

  it("returns voiceContext=undefined for transcripts without pvaSetContext", () => {
    expect(parseTranscript(basicMcpTranscript).voiceContext).toBeUndefined();
  });
});

describe("parseTranscript — Omnichannel context + authenticated visitor", () => {
  it("extracts msdyn_* context from startConversation event", () => {
    const parsed = parseTranscript(d365LcwHandoffTranscript);
    expect(parsed.omnichannelContext).toBeDefined();
    const ctx = parsed.omnichannelContext!;
    expect(ctx.liveWorkItemId).toBe("1970b59e-f5a1-4f02-8dd1-c36261ad0e8c");
    expect(ctx.sessionId).toBe("0274bfd2-6242-42c2-b78e-fc9652e63752");
    expect(ctx.workstreamId).toBe("3f956ca3-0ec9-db3f-b012-7c0ee5261aed");
    expect(ctx.browser).toBe("Edge");
    expect(ctx.device).toBe("Desktop");
    expect(ctx.os).toBe("Windows");
    expect(ctx.locale).toBe("en-US");
    expect(ctx.linkedRecord?.primaryDisplayValue).toBe("john.doe@hls-mock.com");
  });

  it("extracts OIDC claims as authenticatedVisitor when sub is present", () => {
    const parsed = parseTranscript(d365LcwHandoffTranscript);
    expect(parsed.authenticatedVisitor).toBeDefined();
    const v = parsed.authenticatedVisitor!;
    expect(v.sub).toBe("user-001");
    expect(v.email).toBe("john.doe@hls-mock.com");
    expect(v.givenName).toBe("John");
    expect(v.familyName).toBe("Doe");
    expect(v.phoneNumber).toBe("555-100-0001");
  });

  it("does not surface omnichannelContext for non-LCW transcripts", () => {
    const parsed = parseTranscript(basicMcpTranscript);
    expect(parsed.omnichannelContext).toBeUndefined();
    expect(parsed.authenticatedVisitor).toBeUndefined();
  });
});


// ── Tier 3: lifecycle signals & ConfiguredByAuthor synthesis ─────────

describe("parseTranscript — LCW author-configured handoff (synth path)", () => {
  it("synthesizes handoff for AgentTransferConfiguredByAuthor on LCW (4th allowed reason)", () => {
    const parsed = parseTranscript(lcwConfiguredByAuthorTranscript);
    expect(parsed.channelId).toBe("lcw");
    expect(parsed.globalOutcomeReason).toBe("AgentTransferConfiguredByAuthor");
    expect(parsed.hasHandoff).toBe(true);
    expect(parsed.handoffs.length).toBe(1);
    const ev = parsed.handoffs[0];
    expect(ev.eventName).toBe("D365OmnichannelHandoff");
    expect(ev.provider).toBe("D365 Omnichannel");
  });
});

describe("parseTranscript — endOfConversation signal", () => {
  it("extracts endOfConversation activity with channelData reason", () => {
    const parsed = parseTranscript(voiceEndAndPrrTranscript);
    expect(parsed.endOfConversation).toBeDefined();
    expect(parsed.endOfConversation?.reason).toBe("CCAAS_TRANSFER");
    expect(parsed.endOfConversation?.byRole).toBe("bot");
    expect(parsed.endOfConversation?.timestamp).toBe(1776830010);
  });

  it("is undefined when no endOfConversation activity present (never inferred)", () => {
    const parsed = parseTranscript(voiceSessionTranscript);
    expect(parsed.endOfConversation).toBeUndefined();
  });
});

describe("parseTranscript — PRR survey signal", () => {
  it("marks responded=false when only PRRSurveyRequest present", () => {
    const parsed = parseTranscript(voiceEndAndPrrTranscript);
    expect(parsed.prrSurvey).toBeDefined();
    expect(parsed.prrSurvey?.type).toBe("PRR");
    expect(parsed.prrSurvey?.responded).toBe(false);
    expect(parsed.prrSurvey?.timestamp).toBe(1776830011);
  });

  it("marks responded=true when PRRSurveyResponse also present", () => {
    const parsed = parseTranscript(voicePrrAnsweredTranscript);
    expect(parsed.prrSurvey).toBeDefined();
    expect(parsed.prrSurvey?.responded).toBe(true);
  });

  it("is undefined when no PRRSurveyRequest present", () => {
    const parsed = parseTranscript(voiceSessionTranscript);
    expect(parsed.prrSurvey).toBeUndefined();
  });
});

describe("parseTranscript — autonomous plan execution (DynamicPlan family)", () => {
  it("groups DynamicPlanAIPluginStepFinished into PlanExecution per planIdentifier", () => {
    const parsed = parseTranscript(autonomousPlanExecutionTranscript);
    expect(parsed.planExecutions).toBeDefined();
    expect(parsed.planExecutions!.length).toBe(2);
    const [p1, p2] = parsed.planExecutions!;
    expect(p1.planIdentifier).toBe("plan-aaa");
    expect(p1.isFinalPlan).toBe(false);
    expect(p1.declaredSteps).toEqual(["msdyn_PurchCopilotFollowupTaskAgent.topic.StoreEmailTopic"]);
    expect(p1.steps.length).toBe(1);
    expect(p1.steps[0].state).toBe("completed");
    expect(p1.steps[0].arguments).toMatchObject({ msdyn_PurchCopilotFollowupTaskSaveEmail_dataArea: "USMF" });
    expect(p1.debug?.ask).toBe('{"emailInfo":"..."}');
    expect(p2.planIdentifier).toBe("plan-bbb");
    expect(p2.isFinalPlan).toBe(true);
    expect(p2.steps[0].observation).toEqual({ Response: { messageId: "msg-abc-123" } });
  });

  it("returns undefined when no DynamicPlan events are present (non-autonomous transcripts)", () => {
    const parsed = parseTranscript(voiceSessionTranscript);
    expect(parsed.planExecutions).toBeUndefined();
  });

  it("orphan DynamicPlanAIPluginStepFinished without matching Received plan is dropped", () => {
    const orphan: DataverseTranscriptRecord = {
      ...autonomousPlanExecutionTranscript,
      conversationtranscriptid: "test-orphan-step",
      content: JSON.stringify({
        activities: [
          {
            valueType: "DynamicPlanAIPluginStepFinished",
            id: "stf-x",
            type: "event",
            timestamp: 1776860000,
            from: { id: "bot-1", role: 0 },
            channelId: "pva-autonomous",
            value: { taskDialogId: "topic.X", stepId: "x", planIdentifier: "missing", state: "completed" },
          },
        ],
      }),
    };
    const parsed = parseTranscript(orphan);
    expect(parsed.planExecutions).toBeUndefined();
  });
});
