import type {
  RawActivity,
  ChatMessage,
  ConnectedAgentInvocation,
} from "../../types/transcript";

/**
 * Pretty-format a Copilot Studio agent schema name for display.
 * - Strips the publisher prefix ("msftcsa_", "cr290_", etc.)
 * - Splits CamelCase / PascalCase into separate words
 * - Preserves all-caps acronyms (IT, API, ...)
 *
 * Examples:
 *   "msftcsa_HelpDeskAgent"  -> "Help Desk Agent"
 *   "msftcsa_MainITAgent"    -> "Main IT Agent"
 *   "msftcsa_Cybersecurity"  -> "Cybersecurity"
 */
export function prettyAgentName(schemaName: string): string {
  if (!schemaName) return "";
  const stripped = schemaName.replace(/^[a-z0-9]+_/i, "");
  return stripped
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

interface RawConnectedInit {
  botSchemaName?: string;
  parentBotSchemaName?: string;
  planStepId?: string;
}

interface RawConnectedCompleted {
  connectedAgentBotSchemaName?: string;
  parentBotSchemaName?: string;
}

interface RawPlanStepTriggered {
  stepId?: string;
  thought?: string;
}

/**
 * Walk raw activities chronologically and build:
 *   - A list of ConnectedAgentInvocation records (one per parent→child handoff)
 *   - The root parent agent's schema name (the outermost parent ever seen)
 *
 * Uses a stack so nested invocations (child → grandchild) work correctly,
 * even though we haven't observed them in real transcripts yet.
 */
export function extractConnectedAgentInvocations(rawActivities: RawActivity[]): {
  invocations: ConnectedAgentInvocation[];
  parentSchemaName?: string;
} {
  const sorted = [...rawActivities].sort((a, b) => a.timestamp - b.timestamp);

  const thoughtByStep = new Map<string, string>();
  for (const a of sorted) {
    if (a.type === "event" && a.valueType === "DynamicPlanStepTriggered" && a.value) {
      const v = a.value as RawPlanStepTriggered;
      if (v.stepId && v.thought) thoughtByStep.set(v.stepId, v.thought);
    }
  }

  interface OpenFrame {
    parentSchemaName: string;
    childSchemaName: string;
    planStepId?: string;
    thought?: string;
    startTimestamp: number;
  }

  const stack: OpenFrame[] = [];
  const invocations: ConnectedAgentInvocation[] = [];
  let rootParent: string | undefined;

  for (const a of sorted) {
    if (a.type === "event" && a.valueType === "ConnectedAgentInitializeTraceData" && a.value) {
      const v = a.value as RawConnectedInit;
      if (!v.botSchemaName) continue;
      const parent = v.parentBotSchemaName ?? stack[stack.length - 1]?.childSchemaName ?? "";
      if (!rootParent && v.parentBotSchemaName) rootParent = v.parentBotSchemaName;
      stack.push({
        parentSchemaName: parent,
        childSchemaName: v.botSchemaName,
        planStepId: v.planStepId,
        thought: v.planStepId ? thoughtByStep.get(v.planStepId) : undefined,
        startTimestamp: a.timestamp,
      });
    } else if (a.type === "event" && a.valueType === "ConnectedAgentCompletedTraceData" && a.value) {
      const v = a.value as RawConnectedCompleted;
      let popIdx = stack.length - 1;
      if (v.connectedAgentBotSchemaName) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].childSchemaName === v.connectedAgentBotSchemaName) {
            popIdx = i;
            break;
          }
        }
      }
      if (popIdx < 0 || popIdx >= stack.length) continue;
      const frame = stack.splice(popIdx, 1)[0];
      invocations.push({
        parentSchemaName: frame.parentSchemaName,
        childSchemaName: frame.childSchemaName,
        parentDisplayName: prettyAgentName(frame.parentSchemaName),
        childDisplayName: prettyAgentName(frame.childSchemaName),
        planStepId: frame.planStepId,
        thought: frame.thought,
        startTimestamp: frame.startTimestamp,
        endTimestamp: a.timestamp,
        messageIds: [],
      });
    }
  }

  if (stack.length > 0) {
    const lastTs = sorted[sorted.length - 1]?.timestamp ?? 0;
    for (const frame of stack) {
      invocations.push({
        parentSchemaName: frame.parentSchemaName,
        childSchemaName: frame.childSchemaName,
        parentDisplayName: prettyAgentName(frame.parentSchemaName),
        childDisplayName: prettyAgentName(frame.childSchemaName),
        planStepId: frame.planStepId,
        thought: frame.thought,
        startTimestamp: frame.startTimestamp,
        endTimestamp: lastTs,
        messageIds: [],
      });
    }
  }

  invocations.sort((a, b) => a.startTimestamp - b.startTimestamp);
  return { invocations, parentSchemaName: rootParent };
}

/**
 * For each bot message, determine which agent (parent or child) was speaking
 * at that moment, and tag the message in-place with `speakingAgent`.
 */
export function tagMessagesWithSpeakingAgent(
  messages: ChatMessage[],
  invocations: ConnectedAgentInvocation[],
  parentSchemaName: string | undefined,
): void {
  if (invocations.length === 0) return;
  const parentDisplay = parentSchemaName ? prettyAgentName(parentSchemaName) : "Parent Agent";

  for (const msg of messages) {
    if (msg.role !== "bot") continue;
    let chosen: ConnectedAgentInvocation | undefined;
    for (const inv of invocations) {
      if (msg.timestamp >= inv.startTimestamp && msg.timestamp <= inv.endTimestamp) {
        if (!chosen || inv.startTimestamp >= chosen.startTimestamp) chosen = inv;
      }
    }
    if (chosen) {
      msg.speakingAgent = {
        schemaName: chosen.childSchemaName,
        displayName: chosen.childDisplayName,
        isChild: true,
      };
      chosen.messageIds.push(msg.id);
    } else if (parentSchemaName) {
      msg.speakingAgent = {
        schemaName: parentSchemaName,
        displayName: parentDisplay,
        isChild: false,
      };
    }
  }
}
