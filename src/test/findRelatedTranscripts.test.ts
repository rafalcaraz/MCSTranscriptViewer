import { describe, it, expect } from "vitest";
import { findChildTranscript, findParentTranscript } from "../utils/findRelatedTranscripts";
import type { ParsedTranscript, ConnectedAgentInvocation } from "../types/transcript";

function makeTranscript(over: Partial<ParsedTranscript> & {
  id: string;
  botName: string;
  userId?: string;
  startMs?: number;
  invocations?: ConnectedAgentInvocation[];
}): ParsedTranscript {
  const startISO = new Date(over.startMs ?? 1_700_000_000_000).toISOString();
  const invocations = over.invocations ?? [];
  return {
    conversationtranscriptid: over.id,
    name: over.id,
    createdon: startISO,
    conversationstarttime: startISO,
    metadata: {
      botId: "bot-id-" + over.botName,
      botName: over.botName,
      aadTenantId: "tenant",
      botEnvironmentId: "env",
      botType: "Bot",
      conversationStartedAt: startISO,
    } as ParsedTranscript["metadata"],
    schematype: "ConversationTranscript",
    schemaversion: "1.0",
    transcriptType: "chat",
    messages: [],
    reactions: [],
    planSteps: [],
    availableTools: [],
    knowledgeSearches: [],
    knowledgeResponses: [],
    advancedEvents: [],
    userAadObjectId: over.userId,
    turnCount: 0,
    hasErrors: false,
    hasFeedback: false,
    likeCount: 0,
    dislikeCount: 0,
    userAttachmentCount: 0,
    connectedAgentInvocations: invocations,
    invokedChildAgentSchemaNames: [...new Set(invocations.map((i) => i.childSchemaName))],
    ...over,
  } as ParsedTranscript;
}

function makeInvocation(childSchemaName: string, startTimestamp: number): ConnectedAgentInvocation {
  return {
    parentSchemaName: "msftcsa_MainITAgent",
    childSchemaName,
    childDisplayName: childSchemaName,
    parentDisplayName: "Main IT Agent",
    startTimestamp,
    endTimestamp: startTimestamp + 60_000,
    messageIds: [],
  } as ConnectedAgentInvocation;
}

describe("findChildTranscript", () => {
  const t0 = 1_700_000_000_000;
  const userA = "user-a";
  const userB = "user-b";

  it("matches child by botName + user + close timestamp", () => {
    const inv = makeInvocation("msftcsa_HelpDeskAgent", t0);
    const parent = makeTranscript({ id: "p1", botName: "msftcsa_MainITAgent", userId: userA, startMs: t0, invocations: [inv] });
    const child = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 + 5_000 });
    const other = makeTranscript({ id: "x1", botName: "msftcsa_Cybersecurity", userId: userA, startMs: t0 });
    expect(findChildTranscript(parent, inv, [parent, child, other])?.conversationtranscriptid).toBe("c1");
  });

  it("rejects different user even if botName + timestamp match", () => {
    const inv = makeInvocation("msftcsa_HelpDeskAgent", t0);
    const parent = makeTranscript({ id: "p1", botName: "msftcsa_MainITAgent", userId: userA, startMs: t0, invocations: [inv] });
    const wrongUser = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userB, startMs: t0 });
    expect(findChildTranscript(parent, inv, [parent, wrongUser])).toBeNull();
  });

  it("rejects timestamp outside the ±10 minute window", () => {
    const inv = makeInvocation("msftcsa_HelpDeskAgent", t0);
    const parent = makeTranscript({ id: "p1", botName: "msftcsa_MainITAgent", userId: userA, startMs: t0, invocations: [inv] });
    const tooLate = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 + 11 * 60_000 });
    expect(findChildTranscript(parent, inv, [parent, tooLate])).toBeNull();
  });

  it("picks the closest match when several candidates qualify", () => {
    const inv = makeInvocation("msftcsa_HelpDeskAgent", t0);
    const parent = makeTranscript({ id: "p1", botName: "msftcsa_MainITAgent", userId: userA, startMs: t0, invocations: [inv] });
    const far = makeTranscript({ id: "c-far", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 + 5 * 60_000 });
    const near = makeTranscript({ id: "c-near", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 + 30_000 });
    expect(findChildTranscript(parent, inv, [parent, far, near])?.conversationtranscriptid).toBe("c-near");
  });

  it("returns null when parent has no userAadObjectId (cannot safely match)", () => {
    const inv = makeInvocation("msftcsa_HelpDeskAgent", t0);
    const parent = makeTranscript({ id: "p1", botName: "msftcsa_MainITAgent", startMs: t0, invocations: [inv] });
    const child = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 });
    expect(findChildTranscript(parent, inv, [parent, child])).toBeNull();
  });
});

describe("findParentTranscript", () => {
  const t0 = 1_700_000_000_000;
  const userA = "user-a";

  it("finds the parent when the child's botName matches an invocation's childSchemaName", () => {
    const inv = makeInvocation("msftcsa_HelpDeskAgent", t0);
    const parent = makeTranscript({ id: "p1", botName: "msftcsa_MainITAgent", userId: userA, startMs: t0, invocations: [inv] });
    const child = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 + 30_000 });
    const result = findParentTranscript(child, [parent, child]);
    expect(result?.parent.conversationtranscriptid).toBe("p1");
    expect(result?.invocation.childSchemaName).toBe("msftcsa_HelpDeskAgent");
  });

  it("returns null when no loaded transcript invokes this child", () => {
    const child = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 });
    const unrelated = makeTranscript({ id: "u1", botName: "msftcsa_OtherAgent", userId: userA, startMs: t0 });
    expect(findParentTranscript(child, [child, unrelated])).toBeNull();
  });

  it("does not match itself", () => {
    const child = makeTranscript({ id: "c1", botName: "msftcsa_HelpDeskAgent", userId: userA, startMs: t0 });
    expect(findParentTranscript(child, [child])).toBeNull();
  });
});
