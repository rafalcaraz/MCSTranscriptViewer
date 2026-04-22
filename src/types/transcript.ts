// Parsed types for Copilot Studio conversation transcripts

/** Role: 0 = bot, 1 = user */
export type ActivityRole = 0 | 1;

export interface ActivityFrom {
  id: string;
  role: ActivityRole;
  aadObjectId?: string;
}

// ── Raw activity (as stored in content JSON) ──────────────────────────

export interface RawActivity {
  id?: string;
  type: "trace" | "event" | "message" | "invoke" | "invokeResponse" | "endOfConversation" | "conversationUpdate" | "installationUpdate" | "handoff";
  timestamp: number;
  from: ActivityFrom;
  name?: string;
  channelId?: string;
  textFormat?: string;
  text?: string;
  attachments?: unknown[];
  replyToId?: string;
  speak?: string;
  channelData?: Record<string, unknown>;
  value?: unknown;
  valueType?: string;
}

// ── Parsed / structured types ─────────────────────────────────────────

export interface ConversationInfo {
  lastSessionOutcome: string;
  lastSessionOutcomeReason: string;
  isDesignMode: boolean;
  locale: string;
}

export interface SessionInfo {
  startTimeUtc: string;
  endTimeUtc: string;
  type: string;
  outcome: string;
  turnCount: number;
  impliedSuccess: boolean;
  outcomeReason: string;
}

export interface McpServerInfo {
  name: string;
  version: string;
  dialogSchemaName: string;
}

export interface ToolDefinition {
  displayName: string;
  description: string;
  identifier: string;
  inputs: {
    name: string;
    description: string;
    isRequired?: boolean;
  }[];
}

export interface PlanStep {
  planIdentifier: string;
  stepId: string;
  taskDialogId: string;
  thought: string;
  state: number | string;
  type?: string;
  arguments?: Record<string, string>;
  observation?: string;
  executionTime?: string;
  replyToId?: string;
}

export interface MessageAttachment {
  contentType: string;
  /** Can be a string (e.g. text/html) or a structured object (cards, file refs) */
  content: Record<string, unknown> | string;
}

/**
 * Classification of what a user or bot attached to a message.
 * - "paste": image/file embedded inline (e.g. drag-drop into Teams composer,
 *   paste from clipboard/webpage). Detected via sibling text/html with <img>
 *   or a wildcard mime like "image/*".
 * - "upload": actual file picked from the user's device. Detected via a
 *   specific mime (image/png, application/pdf, ...) with no inline HTML.
 * - "card": a bot-sent Adaptive/OAuth/Hero/etc. card (vnd.microsoft.card.*).
 *   Not user content; surface differently.
 * - "file": non-image file (PDF, DOCX, etc.).
 * - "unknown": has attachments but we can't classify.
 */
export type AttachmentKind = "paste" | "upload" | "card" | "file" | "unknown";

export interface AttachmentItem {
  kind: AttachmentKind;
  contentType: string;
  /** e.g. "image/png", "image", "Adaptive Card" — short label for chips */
  label: string;
  /** Alt text or page title extracted from inline HTML, if any */
  altText?: string;
  width?: number;
  height?: number;
  /** conversationFileReference GUID, when present */
  referenceId?: string;
}

export interface AttachmentSummary {
  /** Aggregate kind — if all items share a kind, use it; else "unknown" */
  kind: AttachmentKind;
  items: AttachmentItem[];
}

/**
 * Identity of the agent that authored a bot message.
 * In multi-agent (connected agent) transcripts, all bot messages share the
 * parent agent's `from.id`. We infer the actual speaker by tracking
 * ConnectedAgentInitializeTraceData / ConnectedAgentCompletedTraceData
 * boundaries and tagging each bot message with the topmost active agent.
 */
export interface SpeakingAgent {
  /** Raw schema name, e.g. "msftcsa_HelpDeskAgent" */
  schemaName: string;
  /** Pretty display name, e.g. "Help Desk Agent" */
  displayName: string;
  /** True if this is a connected child agent; false if it is the root parent */
  isChild: boolean;
}

export interface ChatMessage {
  id: string;
  timestamp: number;
  from: ActivityFrom;
  role: "user" | "bot";
  text: string;
  textFormat?: string;
  replyToId?: string;
  attachments?: MessageAttachment[];
  attachmentSummary?: AttachmentSummary;
  /** For bot messages in multi-agent transcripts, identifies the speaking agent. */
  speakingAgent?: SpeakingAgent;
}

export interface DialogTrace {
  actionId: string;
  topicId: string;
  actionType: string;
}

// ── Advanced debug event types ────────────────────────────────────────

export interface AdvancedEvent {
  category: "error" | "variable" | "redirect" | "intent" | "escalation" | "serverError" | "blocked" | "gptAnswer" | "generativeAnswers" | "intentRecognition" | "nodeTrace" | "activity" | "other";
  label: string;
  icon: string;
  timestamp: number;
  replyToId?: string;
  details: Record<string, unknown>;
}

