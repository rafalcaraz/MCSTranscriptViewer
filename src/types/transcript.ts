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
  type: "trace" | "event" | "message" | "invoke" | "invokeResponse";
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
  content: Record<string, unknown>;
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
}

export interface DialogTrace {
  actionId: string;
  topicId: string;
  actionType: string;
}

// ── Advanced debug event types ────────────────────────────────────────

export interface AdvancedEvent {
  category: "error" | "variable" | "redirect" | "intent" | "escalation" | "serverError" | "blocked" | "gptAnswer" | "generativeAnswers" | "other";
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

export interface KnowledgeSearchTrace {
  toolId: string;
  knowledgeSources: string[];
  outputKnowledgeSources: string[];
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

export interface KnowledgeTraceInfo {
  completionState: string;
  isKnowledgeSearched: boolean;
  citedKnowledgeSources: string[];
  failedKnowledgeSourcesTypes: string[];
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
}
