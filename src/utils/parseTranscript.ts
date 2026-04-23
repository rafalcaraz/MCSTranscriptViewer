import type {
  RawActivity,
  ParsedTranscript,
  Reaction,
  TranscriptMetadata,
  TriggerInfo,
  HandoffEvent,
} from "../types/transcript";
import { extractAdvancedEvents } from "./advancedEvents";
import { parseActivity, mergePlanSteps, classifyTranscriptType } from "./parseTranscript/activity";
import { extractHandoffEvents, extractFirstClassHandoffActivities, synthesizeD365LcwHandoff } from "./parseTranscript/handoffs";
import { extractOmnichannelContext } from "./parseTranscript/omnichannel";
import { extractVoiceContext } from "./parseTranscript/voice";
import { extractEndOfConversation, extractPrrSurvey } from "./parseTranscript/lifecycle";
import { extractPlanExecutions } from "./parseTranscript/planExecution";
import {
  prettyAgentName,
  extractConnectedAgentInvocations,
  tagMessagesWithSpeakingAgent,
} from "./parseTranscript/connectedAgents";

// ── Re-exports for backward compatibility with existing callers ──────────
export { formatTimestamp, formatDuration, shortToolName } from "./formatters";
export { prettyAgentName } from "./parseTranscript/connectedAgents";
export { classifyAttachments } from "./parseTranscript/attachments";

/**
 * Strict participant check: returns true only when the AAD object ID is the
 * actual conversation participant (i.e. the bot's user, or the author of any
 * user-role message). Used to filter out transcripts where the GUID merely
 * appears in content (e.g. as a reaction author from a different identity,
 * or in some other non-participant context).
 */
export function isParticipant(t: ParsedTranscript, aadId: string): boolean {
  const id = aadId.toLowerCase();
  if (t.userAadObjectId?.toLowerCase() === id) return true;
  return t.messages.some(
    (m) => m.role === "user" && m.from.aadObjectId?.toLowerCase() === id
  );
}

export interface DataverseTranscriptRecord {
  conversationtranscriptid: string;
  name?: string;
  createdon?: string;
  conversationstarttime: string;
  content: string;
  metadata?: string;
  schematype?: string;
  schemaversion?: string;
}

/**
 * Cheap accessor for the bot schema name on a raw Dataverse record. Parses
 * only the small `metadata` JSON field (NOT the heavy `content` field), so
 * suitable for pre-filtering thousands of rows before deep-parsing the
 * survivors. Returns `""` when the record is missing/malformed metadata.
 */
export function extractBotName(record: DataverseTranscriptRecord): string {
  if (!record.metadata) return "";
  try {
    const m = JSON.parse(record.metadata) as { BotName?: string };
    return m.BotName ?? "";
  } catch {
    return "";
  }
}

