import type { RawActivity, HandoffEvent } from "../../types/transcript";

/**
 * Detect bot-emitted handoff events (any activity with type="event",
 * from.role=0, and a name ending in "Handoff" / "HandOff").
 *
 * Provider-agnostic: matches GenesysHandoff, SalesforceHandoff,
 * LiveAgentHandoff, ServiceNowHandoff, etc. without a hard-coded list.
 */
export function extractHandoffEvents(rawActivities: RawActivity[]): HandoffEvent[] {
  const handoffs: HandoffEvent[] = [];
  for (const a of rawActivities) {
    if (a.type !== "event") continue;
    if (a.from?.role !== 0) continue;
    const name = a.name ?? "";
    if (!/handoff$/i.test(name)) continue;

    const provider = name.replace(/handoff$/i, "").trim() || "Unknown";
    const value = a.value;
    handoffs.push({
      id: a.id,
      eventName: name,
      provider,
      timestamp: a.timestamp,
      replyToId: a.replyToId,
      value,
      isValueString: typeof value === "string" && value.length > 0,
      isValueStructured: typeof value === "object" && value !== null,
    });
  }
  handoffs.sort((a, b) => a.timestamp - b.timestamp);
  return handoffs;
}

/**
 * Synthesize a HandoffEvent from D365 Omnichannel trace+outcome signaling.
 *
 * D365 LCW doesn't emit a *Handoff *event* — instead it emits a `HandOff`
 * *trace* (often duplicated), and the SessionInfo records `outcome="HandOff"`.
 * The platform's built-in PVA Escalate topic emits the same `HandOff` trace
 * even when escalation isn't configured, so the trace alone is unreliable.
 *
 * We treat it as a real handoff only when ALL three signals align:
 *   1. SessionInfo / ConversationInfo `outcome === "HandOff"`
 *   2. `outcomeReason` is one of:
 *        - starts with "AgentTransferRequestedBy"   (user/bot explicitly asked)
 *        - "AgentTransferConfiguredByAuthor"        (transfer node ran in topic flow)
 *      We exclude system bailouts like AgentTransferFromQuestionMaxAttempts.
 *   3. `channelId === "lcw"` (channel actually wired to a human queue)
 *
 * Returns at most ONE event (uses the first HandOff trace; D365 typically
 * emits 2 in immediate succession). The event's `value` is the bot's
 * preceding message text when found, otherwise an object summarizing the
 * outcome reason.
 */
export function synthesizeD365LcwHandoff(
  rawActivities: RawActivity[],
  outcome: string | undefined,
  outcomeReason: string | undefined,
  channelId: string | undefined,
): HandoffEvent | null {
  const reason = outcomeReason ?? "";
  const reasonOk =
    reason.startsWith("AgentTransferRequestedBy") ||
    reason === "AgentTransferConfiguredByAuthor";
  const isReal =
    (outcome ?? "").toLowerCase() === "handoff" &&
    reasonOk &&
    channelId === "lcw";
  if (!isReal) return null;

  const handoffTrace = rawActivities.find(
    (a) => a.type === "trace" && (a.valueType === "HandOff" || a.valueType === "Handoff"),
  );
  if (!handoffTrace) return null;

  // Find the bot message immediately preceding the HandOff trace (the
  // "I am transferring you to a representative…" message). We attach the
  // synthesized event to that message so it renders inline in the timeline.
  const idx = rawActivities.indexOf(handoffTrace);
  let botMessage: string | undefined;
  let botMessageId: string | undefined;
  for (let i = idx - 1; i >= 0; i--) {
    const a = rawActivities[i];
    if (a.type === "message" && a.from?.role === 0 && typeof a.text === "string" && a.text.trim()) {
      botMessage = a.text;
      botMessageId = a.id;
      break;
    }
  }

  const value: Record<string, unknown> = {
    outcome: "HandOff",
    outcomeReason: outcomeReason!,
    channel: "lcw",
  };
  if (botMessage) value.transferMessage = botMessage;

  return {
    id: handoffTrace.id,
    eventName: "D365OmnichannelHandoff",
    provider: "D365 Omnichannel",
    timestamp: handoffTrace.timestamp,
    replyToId: botMessageId ?? handoffTrace.replyToId,
    value,
    isValueString: false,
    isValueStructured: true,
  };
}

/**
 * Detect first-class Bot Framework `handoff` activities — the cleanest
 * cross-provider transfer signal. Emitted by Copilot Studio (pva-studio,
 * pva-autonomous) and D365 Voice (conversationconductor) when an author-
 * configured agent transfer fires; carries `value.type === "transferToAgent"`.
 *
 * This activity is NOT emitted by the OOB PVA Escalate system topic — that
 * one only emits the `HandOff` *trace*, which is the false-positive trap
 * the LCW synthesizer guards against. So matching the activity itself is
 * self-validating: if it's there, the transfer is real.
 *
 * Provider naming preference:
 *   1. value.context.va_BotName / value.context.botName (if present)
 *   2. Channel-derived label ("D365 Voice Channel" / "Copilot Studio")
 *   3. "Live agent" fallback
 */
export function extractFirstClassHandoffActivities(
  rawActivities: RawActivity[],
  channelId?: string,
): HandoffEvent[] {
  const handoffs: HandoffEvent[] = [];
  for (const a of rawActivities) {
    if (a.type !== "handoff") continue;
    if (a.from?.role !== 0) continue;

    const value = a.value;
    const valueObj =
      typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
    if (valueObj && typeof valueObj.type === "string" && valueObj.type !== "transferToAgent") {
      continue;
    }

    const context =
      valueObj && typeof valueObj.context === "object" && valueObj.context !== null
        ? (valueObj.context as Record<string, unknown>)
        : null;
    const ctxBotName =
      (context?.va_BotName as string | undefined) ??
      (context?.botName as string | undefined);

    let provider: string;
    if (ctxBotName && ctxBotName.trim()) {
      provider = ctxBotName.trim();
    } else if (channelId === "conversationconductor") {
      provider = "D365 Voice Channel";
    } else if (channelId === "pva-studio" || channelId === "pva-autonomous") {
      provider = "Copilot Studio";
    } else {
      provider = "Live agent";
    }

    handoffs.push({
      id: a.id,
      eventName: "handoff",
      provider,
      timestamp: a.timestamp,
      replyToId: a.replyToId,
      value,
      isValueString: typeof value === "string" && value.length > 0,
      isValueStructured: typeof value === "object" && value !== null,
    });
  }
  handoffs.sort((a, b) => a.timestamp - b.timestamp);
  return handoffs;
}