export interface Reaction {
  reaction: "like" | "dislike";
  feedbackText: string;
  replyToId: string;
  timestamp: number;
  fromAadObjectId?: string;
  isOrphan: boolean;
}

export interface SearchResult {
  name: string;
  text: string;
  fileType: string;
  sourceId: string;
}

export interface KnowledgeSearchTrace {
  toolId: string;
  knowledgeSources: string[];
  outputKnowledgeSources: string[];
  searchResults: SearchResult[];
  replyToId?: string;
}

export interface KnowledgeResponse {
  query: string;
  rewrittenQuery: string;
  response: string;
  completionState: string;
  citations: { id: string; text: string }[];
  replyToId?: string;
}

/**
 * One invocation of a connected (child) agent by a parent agent.
 * Built from a matching pair of ConnectedAgentInitializeTraceData /
 * ConnectedAgentCompletedTraceData events, linked back to the
 * triggering DynamicPlanStepTriggered (via planStepId) for the `thought`.
 */
export interface ConnectedAgentInvocation {
  /** Raw schema name of the parent agent (e.g. "msftcsa_MainITAgent") */
  parentSchemaName: string;
  /** Raw schema name of the child agent (e.g. "msftcsa_HelpDeskAgent") */
  childSchemaName: string;
  /** Pretty display name for the child agent */
  childDisplayName: string;
  /** Pretty display name for the parent agent */
  parentDisplayName: string;
  /** planStepId from the triggering DynamicPlanStepTriggered, when known */
  planStepId?: string;
  /** Planner's reasoning for choosing this child, when present */
  thought?: string;
  /** Timestamp of the Initialize event */
  startTimestamp: number;
  /** Timestamp of the Completed event (or last event in window if missing) */
  endTimestamp: number;
  /** Ids of bot ChatMessages that fall within this invocation window */
  messageIds: string[];
}

export interface KnowledgeTraceInfo {
  completionState: string;
  isKnowledgeSearched: boolean;
  citedKnowledgeSources: string[];
  failedKnowledgeSourcesTypes: string[];
}

/**
 * A bot-emitted handoff event signaling that the conversation context
 * is being passed to an external system (Genesys, Salesforce, ServiceNow,
 * a live agent platform, etc.).
 *
 * Detected on any activity with type="event", from.role=0, and a name
 * ending in "Handoff" / "HandOff" (case-insensitive). The provider name
 * is parsed out of the prefix (e.g. "GenesysHandoff" → provider "Genesys").
 *
 * The `value` payload is provider-specific — commonly a text summary, but
 * may also be a JSON object, number, boolean, etc. We preserve it as-is
 * and let the UI render polymorphically.
 */
export interface HandoffEvent {
  /** Original event id, when present */
  id?: string;
  /** Full event name, e.g. "GenesysHandoff", "LiveAgentHandoff" */
  eventName: string;
  /** Provider portion derived from the event name (e.g. "Genesys"), or "Unknown" */
  provider: string;
  /** Activity timestamp (epoch seconds) */
  timestamp: number;
  /** ms-precision timestamp when present */
  timestampMs?: number;
  /** id of the user/bot message this event responds to, when present */
  replyToId?: string;
  /** Raw payload — string | number | boolean | object | array | null */
  value: unknown;
  /** Convenience: true if value is a non-empty string */
  isValueString: boolean;
  /** Convenience: true if value is an object/array */
  isValueStructured: boolean;
}

/**
 * D365 Omnichannel context attached to LCW (Live Chat Widget) sessions.
 * Extracted from the `startConversation` event payload (msdyn_* fields).
 *
 * All fields are optional — older or differently-configured sessions may
 * include only a subset.
 */
export interface OmnichannelContext {
  /** D365 work item GUID — primary identifier in Omnichannel for Customer Service. */
  liveWorkItemId?: string;
  /** Conversation GUID, usually equal to liveWorkItemId. */
  conversationId?: string;
  /** Session GUID (one work item can have multiple sessions). */
  sessionId?: string;
  /** Workstream GUID (queue / routing config). */
  workstreamId?: string;
  /** Channel instance GUID. */
  channelInstanceId?: string;
  /** Locale, e.g. "en-US". */
  locale?: string;
  /** Visitor browser, e.g. "Edge", "Chrome". */
  browser?: string;
  /** Device type, e.g. "Desktop", "Mobile". */
  device?: string;
  /** OS, e.g. "Windows", "macOS". */
  os?: string;
  /** Linked record info (e.g. matched contact display value) when present. */
  linkedRecord?: { recordId: string; primaryDisplayValue: string };
  /** Raw msdyn_* payload preserved for advanced inspection. */
  raw: Record<string, unknown>;
}

/**
 * OIDC claims about an authenticated visitor, when the LCW session is
 * configured for authentication. Extracted from the same `startConversation`
 * event payload as OmnichannelContext.
 *
 * All fields are optional — depends on which scopes/claims the relying
 * party requested. Treat the entire object as PII.
 */
