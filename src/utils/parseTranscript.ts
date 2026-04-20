import type {
  RawActivity,
  ParsedActivity,
  ParsedActivityType,
  ParsedTranscript,
  PlanStep,
  Reaction,
  ConversationInfo,
  SessionInfo,
  ToolDefinition,
  DialogTrace,
  TranscriptMetadata,
  TranscriptType,
  TriggerInfo,
  AttachmentItem,
  AttachmentKind,
  AttachmentSummary,
  MessageAttachment,
} from "../types/transcript";
import { extractAdvancedEvents } from "./advancedEvents";

// Re-export formatters for backward compatibility
export { formatTimestamp, formatDuration, shortToolName } from "./formatters";

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

// ── Attachment classification ────────────────────────────────────────────

const CARD_CT_PREFIX = "application/vnd.microsoft.card.";
const SKYPE_AMS_HOST = "us-api.asm.skype.com";

function cardKindLabel(contentType: string): string {
  // e.g. "application/vnd.microsoft.card.adaptive" -> "Adaptive Card"
  const suffix = contentType.slice(CARD_CT_PREFIX.length);
  if (!suffix) return "Card";
  return suffix.charAt(0).toUpperCase() + suffix.slice(1) + " Card";
}

function shortTypeLabel(contentType: string): string {
  if (contentType === "image/*") return "image";
  if (contentType.startsWith("image/")) return contentType;
  if (contentType === "application/pdf") return "PDF";
  if (contentType.startsWith("application/")) return contentType.slice("application/".length);
  return contentType;
}

interface HtmlImgInfo {
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
}

function firstImgFromHtml(html: string): HtmlImgInfo | undefined {
  // Grab the first <img ...> tag; attributes can appear in any order
  const tagMatch = html.match(/<img\b[^>]*>/i);
  if (!tagMatch) return undefined;
  const tag = tagMatch[0];
  const attr = (name: string) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i"));
    return m ? m[1] : undefined;
  };
  const w = attr("width");
  const h = attr("height");
  return {
    src: attr("src"),
    alt: attr("alt"),
    width: w ? parseInt(w, 10) || undefined : undefined,
    height: h ? parseInt(h, 10) || undefined : undefined,
  };
}

/**
 * Classify attachments on a raw activity into a summary suitable for UI chips.
 * See AttachmentKind JSDoc for heuristic details.
 */
export function classifyAttachments(
  rawAttachments: MessageAttachment[],
): AttachmentSummary | undefined {
  if (!rawAttachments.length) return undefined;

  // Split cards from media/file references. Cards are bot-sent UI and are
  // handled elsewhere (AdaptiveCardRenderer) — don't count them as user content.
  const nonCards: MessageAttachment[] = [];
  const cards: MessageAttachment[] = [];
  let htmlBlob = "";
  for (const a of rawAttachments) {
    if (a.contentType?.startsWith(CARD_CT_PREFIX)) {
      cards.push(a);
    } else if (a.contentType === "text/html" && typeof a.content === "string") {
      htmlBlob += a.content;
    } else if (a.contentType === "text/html" && typeof (a.content as { toString?: () => string }) === "object") {
      // Some clients nest the html as object — best-effort
      htmlBlob += JSON.stringify(a.content);
    } else {
      nonCards.push(a);
    }
  }

  const img = htmlBlob ? firstImgFromHtml(htmlBlob) : undefined;
  const hasSkypeInline = img?.src?.includes(SKYPE_AMS_HOST) ?? false;

  const items: AttachmentItem[] = [];

  for (const a of nonCards) {
    const ct = a.contentType;
    const ref = typeof (a.content as { value?: unknown })?.value === "string"
      ? ((a.content as { value: string }).value)
      : undefined;

    let kind: AttachmentKind;
    if (ct === "image/*" || hasSkypeInline) {
      // Wildcard mime OR we have an inline Skype-hosted <img> → paste
      kind = "paste";
    } else if (ct.startsWith("image/")) {
      // Specific image mime with no inline HTML sibling → uploaded from device
      kind = "upload";
    } else if (ct.startsWith("application/") || ct.startsWith("text/") || ct.startsWith("video/") || ct.startsWith("audio/")) {
      kind = "file";
    } else {
      kind = "unknown";
    }

    items.push({
      kind,
      contentType: ct,
      label: ct.startsWith("image/") ? "image" : shortTypeLabel(ct),
      altText: img?.alt && img.alt !== "image" ? img.alt : undefined,
      width: img?.width,
      height: img?.height,
      referenceId: ref,
    });
  }

  for (const c of cards) {
    items.push({
      kind: "card",
      contentType: c.contentType,
      label: cardKindLabel(c.contentType),
    });
  }

  if (!items.length) return undefined;

  // Aggregate kind: if all items agree, use that; otherwise "unknown"
  const first = items[0].kind;
  const aggregate: AttachmentKind = items.every((i) => i.kind === first) ? first : "unknown";

  return { kind: aggregate, items };
}

