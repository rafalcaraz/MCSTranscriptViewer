import type {
  RawActivity,
  ParsedActivity,
  ParsedActivityType,
  PlanStep,
  ConversationInfo,
  SessionInfo,
  ToolDefinition,
  DialogTrace,
  TranscriptType,
  MessageAttachment,
} from "../../types/transcript";
import { classifyAttachments } from "./attachments";

/**
 * Classify transcript type based on channel, metadata, and channelData signals.
 * Priority: autonomous > design > chat
 *
 * Note: "evaluation" type is disabled until we have a confirmed signal to
 * distinguish eval runs from test pane sessions. Both inject testMode+enableDiagnostics.
 */
export function classifyTranscriptType(
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

export function classifyActivity(raw: RawActivity): ParsedActivityType {
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

export function parseActivity(raw: RawActivity): ParsedActivity {
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

export function mergePlanSteps(activities: ParsedActivity[]): PlanStep[] {
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
