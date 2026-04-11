import type {
  RawActivity,
  ParsedActivity,
  ParsedActivityType,
  ParsedTranscript,
  PlanStep,
  Reaction,
  AdvancedEvent,
  ConversationInfo,
  SessionInfo,
  ToolDefinition,
  DialogTrace,
  TranscriptMetadata,
} from "../types/transcript";

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

      // Parse attachments
      const attachments: { contentType: string; content: Record<string, unknown> }[] = [];
      if (raw.attachments && Array.isArray(raw.attachments)) {
        for (const att of raw.attachments as { contentType?: string; content?: Record<string, unknown> }[]) {
          if (att.contentType && att.content) {
            attachments.push({ contentType: att.contentType, content: att.content });
          }
        }
      }

      // If no text, determine what to show based on attachments
      if (!text && attachments.length > 0) {
        const firstAtt = attachments[0];
        if (firstAtt.contentType === "application/vnd.microsoft.card.adaptive") {
          textFormat = "adaptive-card";
        } else if (firstAtt.contentType === "application/vnd.microsoft.card.oauth") {
          textFormat = "oauth-card";
        }
      }

      // Empty user messages are button clicks / invoke actions
      if (!text && attachments.length === 0 && raw.from.role === 1) {
        text = "⚡ [User action]";
        textFormat = "system";
      }

      // Empty bot messages with no attachments — likely a redacted knowledge response (SharePoint security)
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
        initializationResult?: {
          serverInfo?: { name: string; version: string };
        };
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

      // Handle both feedback formats: object (pva-studio) vs JSON string (Teams)
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
        isOrphan: false, // Will be set later in parseTranscript
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

/**
 * Merge plan step events (triggered → bind → finished) into unified PlanStep objects.
 */