/**
 * Classify transcript type based on channel, metadata, and channelData signals.
 * Priority: autonomous > design > chat
 *
 * Note: "evaluation" type is disabled until we have a confirmed signal to
 * distinguish eval runs from test pane sessions. Both inject testMode+enableDiagnostics.
 */
function classifyTranscriptType(
  rawActivities: RawActivity[],
  conversationInfo: ConversationInfo | undefined,
  channelId: string | undefined,
): TranscriptType {
  // Check for autonomous: pva-autonomous channel or triggerTest in any user message
  if (channelId === "pva-autonomous") return "autonomous";
  const hasTriggerTest = rawActivities.some(
    (a) => a.type === "message" && a.from.role === 1 && a.channelData?.triggerTest
  );
  if (hasTriggerTest) return "autonomous";

  // Check for design mode
  if (conversationInfo?.isDesignMode) return "design";

  // TODO: evaluation classification — needs confirmed signal (eval-transcript-sample backlog item)

  return "chat";
}

function classifyActivity(raw: RawActivity): ParsedActivityType {
  if (raw.type === "trace") {
    if (raw.valueType === "ConversationInfo") return "conversationInfo";
    if (raw.valueType === "SessionInfo") return "sessionInfo";
    if (raw.valueType === "KnowledgeTraceData") return "knowledgeTrace";
    return "unknown";
  }
  if (raw.type === "message") return "message";
  if (raw.type === "invoke" && raw.name === "message/submitAction") {
    const val = raw.value as { actionName?: string } | undefined;
    if (val?.actionName === "feedback") return "reaction";
  }
  if (raw.type === "event") {
    switch (raw.name) {
      case "DialogTracing":
        return "dialogTrace";
      case "DynamicServerInitialize":
        return "mcpServerInit";
      case "DynamicServerToolsList":
        return "toolsList";
      case "DynamicPlanReceived":
      case "DynamicPlanReceivedDebug":
        return "planReceived";
      case "DynamicPlanStepTriggered":
        return "planStepTriggered";
      case "DynamicPlanStepBindUpdate":
        return "planStepBindUpdate";
      case "DynamicPlanStepFinished":
        return "planStepFinished";
      case "DynamicPlanFinished":
        return "planFinished";
      case "UniversalSearchToolTraceData":
        return "knowledgeSearch";
      case "ResponseGeneratorSupportData":
        return "knowledgeResponse";
      default:
        return "unknown";
    }
  }
  return "unknown";
}

