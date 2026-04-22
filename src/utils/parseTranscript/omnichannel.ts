import type {
  RawActivity,
  OmnichannelContext,
  AuthenticatedVisitor,
} from "../../types/transcript";

/**
 * Recognized OIDC claim keys on the LCW startConversation event payload.
 * Anything matching one of these is considered PII.
 */
const OIDC_CLAIM_KEYS = new Set([
  "sub",
  "preferred_username",
  "email",
  "given_name",
  "family_name",
  "phone_number",
]);

/**
 * Parse D365 Omnichannel context (browser/device/work item ids) and any
 * authenticated-visitor OIDC claims from the LCW `startConversation` event.
 *
 * The event is emitted by the visitor side (from.role=1) with channelData
 * tags including "OmnichannelContextMessage". Its `value` carries `msdyn_*`
 * fields and, when the LCW is configured for auth, OIDC claims.
 *
 * Returns the id of the source activity so the timeline can suppress its
 * usually-blank message rendering.
 */
export function extractOmnichannelContext(rawActivities: RawActivity[]): {
  context?: OmnichannelContext;
  visitor?: AuthenticatedVisitor;
  sourceActivityId?: string;
} {
  const event = rawActivities.find((a) => a.type === "event" && a.name === "startConversation");
  if (!event || typeof event.value !== "object" || event.value === null) return {};

  const v = event.value as Record<string, unknown>;
  // We only treat it as an Omnichannel context message when the marker is
  // present — guards against unrelated startConversation usage in the future.
  const tags = (event.channelData?.tags as string | undefined) ?? "";
  const isOmnichannel =
    tags.includes("OmnichannelContextMessage") ||
    typeof v["msdyn_liveworkitemid"] === "string" ||
    typeof v["msdyn_ConversationId"] === "string";
  if (!isOmnichannel) return {};

  const str = (k: string): string | undefined => {
    const x = v[k];
    return typeof x === "string" && x.length > 0 ? x : undefined;
  };

  // Linked record array (matched contact / customer record).
  let linkedRecord: { recordId: string; primaryDisplayValue: string } | undefined;
  for (const key of Object.keys(v)) {
    if (!key.startsWith("msdyn_") || !Array.isArray(v[key])) continue;
    const arr = v[key] as Array<{ RecordId?: string; PrimaryDisplayValue?: string }>;
    const first = arr[0];
    if (first && typeof first.RecordId === "string" && typeof first.PrimaryDisplayValue === "string") {
      linkedRecord = { recordId: first.RecordId, primaryDisplayValue: first.PrimaryDisplayValue };
      break;
    }
  }

  const rawMsdyn: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    if (k.startsWith("msdyn_")) rawMsdyn[k] = val;
  }

  const context: OmnichannelContext = {
    liveWorkItemId: str("msdyn_liveworkitemid"),
    conversationId: str("msdyn_ConversationId"),
    sessionId: str("msdyn_sessionid"),
    workstreamId: str("msdyn_WorkstreamId"),
    channelInstanceId: str("msdyn_ChannelInstanceId"),
    locale: str("msdyn_Locale") ?? str("msdyn_localecode"),
    browser: str("msdyn_browser"),
    device: str("msdyn_device"),
    os: str("msdyn_os"),
    linkedRecord,
    raw: rawMsdyn,
  };

  // OIDC claims (only when at least `sub` is present — that's the minimum
  // contract for "authenticated visitor").
  let visitor: AuthenticatedVisitor | undefined;
  if (typeof v["sub"] === "string") {
    const rawClaims: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (OIDC_CLAIM_KEYS.has(k)) rawClaims[k] = val;
    }
    visitor = {
      sub: str("sub"),
      preferredUsername: str("preferred_username"),
      email: str("email"),
      givenName: str("given_name"),
      familyName: str("family_name"),
      phoneNumber: str("phone_number"),
      raw: rawClaims,
    };
  }

  return { context, visitor, sourceActivityId: event.id };
}