export interface AuthenticatedVisitor {
  /** OIDC subject identifier (stable user id). */
  sub?: string;
  /** OIDC preferred_username (often UPN/email). */
  preferredUsername?: string;
  /** OIDC email claim. */
  email?: string;
  /** OIDC given_name (first name). */
  givenName?: string;
  /** OIDC family_name (last name). */
  familyName?: string;
  /** OIDC phone_number. */
  phoneNumber?: string;
  /** Raw payload of recognized OIDC claims, preserved for advanced inspection. */
  raw: Record<string, unknown>;
}

// ── Unified activity union ────────────────────────────────────────────

export type ParsedActivityType =
  | "conversationInfo"
  | "sessionInfo"
  | "message"
  | "dialogTrace"
  | "mcpServerInit"
  | "toolsList"
  | "planReceived"
  | "planStepTriggered"
  | "planStepBindUpdate"
  | "planStepFinished"
  | "planFinished"
  | "reaction"
  | "knowledgeSearch"
  | "knowledgeResponse"
  | "knowledgeTrace"
  | "unknown";

export interface ParsedActivity {
  type: ParsedActivityType;
  timestamp: number;
  raw: RawActivity;
  // Populated depending on type:
  conversationInfo?: ConversationInfo;
  sessionInfo?: SessionInfo;
  message?: ChatMessage;
  dialogTrace?: DialogTrace;
  reaction?: Reaction;
  knowledgeSearch?: KnowledgeSearchTrace;
  knowledgeResponse?: KnowledgeResponse;
  knowledgeTrace?: KnowledgeTraceInfo;
  mcpServerInit?: McpServerInfo;
  toolsList?: ToolDefinition[];
  planStep?: PlanStep;
}

// ── Transcript classification ─────────────────────────────────────────

export type TranscriptType = "chat" | "autonomous" | "evaluation" | "design";

// ── Trigger info (autonomous transcripts) ─────────────────────────────

export interface TriggerInfo {
  flowId: string;
  flowRunId: string;
  triggerDisplayName: string;
  connectorDisplayName: string;
  connectorIconUri?: string;
}

// ── Aggregated transcript ─────────────────────────────────────────────

export interface TranscriptMetadata {
  botId: string;
  botName: string;
  aadTenantId: string;
}

export interface ParsedTranscript {
  // From Dataverse record fields
  conversationtranscriptid: string;
  name: string;
  createdon: string;
  conversationstarttime: string;
  metadata: TranscriptMetadata;
  schematype: string;
  schemaversion: string;

  // Parsed from content
  activities: ParsedActivity[];
  messages: ChatMessage[];
  planSteps: PlanStep[];
  reactions: Reaction[];
  conversationInfo?: ConversationInfo;
  sessionInfo?: SessionInfo;
  mcpServerInit?: McpServerInfo;
  availableTools: ToolDefinition[];
  dialogTraces: DialogTrace[];
  knowledgeSearches: KnowledgeSearchTrace[];
  knowledgeResponses: KnowledgeResponse[];
  knowledgeTrace?: KnowledgeTraceInfo;
  advancedEvents: AdvancedEvent[];

  // Computed
  transcriptType: TranscriptType;
  triggerInfo?: TriggerInfo;
  userAadObjectId?: string;
  channelId?: string;
  totalDurationSeconds?: number;
  turnCount: number;
  hasErrors: boolean;
  globalOutcome?: string;
  globalOutcomeReason?: string;
  hasFeedback: boolean;
  likeCount: number;
  dislikeCount: number;
  /** Number of user-sent messages that contained a non-card attachment (paste/upload/file). */
  userAttachmentCount: number;
  /** All connected-agent invocations, in chronological order. Empty for single-agent transcripts. */
  connectedAgentInvocations: ConnectedAgentInvocation[];
  /** Pretty display name for the root/parent agent, when known (from connected-agent traces). */
  parentAgentDisplayName?: string;
  /** Raw schema name for the root/parent agent, when known. */
  parentAgentSchemaName?: string;
  /**
   * All recognized handoff events for this transcript, in chronological order.
   * Includes both:
   *   - Bot-emitted custom *Handoff events (e.g. GenesysHandoff, SalesforceHandoff)
   *   - Synthesized D365 Omnichannel handoffs (provider="D365 Omnichannel")
   *     when the trace+outcome+channel rule confirms a real LCW handoff.
   */
  handoffs: HandoffEvent[];
  /**
   * True when this transcript involved any handoff to a human/external system.
   * Equivalent to `handoffs.length > 0` — handoffs is the single source of truth.
   */
  hasHandoff: boolean;
  /** D365 Omnichannel session context, when the LCW startConversation event is present. */
  omnichannelContext?: OmnichannelContext;
  /** OIDC claims for an authenticated visitor, when present in the LCW session. */
  authenticatedVisitor?: AuthenticatedVisitor;
  /** Distinct child agent schema names this transcript invoked (derived from connectedAgentInvocations). */
  invokedChildAgentSchemaNames: string[];
}