function parseActivity(raw: RawActivity): ParsedActivity {
  const type = classifyActivity(raw);
  const parsed: ParsedActivity = { type, timestamp: raw.timestamp, raw };

  switch (type) {
    case "conversationInfo": {
      const v = raw.value as ConversationInfo;
      parsed.conversationInfo = v;
      break;
    }
    case "sessionInfo": {
      const v = raw.value as SessionInfo;
      parsed.sessionInfo = v;
      break;
    }
    case "message": {
      let text = raw.text ?? "";
      let textFormat = raw.textFormat;

      const attachments: MessageAttachment[] = [];
      if (raw.attachments && Array.isArray(raw.attachments)) {
        for (const att of raw.attachments as { contentType?: string; content?: unknown }[]) {
          if (att.contentType && att.content != null) {
            attachments.push({
              contentType: att.contentType,
              content: att.content as Record<string, unknown> | string,
            });
          }
        }
      }

      const attachmentSummary = classifyAttachments(attachments);

      if (!text && attachments.length > 0) {
        const firstAtt = attachments[0];
        if (firstAtt.contentType === "application/vnd.microsoft.card.adaptive") {
          textFormat = "adaptive-card";
        } else if (firstAtt.contentType === "application/vnd.microsoft.card.oauth") {
          textFormat = "oauth-card";
        }
      }

      if (!text && attachments.length === 0 && raw.from.role === 1) {
        text = "⚡ [User action]";
        textFormat = "system";
      }

      if (!text && attachments.length === 0 && raw.from.role === 0) {
        text = "🔒 [Response not stored in transcript — may contain knowledge source content]";
        textFormat = "system";
      }

      parsed.message = {
        id: raw.id ?? "",
        timestamp: raw.timestamp,
        from: raw.from,
        role: raw.from.role === 1 ? "user" : "bot",
        text,
        textFormat,
        replyToId: raw.replyToId,
        attachments: attachments.length > 0 ? attachments : undefined,
        attachmentSummary,
      };
      break;
    }
    case "dialogTrace": {
      const v = raw.value as { actions?: DialogTrace[] };
      if (v?.actions?.[0]) {
        parsed.dialogTrace = v.actions[0];
      }
      break;
    }
    case "mcpServerInit": {
      const v = raw.value as {
        initializationResult?: { serverInfo?: { name: string; version: string } };
        dialogSchemaName?: string;
      };
      if (v?.initializationResult?.serverInfo) {
        parsed.mcpServerInit = {
          name: v.initializationResult.serverInfo.name,
          version: v.initializationResult.serverInfo.version,
          dialogSchemaName: v.dialogSchemaName ?? "",
        };
      }
      break;
    }
    case "toolsList": {
      const v = raw.value as { toolsList?: ToolDefinition[] };
      parsed.toolsList = (v?.toolsList ?? []).map((t) => ({
        displayName: t.displayName,
        description: t.description,
        identifier: t.identifier,
        inputs: (t.inputs ?? []).map((i) => ({
          name: i.name,
          description: i.description,
          isRequired: i.isRequired,
        })),
      }));
      break;
    }
    case "planStepTriggered": {
      const v = raw.value as PlanStep;
      parsed.planStep = {
        planIdentifier: v.planIdentifier,
        stepId: v.stepId,
        taskDialogId: v.taskDialogId,
        thought: v.thought,
        state: v.state,
        type: v.type,
        replyToId: raw.replyToId,
      };
      break;
    }
    case "planStepBindUpdate": {
      const v = raw.value as { stepId: string; arguments?: Record<string, string>; planIdentifier: string; taskDialogId: string };
      parsed.planStep = {
        planIdentifier: v.planIdentifier,
        stepId: v.stepId,
        taskDialogId: v.taskDialogId,
        thought: "",
        state: "",
        arguments: v.arguments,
        replyToId: raw.replyToId,
      };
      break;
    }
    case "planStepFinished": {
      const v = raw.value as {
        stepId: string;
        planIdentifier: string;
        taskDialogId: string;
        observation?: { content?: { text?: string }[] };
        executionTime?: string;
        state?: string;
      };
      const obsText = v.observation?.content
        ?.filter((c) => c.text)
        .map((c) => c.text)
        .join("\n") ?? "";
      parsed.planStep = {
        planIdentifier: v.planIdentifier,
        stepId: v.stepId,
        taskDialogId: v.taskDialogId,
        thought: "",
        state: v.state ?? "completed",
        observation: obsText,
        executionTime: v.executionTime,
        replyToId: raw.replyToId,
      };
      break;
    }
    case "reaction": {
      const v = raw.value as { actionValue?: { reaction?: string; feedback?: unknown } };
      const av = v?.actionValue;
      const reactionType = av?.reaction === "like" ? "like" as const : "dislike" as const;

      let feedbackText = "";
      if (av?.feedback) {
        if (typeof av.feedback === "string") {
          try {
            const parsed = JSON.parse(av.feedback) as { feedbackText?: string };
            feedbackText = parsed.feedbackText ?? "";
          } catch {
            feedbackText = av.feedback;
          }
        } else if (typeof av.feedback === "object") {
          feedbackText = (av.feedback as { feedbackText?: string }).feedbackText ?? "";
        }
      }

      parsed.reaction = {
        reaction: reactionType,
        feedbackText,
        replyToId: raw.replyToId ?? "",
        timestamp: raw.timestamp,
        fromAadObjectId: raw.from.aadObjectId,
        isOrphan: false,
      };
      break;
    }
    case "knowledgeSearch": {
      const v = raw.value as { toolId?: string; knowledgeSources?: string[]; outputKnowledgeSources?: string[] };
      parsed.knowledgeSearch = {
        toolId: v?.toolId ?? "",
        knowledgeSources: v?.knowledgeSources ?? [],
        outputKnowledgeSources: v?.outputKnowledgeSources ?? [],
        searchResults: [], // populated later from DynamicPlanStepFinished observations
        replyToId: raw.replyToId,
      };
      break;
    }
    case "knowledgeResponse": {
      const v = raw.value as {
        query?: string; rewritten_query?: string; response?: string;
        completion_state?: string; citations?: { Id?: string; Text?: string }[];
      };
      parsed.knowledgeResponse = {
        query: v?.query ?? "",
        rewrittenQuery: v?.rewritten_query ?? "",
        response: v?.response ?? "",
        completionState: v?.completion_state ?? "",
        citations: (v?.citations ?? []).map((c) => ({ id: c.Id ?? "", text: c.Text ?? "" })),
        replyToId: raw.replyToId,
      };
      break;
    }
    case "knowledgeTrace": {
      const v = raw.value as {
        completionState?: string; isKnowledgeSearched?: boolean;
        citedKnowledgeSources?: string[]; failedKnowledgeSourcesTypes?: string[];
      };
      parsed.knowledgeTrace = {
        completionState: v?.completionState ?? "",
        isKnowledgeSearched: v?.isKnowledgeSearched ?? false,
        citedKnowledgeSources: v?.citedKnowledgeSources ?? [],
        failedKnowledgeSourcesTypes: v?.failedKnowledgeSourcesTypes ?? [],
      };
      break;
    }
    default:
      break;
  }

  return parsed;
}

function mergePlanSteps(activities: ParsedActivity[]): PlanStep[] {
  const stepMap = new Map<string, PlanStep>();

  for (const a of activities) {
    if (!a.planStep) continue;
    const key = a.planStep.stepId;
    const existing = stepMap.get(key);
    if (!existing) {
      stepMap.set(key, { ...a.planStep });
    } else {
      if (a.planStep.thought) existing.thought = a.planStep.thought;
      if (a.planStep.arguments) existing.arguments = a.planStep.arguments;
      if (a.planStep.observation) existing.observation = a.planStep.observation;
      if (a.planStep.executionTime) existing.executionTime = a.planStep.executionTime;
      if (a.planStep.state) existing.state = a.planStep.state;
      if (a.planStep.type) existing.type = a.planStep.type;
      if (a.planStep.replyToId) existing.replyToId = a.planStep.replyToId;
    }
  }

  return Array.from(stepMap.values());
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
  };
}
