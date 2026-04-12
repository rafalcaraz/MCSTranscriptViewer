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
} from "../types/transcript";
import { extractAdvancedEvents } from "./advancedEvents";

// Re-export formatters for backward compatibility
export { formatTimestamp, formatDuration, shortToolName } from "./formatters";

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

      const attachments: { contentType: string; content: Record<string, unknown> }[] = [];
      if (raw.attachments && Array.isArray(raw.attachments)) {
        for (const att of raw.attachments as { contentType?: string; content?: Record<string, unknown> }[]) {
          if (att.contentType && att.content) {
            attachments.push({ contentType: att.contentType, content: att.content });
          }
        }
      }

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
  };
}