export function parseTranscript(record: DataverseTranscriptRecord): ParsedTranscript {
  const contentObj = JSON.parse(record.content) as { activities: RawActivity[] };
  const rawActivities = contentObj.activities ?? [];
  const activities = rawActivities.map(parseActivity);

  const messages = activities
    .filter((a) => a.message)
    .map((a) => a.message!);

  const planSteps = mergePlanSteps(activities);

  const conversationInfo = activities.find((a) => a.conversationInfo)?.conversationInfo;
  const sessionInfo = activities.find((a) => a.sessionInfo)?.sessionInfo;
  const mcpServerInit = activities.find((a) => a.mcpServerInit)?.mcpServerInit;

  const availableTools = activities.find((a) => a.toolsList)?.toolsList ?? [];

  const dialogTraces = activities
    .filter((a) => a.dialogTrace)
    .map((a) => a.dialogTrace!);

  const knowledgeSearches = activities
    .filter((a) => a.knowledgeSearch)
    .map((a) => a.knowledgeSearch!);

  // Enrich knowledge searches with search results from plan step observations
  // The UniversalSearchToolTraceData has empty fullResults/filteredResults for Bing,
  // but DynamicPlanStepFinished observations contain the actual search_result data
  const finishedSteps = activities.filter((a) => a.type === "planStepFinished" && a.planStep);
  for (const ks of knowledgeSearches) {
    if (ks.searchResults.length > 0) continue;
    // Find a matching finished step for this knowledge search tool
    for (const step of finishedSteps) {
      if (step.raw.value && step.raw.name === "DynamicPlanStepFinished") {
        const v = step.raw.value as { taskDialogId?: string; observation?: { search_result?: { search_results?: { Name?: string; Text?: string; FileType?: string; SourceId?: string }[] } } };
        if (v.taskDialogId === ks.toolId && v.observation?.search_result?.search_results?.length) {
          ks.searchResults = v.observation.search_result.search_results.map((r) => ({
            name: r.Name ?? "",
            text: r.Text ?? "",
            fileType: r.FileType ?? "",
            sourceId: r.SourceId ?? "",
          }));
          break;
        }
      }
    }
  }
  // Also check raw activities directly for unmatched searches
  for (const ks of knowledgeSearches) {
    if (ks.searchResults.length > 0) continue;
    for (const a of rawActivities) {
      if (a.name === "DynamicPlanStepFinished") {
        const v = a.value as { taskDialogId?: string; observation?: { search_result?: { search_results?: { Name?: string; Text?: string; FileType?: string; SourceId?: string }[] } } };
        if (v?.taskDialogId === ks.toolId && v?.observation?.search_result?.search_results?.length) {
          ks.searchResults = v.observation.search_result.search_results.map((r) => ({
            name: r.Name ?? "",
            text: r.Text ?? "",
            fileType: r.FileType ?? "",
            sourceId: r.SourceId ?? "",
          }));
          break;
        }
      }
    }
  }

  const knowledgeResponses = activities
    .filter((a) => a.knowledgeResponse)
    .map((a) => a.knowledgeResponse!);

  const knowledgeTrace = activities.find((a) => a.knowledgeTrace)?.knowledgeTrace;

  const advancedEvents = extractAdvancedEvents(rawActivities);

  const firstUserMsg = messages.find((m) => m.role === "user");
  const startEvent = rawActivities.find((a) => a.type === "event" && a.name === "startConversation");
  const userAadObjectId =
    firstUserMsg?.from.aadObjectId ??
    startEvent?.from.aadObjectId;

  const channelId = rawActivities.find((a) => a.channelId)?.channelId;

  const transcriptType = classifyTranscriptType(rawActivities, conversationInfo, channelId);

  // Extract trigger info for autonomous transcripts
  let triggerInfo: TriggerInfo | undefined;
  for (const a of rawActivities) {
    if (a.type === "message" && a.from.role === 1 && a.channelData?.triggerTest) {
      const tt = a.channelData.triggerTest as {
        flowId?: string; flowRunId?: string;
        trigger?: { displayName?: string; connectorDisplayName?: string; connectorIconUri?: string };
      };
      triggerInfo = {
        flowId: tt.flowId ?? "",
        flowRunId: tt.flowRunId ?? "",
        triggerDisplayName: tt.trigger?.displayName ?? "",
        connectorDisplayName: tt.trigger?.connectorDisplayName ?? "",
        connectorIconUri: tt.trigger?.connectorIconUri,
      };
      break;
    }
  }

  let totalDurationSeconds: number | undefined;
  if (sessionInfo?.startTimeUtc && sessionInfo?.endTimeUtc) {
    totalDurationSeconds = Math.round(
      (new Date(sessionInfo.endTimeUtc).getTime() -
        new Date(sessionInfo.startTimeUtc).getTime()) /
        1000
    );
  }

  let meta: TranscriptMetadata = { botId: "", botName: "", aadTenantId: "" };
  if (record.metadata) {
    try {
      const m = JSON.parse(record.metadata) as { BotId?: string; BotName?: string; AADTenantId?: string };
      meta = {
        botId: m.BotId ?? "",
        botName: m.BotName ?? "",
        aadTenantId: m.AADTenantId ?? "",
      };
    } catch {
      // ignore
    }
  }

  const messageIds = new Set(messages.map((m) => m.id));
  const reactions: Reaction[] = activities
    .filter((a) => a.reaction)
    .map((a) => ({
      ...a.reaction!,
      isOrphan: !messageIds.has(a.reaction!.replyToId),
    }));

  const likeCount = reactions.filter((r) => r.reaction === "like").length;
  const dislikeCount = reactions.filter((r) => r.reaction === "dislike").length;
  const userAttachmentCount = messages.filter(
    (m) => m.role === "user" && m.attachmentSummary && m.attachmentSummary.kind !== "card",
  ).length;

  const { invocations: connectedAgentInvocations, parentSchemaName: parentAgentSchemaName } =
    extractConnectedAgentInvocations(rawActivities);
  tagMessagesWithSpeakingAgent(messages, connectedAgentInvocations, parentAgentSchemaName);
  const parentAgentDisplayName = parentAgentSchemaName
    ? prettyAgentName(parentAgentSchemaName)
    : undefined;

  const eventHandoffs = extractHandoffEvents(rawActivities);
  const firstClassHandoffs = extractFirstClassHandoffActivities(rawActivities, channelId);

  // True for any flavor of human/external handoff. Two independent sources
  // feed the unified `handoffs` array:
  //
  //  1. Custom integrations (Genesys, Salesforce, …): bot-emitted
  //     `*Handoff` events. Intentional, explicit, never false-positive.
  //
  //  2. D365 Omnichannel (Live Chat Widget): synthesized from the
  //     trace+outcome+channel signal. Gated by ALL of:
  //       - SessionInfo / ConversationInfo `outcome === "HandOff"`
  //       - `outcomeReason` starts with "AgentTransferRequestedBy"
  //         (explicit ask, not a system bailout like
  //         AgentTransferFromQuestionMaxAttempts)
  //       - `channelId === "lcw"` (channel actually wired to a human queue)
  //
  // We deliberately DO NOT trust:
  //   - A lone `HandOff` trace — PVA's built-in Escalate system topic emits
  //     `EscalationRequested` + `HandOff` traces even when escalation isn't
  //     configured (the bot tells the user it's unavailable).
  //   - outcome=HandOff alone — the same fake-out can also produce
  //     outcome="HandOff" reason="AgentTransferFromQuestionMaxAttempts".
  //   - outcome=HandOff + RequestedBy* on non-lcw channels — the LCW gate
  //     ensures the channel actually has a human queue to route to.
  //
  // If we ever see legitimate non-LCW handoffs in the wild (other Omnichannel
  // channels, custom DirectLine integrations, …), revisit the channel gate.
  const outcomeForRule = conversationInfo?.lastSessionOutcome ?? sessionInfo?.outcome;
  const outcomeReasonForRule =
    conversationInfo?.lastSessionOutcomeReason ?? sessionInfo?.outcomeReason;
  const d365Handoff = synthesizeD365LcwHandoff(
    rawActivities,
    outcomeForRule,
    outcomeReasonForRule,
    channelId,
  );
  const handoffs: HandoffEvent[] = [...eventHandoffs, ...firstClassHandoffs];
  if (d365Handoff) {
    // Dedupe: prefer the first-class `handoff` activity over the synthesized
    // LCW event when both fire within ~2s (some Voice/LCW transcripts have
    // both signals). The first-class activity carries richer context.
    const dup = firstClassHandoffs.some(
      (h) => Math.abs(h.timestamp - d365Handoff.timestamp) <= 2,
    );
    if (!dup) handoffs.push(d365Handoff);
  }
  handoffs.sort((a, b) => a.timestamp - b.timestamp);
  const hasHandoff = handoffs.length > 0;

  const { context: omnichannelContext, visitor: authenticatedVisitor } =
    extractOmnichannelContext(rawActivities);
  const voiceContext = extractVoiceContext(rawActivities);
  const endOfConversation = extractEndOfConversation(rawActivities);
  const prrSurvey = extractPrrSurvey(rawActivities);
  const planExecutions = extractPlanExecutions(rawActivities);

  return {
    conversationtranscriptid: record.conversationtranscriptid,
    name: record.name ?? "",
    createdon: record.createdon ?? "",
    conversationstarttime: record.conversationstarttime,
    metadata: meta,
    schematype: record.schematype ?? "",
    schemaversion: record.schemaversion ?? "",
    activities,
    messages,
    planSteps,
    reactions,
    conversationInfo,
    sessionInfo,
    mcpServerInit,
    availableTools,
    dialogTraces,
    knowledgeSearches,
    knowledgeResponses,
    knowledgeTrace,
    advancedEvents,
    transcriptType,
    triggerInfo,
    userAadObjectId,
    channelId,
    totalDurationSeconds,
    turnCount: sessionInfo?.turnCount ?? messages.filter((m) => m.role === "user").length,
    hasErrors: advancedEvents.some((e) => e.category === "error" || e.category === "serverError" || e.category === "blocked"),
    globalOutcome: conversationInfo?.lastSessionOutcome ?? sessionInfo?.outcome,
    globalOutcomeReason: conversationInfo?.lastSessionOutcomeReason ?? sessionInfo?.outcomeReason,
    hasFeedback: reactions.length > 0,
    likeCount,
    dislikeCount,
    userAttachmentCount,
    connectedAgentInvocations,
    parentAgentSchemaName,
    parentAgentDisplayName,
    invokedChildAgentSchemaNames: [...new Set(connectedAgentInvocations.map((i) => i.childSchemaName))],
    handoffs,
    hasHandoff,
    omnichannelContext,
    authenticatedVisitor,
    voiceContext,
    endOfConversation,
    prrSurvey,
    planExecutions,
  };
}
