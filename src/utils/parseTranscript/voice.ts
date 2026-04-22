import type { RawActivity, VoiceContext } from "../../types/transcript";

/**
 * Parse D365 Voice Channel context from the `pvaSetContext` event — the
 * voice equivalent of LCW's `startConversation`. Carries the IVR + telephony
 * state for a phone call routed through Microsoft's Nuance-powered speech
 * stack to a Copilot Studio agent.
 *
 * Detection: `type === "event"` + `name === "pvaSetContext"`. We don't
 * gate on channelId because the event itself is the strongest signal —
 * channelId may be set per-activity, and this event consistently appears
 * on conversationconductor sessions.
 *
 * Returns `undefined` (not a partial) when no pvaSetContext event is found,
 * so the panel can be conditionally rendered with a single truthy check.
 */
export function extractVoiceContext(rawActivities: RawActivity[]): VoiceContext | undefined {
  const event = rawActivities.find(
    (a) => a.type === "event" && a.name === "pvaSetContext",
  );
  if (!event || typeof event.value !== "object" || event.value === null) return undefined;

  const v = event.value as Record<string, unknown>;
  const channelData = (event.channelData ?? {}) as Record<string, unknown>;

  const str = (obj: Record<string, unknown>, k: string): string | undefined => {
    const x = obj[k];
    return typeof x === "string" && x.length > 0 ? x : undefined;
  };

  const rawMsdyn: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (k.startsWith("msdyn_")) rawMsdyn[k] = val;
  }

  // TTS voice config lives under channelData["vnd.microsoft.msdyn.oc.data"].voices
  // — locale-keyed map of { voiceName, speakingSpeed, pitch, voiceStyle }.
  let voices: VoiceContext["voices"];
  const ocData = channelData["vnd.microsoft.msdyn.oc.data"];
  if (ocData && typeof ocData === "object") {
    const voicesObj = (ocData as Record<string, unknown>).voices;
    if (voicesObj && typeof voicesObj === "object") {
      voices = voicesObj as VoiceContext["voices"];
    }
  }

  // Nuance speech session — present in either nuanceCreateGrpcState or
  // nuanceUpdateGrpcState (whichever arrived first wins for the SessionId).
  let nuanceSessionId: string | undefined;
  for (const key of ["nuanceCreateGrpcState", "nuanceUpdateGrpcState"]) {
    const blob = channelData[key];
    if (blob && typeof blob === "object") {
      const sid = (blob as Record<string, unknown>).SessionId;
      if (typeof sid === "string" && sid.length > 0) {
        nuanceSessionId = sid;
        break;
      }
    }
  }

  return {
    liveWorkItemId: str(v, "msdyn_ocliveworkitemid") ?? str(v, "msdyn_OcLiveWorkItemId"),
    conversationId: str(v, "msdyn_ConversationId"),
    sessionId: str(v, "msdyn_sessionid") ?? str(v, "msdyn_SessionId"),
    organizationPhone:
      str(v, "msdyn_OrganizationPhone") ?? str(v, "OrganizationPhoneNumber"),
    customerPhone:
      str(v, "msdyn_CustomerPhone") ?? str(v, "CustomerPhoneNumber"),
    locale: str(v, "msdyn_Locale") ?? str(v, "msdyn_localecode"),
    channelSpecifier: str(channelData, "ChannelSpecifier"),
    voices,
    endConversationReason: str(channelData, "EndConversationReason"),
    nuanceSessionId,
    raw: rawMsdyn,
    rawChannelData: channelData,
  };
}
