import type {
  RawActivity,
  EndOfConversationSignal,
  SurveySignal,
} from "../../types/transcript";

/**
 * Extract a positive signal that the source transcript contained an
 * `endOfConversation` activity. Returns `undefined` when no such activity
 * is present — we deliberately avoid inferring lifecycle endings from
 * absence because Bot Framework treats this activity as optional and many
 * channels (msteams, lcw, pva-studio) skip it entirely. Only voice
 * (`conversationconductor`) and autonomous (`pva-autonomous`) reliably emit it.
 */
export function extractEndOfConversation(
  rawActivities: RawActivity[],
): EndOfConversationSignal | undefined {
  const eoc = rawActivities.find((a) => a.type === "endOfConversation");
  if (!eoc) return undefined;
  const channelData = (eoc.channelData ?? {}) as Record<string, unknown>;
  const reasonRaw = channelData.EndConversationReason;
  return {
    timestamp: eoc.timestamp,
    byRole: eoc.from?.role === 1 ? "user" : "bot",
    reason: typeof reasonRaw === "string" && reasonRaw.length > 0 ? reasonRaw : undefined,
  };
}

/**
 * Extract a Post-Resolution Rating (PRR) survey signal from voice transcripts.
 * Detection: the bot emits a `PRRSurveyRequest` trace; if the caller answered,
 * a `PRRSurveyResponse` trace appears as well. We track presence of both to
 * surface a "survey requested but not answered" state (the IVR rang and the
 * caller hung up before pressing a key).
 */
export function extractPrrSurvey(rawActivities: RawActivity[]): SurveySignal | undefined {
  const request = rawActivities.find(
    (a) => a.type === "trace" && a.valueType === "PRRSurveyRequest",
  );
  if (!request) return undefined;
  const responded = rawActivities.some(
    (a) => a.type === "trace" && a.valueType === "PRRSurveyResponse",
  );
  const value = request.value;
  let surveyType: string | undefined;
  if (value && typeof value === "object") {
    const t = (value as Record<string, unknown>).type;
    if (typeof t === "string" && t.length > 0) surveyType = t;
  }
  return {
    timestamp: request.timestamp,
    type: surveyType,
    responded,
  };
}
