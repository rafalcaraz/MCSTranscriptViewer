import type { RawActivity, AdvancedEvent } from "../types/transcript";

/**
 * Extract advanced debug events from raw activities.
 * These are the "hidden" events not shown in basic mode.
 */
export function extractAdvancedEvents(rawActivities: RawActivity[]): AdvancedEvent[] {
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

    // Intent recognition
    if (typ === "trace" && vtype === "IntentRecognition") {
      const intent = (v.intentName as string) ?? (v.topIntent as string) ?? "?";
      const score = (v.score as number) ?? (v.confidence as number);
      const scoreStr = score != null ? ` (${(score * 100).toFixed(0)}%)` : "";
      events.push({
        category: "intentRecognition",
        label: `Intent: ${intent}${scoreStr}`,
        icon: "🎯",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: v,
      });
    }

    // Node trace data
    if (typ === "trace" && vtype === "NodeTraceData") {
      const nodeId = (v.nodeId as string) ?? (v.actionId as string) ?? "";
      const nodeType = (v.nodeType as string) ?? (v.actionType as string) ?? "";
      const label = nodeType ? `Node: ${nodeType}` : `Node: ${nodeId.split("-")[0] || "?"}`;
      events.push({
        category: "nodeTrace",
        label,
        icon: "📍",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: v,
      });
    }

    // Catch-all: non-message activity types (endOfConversation, conversationUpdate, etc.)
    // and named events not handled elsewhere
    const handledEventNames = new Set([
      "DialogTracing", "DynamicServerInitialize", "DynamicServerToolsList",
      "DynamicPlanReceived", "DynamicPlanReceivedDebug", "DynamicPlanStepTriggered",
      "DynamicPlanStepBindUpdate", "DynamicPlanStepFinished", "DynamicPlanFinished",
      "UniversalSearchToolTraceData", "ResponseGeneratorSupportData",
      "GenerativeAnswersSupportData", "DynamicServerError", "DynamicPlanStepBlocked",
      "startConversation", "DynamicServerInitializeConfirmation",
    ]);
    const handledTraceTypes = new Set([
      "ConversationInfo", "SessionInfo", "ErrorTraceData", "VariableAssignment",
      "DialogRedirect", "UnknownIntent", "GPTAnswer", "HandOff", "EscalationRequested",
      "KnowledgeTraceData", "IntentRecognition", "NodeTraceData",
    ]);

    const isUnhandledActivityType = (typ === "endOfConversation" || typ === "conversationUpdate" || typ === "installationUpdate");
    const isUnhandledEvent = typ === "event" && name && !handledEventNames.has(name);
    const isUnhandledTrace = typ === "trace" && vtype && !handledTraceTypes.has(vtype);

    if (isUnhandledActivityType || isUnhandledEvent || isUnhandledTrace) {
      const actLabel = isUnhandledActivityType
        ? typ
        : name || vtype || typ;
      events.push({
        category: "activity",
        label: actLabel,
        icon: "📋",
        timestamp: a.timestamp,
        replyToId: a.replyToId,
        details: typeof v === "object" && Object.keys(v).length > 0 ? v : { type: typ, name, valueType: vtype },
      });
    }
  }

  events.sort((a, b) => a.timestamp - b.timestamp);
  return events;
}