function mergePlanSteps(activities: ParsedActivity[]): PlanStep[] {
  const stepMap = new Map<string, PlanStep>();

  for (const a of activities) {
    if (!a.planStep) continue;
    const key = a.planStep.stepId;
    const existing = stepMap.get(key);
    if (!existing) {
      stepMap.set(key, { ...a.planStep });
    } else {
      // Merge fields
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

/**
 * Extract advanced debug events from raw activities.
 * These are the "hidden" events not shown in basic mode.
 */
function extractAdvancedEvents(rawActivities: RawActivity[]): AdvancedEvent[] {
  const events: AdvancedEvent[] = [];

  for (const a of rawActivities) {
    const typ = a.type;
    const name = a.name ?? "";
    const vtype = a.valueType ?? "";
    const v = (a.value ?? {}) as Record<string, unknown>;

    // Error traces
    if (typ === "trace" && vtype === "ErrorTraceData") {
      events.push({
        category: "error",
        label: `Error: ${(v.errorCode as string) ?? "Unknown"}`,
        icon: "🔴",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: {
          errorCode: v.errorCode,
          errorMessage: v.errorMessage,
          errorSubCode: v.errorSubCode,
          isUserError: v.isUserError,
        },
      });
    }

    // MCP server errors
    if (typ === "event" && name === "DynamicServerError") {
      events.push({
        category: "serverError",
        label: `Server Error: ${(v.reasonCode as string) ?? "Unknown"}`,
        icon: "💥",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: {
          reasonCode: v.reasonCode,
          errorMessage: v.errorMessage,
          httpStatusCode: v.HttpStatusCode,
          errorResponse: v.errorResponse,
          dialogSchemaName: v.dialogSchemaName,
        },
      });
    }

    // Plan step blocked (content filtering, etc.)
    if (typ === "event" && name === "DynamicPlanStepBlocked") {
      const blocked = v.messageBlockedError as Record<string, unknown> | undefined;
      events.push({
        category: "blocked",
        label: `Step Blocked: ${(blocked?.code as string) ?? "Unknown"}`,
        icon: "🚫",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: {
          code: blocked?.code,
          message: blocked?.message,
          stepId: v.stepId,
          taskDialogId: v.taskDialogId,
        },
      });
    }

    // Variable assignments (skip noisy system variables)
    if (typ === "trace" && vtype === "VariableAssignment") {
      const varId = (v.id as string) ?? "";
      const noisy = ["Topic.CurrentTime", "Global.CurrentTime", "System."];
      if (!noisy.some((prefix) => varId.startsWith(prefix))) {
        events.push({
          category: "variable",
          label: `${(v.name as string) ?? "?"} = ${JSON.stringify(v.newValue).slice(0, 50)}`,
          icon: "📝",
          timestamp: a.timestamp,
          replyToId: a.replyToId,
          details: {
            name: v.name,
            id: v.id,
            newValue: v.newValue,
            type: v.type,
          },
        });
      }
    }

    // Topic/dialog redirects
    if (typ === "trace" && vtype === "DialogRedirect") {
      events.push({
        category: "redirect",
        label: `Redirect → ${(v.targetDialogId as string)?.split("-")[0] ?? "?"}`,
        icon: "↪️",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: {
          targetDialogId: v.targetDialogId,
          targetDialogType: v.targetDialogType,
        },
      });
    }

    // Unknown intent
    if (typ === "trace" && vtype === "UnknownIntent") {
      events.push({
        category: "intent",
        label: "Unknown Intent — no topic matched",
        icon: "❓",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: v,
      });
    }

    // GPT answer trace
    if (typ === "trace" && vtype === "GPTAnswer") {
      events.push({
        category: "gptAnswer",
        label: `GPT Answer: ${(v.gptAnswerState as string) ?? "?"}`,
        icon: "🤖",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: v,
      });
    }

    // Generative answers support data
    if (typ === "event" && name === "GenerativeAnswersSupportData") {
      events.push({
        category: "generativeAnswers",
        label: `Generative Answers: ${(v.completionState as string) ?? (v.gptAnswerState as string) ?? "?"}`,
        icon: "✨",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: {
          completionState: v.completionState,
          gptAnswerState: v.gptAnswerState,
          searchTerms: v.searchTerms,
          message: v.message,
          rewrittenMessage: v.rewrittenMessage,
        },
      });
    }

    // Escalation / handoff
    if (typ === "trace" && (vtype === "HandOff" || vtype === "EscalationRequested")) {
      events.push({
        category: "escalation",
        label: vtype === "HandOff" ? "Handed off to human agent" : "Escalation requested",
        icon: "🆘",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: v,
      });
    }
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
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

  // Knowledge sources
  const knowledgeSearches = activities
    .filter((a) => a.knowledgeSearch)
    .map((a) => a.knowledgeSearch!);

  const knowledgeResponses = activities
    .filter((a) => a.knowledgeResponse)
    .map((a) => a.knowledgeResponse!);

  const knowledgeTrace = activities.find((a) => a.knowledgeTrace)?.knowledgeTrace;

  // Advanced debug events
  const advancedEvents = extractAdvancedEvents(rawActivities);

  // Find user AAD ID — check user messages first, then startConversation event
  const firstUserMsg = messages.find((m) => m.role === "user");
  const startEvent = rawActivities.find((a) => a.type === "event" && a.name === "startConversation");
  const userAadObjectId =
    firstUserMsg?.from.aadObjectId ??
    startEvent?.from.aadObjectId;

  // Channel from first message
  const channelId = rawActivities.find((a) => a.channelId)?.channelId;

  // Duration from session info
  let totalDurationSeconds: number | undefined;
  if (sessionInfo?.startTimeUtc && sessionInfo?.endTimeUtc) {
    totalDurationSeconds = Math.round(
      (new Date(sessionInfo.endTimeUtc).getTime() -
        new Date(sessionInfo.startTimeUtc).getTime()) /
        1000
    );
  }

  // Parse metadata JSON
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

  // Extract reactions and mark orphans
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

/** Format a unix epoch seconds timestamp to a readable datetime string */
export function formatTimestamp(epoch: number): string {
  return new Date(epoch * 1000).toLocaleString();
}

/** Format a duration in seconds to a human-readable string */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Extract the short tool name from a full taskDialogId like "MCP:schema.topic:tool_name" */
export function shortToolName(taskDialogId: string): string {
  const parts = taskDialogId.split(":");
  return parts[parts.length - 1] ?? taskDialogId;
}
