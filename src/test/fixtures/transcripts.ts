import type { DataverseTranscriptRecord } from "../../utils/parseTranscript";

/** Basic transcript — bot greeting + user question + MCP tool call */
export const basicMcpTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-basic-001",
  name: "test_basic_036e624a",
  createdon: "2026-04-07T19:47:01Z",
  conversationstarttime: "2026-04-07T19:12:11Z",
  metadata: '{"BotId":"036e624a-test","AADTenantId":"tenant-test","BotName":"msftcsa_testbot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775589131, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Abandoned", lastSessionOutcomeReason: "UserExit", isDesignMode: true, locale: "en-US" } },
      { id: "start-001", type: "event", timestamp: 1775589131, from: { id: "user-abc", aadObjectId: "aad-user-123", role: 1 }, name: "startConversation", channelId: "pva-studio", attachments: [] },
      { id: "msg-bot-greeting", type: "message", timestamp: 1775589131, from: { id: "bot-xyz", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Hello, how can I help?", attachments: [], replyToId: "start-001" },
      { id: "msg-user-001", type: "message", timestamp: 1775589134, from: { id: "user-abc", aadObjectId: "aad-user-123", role: 1 }, channelId: "pva-studio", textFormat: "plain", text: "What campaigns are active?", attachments: [] },
      { valueType: "DynamicPlanStepTriggered", id: "evt-plan-001", type: "event", timestamp: 1775589141, from: { id: "bot-xyz", role: 0 }, name: "DynamicPlanStepTriggered", channelId: "pva-studio", attachments: [], replyToId: "msg-user-001", value: { planIdentifier: "plan-001", stepId: "step-001", taskDialogId: "MCP:schema.topic:list_interactions", thought: "The user wants active campaigns. I'll call list_interactions.", state: 1, type: "LlmSkill" } },
      { id: "evt-bind-001", type: "event", timestamp: 1775589141, from: { id: "bot-xyz", role: 0 }, name: "DynamicPlanStepBindUpdate", channelId: "pva-studio", attachments: [], replyToId: "msg-user-001", value: { taskDialogId: "MCP:schema.topic:list_interactions", stepId: "step-001", arguments: { status: "active" }, planIdentifier: "plan-001" } },
      { id: "evt-finish-001", type: "event", timestamp: 1775589143, from: { id: "bot-xyz", role: 0 }, name: "DynamicPlanStepFinished", channelId: "pva-studio", attachments: [], replyToId: "msg-user-001", value: { taskDialogId: "MCP:schema.topic:list_interactions", stepId: "step-001", observation: { content: [{ text: "Found 7 interactions", type: "text" }] }, planIdentifier: "plan-001", state: "completed", executionTime: "00:00:02.25" } },
      { id: "msg-bot-response", type: "message", timestamp: 1775589150, from: { id: "bot-xyz", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Here are **7 active campaigns**:\n\n| ID | Name |\n|---|---|\n| 1 | Campaign A |", attachments: [], replyToId: "msg-user-001" },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775589150, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-07T19:12:11Z", endTimeUtc: "2026-04-07T19:16:56Z", type: "Engaged", outcome: "Abandoned", turnCount: 4, impliedSuccess: false, outcomeReason: "UserExit" } },
    ],
  }),
};

/** Transcript with reactions — pva-studio format (object feedback) */
export const pvaStudioReactionsTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-reactions-pva",
  name: "test_reactions_pva",
  createdon: "2026-04-10T12:30:52Z",
  conversationstarttime: "2026-04-10T11:59:35Z",
  metadata: '{"BotId":"bot-react-test","AADTenantId":"tenant-test","BotName":"msftcsa_testbot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775822375, from: { id: "", role: 0 }, value: { lastSessionOutcome: "None", lastSessionOutcomeReason: "NoError", isDesignMode: true, locale: "en-US" } },
      { id: "start-react", type: "event", timestamp: 1775822375, from: { id: "user-abc", aadObjectId: "aad-user-123", role: 1 }, name: "startConversation", channelId: "pva-studio", attachments: [] },
      { id: "msg-bot-hello", type: "message", timestamp: 1775822376, from: { id: "bot-xyz", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Hello, how can I help?", attachments: [], replyToId: "start-react" },
      // Thumbs up on the greeting
      { id: "invoke-like", type: "invoke", timestamp: 1775822406, from: { id: "user-abc", aadObjectId: "aad-user-123", role: 1 }, name: "message/submitAction", channelId: "pva-studio", attachments: [], replyToId: "msg-bot-hello", value: { actionName: "feedback", actionValue: { feedback: { feedbackText: "thumbs up from test pane" }, reaction: "like" } } },
      { id: "msg-user-q", type: "message", timestamp: 1775822412, from: { id: "user-abc", aadObjectId: "aad-user-123", role: 1 }, channelId: "pva-studio", textFormat: "plain", text: "what can you do", attachments: [] },
      { id: "msg-bot-answer", type: "message", timestamp: 1775822419, from: { id: "bot-xyz", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "I can help with **agent sharing**!", attachments: [], replyToId: "msg-user-q" },
      // Thumbs down on the answer
      { id: "invoke-dislike", type: "invoke", timestamp: 1775822442, from: { id: "user-abc", aadObjectId: "aad-user-123", role: 1 }, name: "message/submitAction", channelId: "pva-studio", attachments: [], replyToId: "msg-bot-answer", value: { actionName: "feedback", actionValue: { feedback: { feedbackText: "not helpful" }, reaction: "dislike" } } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775822442, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-10T11:59:35Z", endTimeUtc: "2026-04-10T12:00:42Z", type: "Unengaged", outcome: "None", turnCount: 3, impliedSuccess: false, outcomeReason: "NoError" } },
    ],
  }),
};

/** Teams transcript with double-encoded feedback + orphan reaction */
export const teamsReactionsTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-reactions-teams",
  name: "test_reactions_teams",
  createdon: "2026-04-10T12:29:29Z",
  conversationstarttime: "2026-04-10T11:57:06Z",
  metadata: '{"BotId":"bot-teams-test","AADTenantId":"tenant-test","BotName":"msftcsa_testbot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775822226, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Resolved", lastSessionOutcomeReason: "Resolved", isDesignMode: false, locale: "en-US" } },
      { id: "msg-teams-user", type: "message", timestamp: 1775822226, from: { id: "teams-user", aadObjectId: "aad-teams-456", role: 1 }, channelId: "msteams", textFormat: "plain", text: "hello", attachments: [] },
      { id: "msg-teams-bot", type: "message", timestamp: 1775822230, from: { id: "bot-xyz", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Hello, how can I help you today?", attachments: [], replyToId: "msg-teams-user" },
      // Teams reaction — double-encoded feedback string
      { id: "invoke-teams-like", type: "invoke", timestamp: 1775822243, from: { id: "teams-user", aadObjectId: "aad-teams-456", role: 1 }, name: "message/submitAction", channelId: "msteams", attachments: [], replyToId: "msg-teams-bot", value: { actionName: "feedback", actionValue: { reaction: "like", feedback: "{\"feedbackText\":\"thumbs up test\"}" } } },
      // Orphan reaction — replyToId doesn't exist in this transcript
      { id: "invoke-orphan", type: "invoke", timestamp: 1775822314, from: { id: "teams-user", aadObjectId: "aad-teams-456", role: 1 }, name: "message/submitAction", channelId: "msteams", attachments: [], replyToId: "nonexistent-msg-from-prior-session", value: { actionName: "feedback", actionValue: { reaction: "dislike", feedback: "{\"feedbackText\":\"feedback on old message\"}" } } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775822361, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-10T11:57:06Z", endTimeUtc: "2026-04-10T11:59:21Z", type: "Engaged", outcome: "Resolved", turnCount: 2, impliedSuccess: true, outcomeReason: "Resolved" } },
    ],
  }),
};

/** Transcript with knowledge sources + redacted content */
export const knowledgeTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-knowledge-001",
  name: "test_knowledge",
  createdon: "2026-04-06T18:00:00Z",
  conversationstarttime: "2026-04-06T17:55:00Z",
  metadata: '{"BotId":"bot-knowledge","AADTenantId":"tenant-test","BotName":"cr472_manualHelper","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775412000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "None", lastSessionOutcomeReason: "NoError", isDesignMode: false, locale: "en-US" } },
      { id: "start-k", type: "event", timestamp: 1775412000, from: { id: "user-k", aadObjectId: "aad-k-user", role: 1 }, name: "startConversation", channelId: "pva-studio", attachments: [] },
      { id: "msg-k-bot-hello", type: "message", timestamp: 1775412001, from: { id: "bot-k", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Hello, I'm Manual Helper.", attachments: [], replyToId: "start-k" },
      // Blank bot message (redacted knowledge response)
      { id: "msg-k-bot-blank", type: "message", timestamp: 1775412002, from: { id: "bot-k", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "", attachments: [], replyToId: "start-k" },
      { id: "msg-k-user", type: "message", timestamp: 1775412005, from: { id: "user-k", aadObjectId: "aad-k-user", role: 1 }, channelId: "pva-studio", textFormat: "plain", text: "can you tell me a joke", attachments: [] },
      { valueType: "DynamicPlanStepTriggered", id: "evt-k-plan", type: "event", timestamp: 1775412006, from: { id: "bot-k", role: 0 }, name: "DynamicPlanStepTriggered", channelId: "pva-studio", attachments: [], replyToId: "msg-k-user", value: { planIdentifier: "plan-k", stepId: "step-k-1", taskDialogId: "P:UniversalSearchTool", thought: "Let me search for a joke.", state: 1, type: "LlmSkill" } },
      { id: "evt-k-search", type: "event", timestamp: 1775412006, from: { id: "bot-k", role: 0 }, name: "UniversalSearchToolTraceData", channelId: "pva-studio", attachments: [], replyToId: "msg-k-user", value: { toolId: "P:UniversalSearchTool", knowledgeSources: ["cr472_manualHelper.file.Healthcare_Manual.pdf_abc", "BingUnscopedSearchKnowledge"], outputKnowledgeSources: [] } },
      { id: "evt-k-response", type: "event", timestamp: 1775412006, from: { id: "bot-k", role: 0 }, name: "ResponseGeneratorSupportData", channelId: "pva-studio", attachments: [], replyToId: "msg-k-user", value: { query: "can you tell me a joke", rewritten_query: "tell me a joke", response: "Why did the scarecrow win a Nobel prize? Because she was outstanding in her field!", completion_state: "Answered", citations: [{ Id: "turn1search0", Text: "200 Short Jokes..." }] } },
      { valueType: "KnowledgeTraceData", id: "trace-k", type: "trace", timestamp: 1775412006, from: { id: "", role: 0 }, replyToId: "msg-k-user", value: { completionState: "Answered", isKnowledgeSearched: true, citedKnowledgeSources: [], failedKnowledgeSourcesTypes: [] } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775412010, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-06T17:55:00Z", endTimeUtc: "2026-04-06T17:55:30Z", type: "Engaged", outcome: "None", turnCount: 2, impliedSuccess: false, outcomeReason: "NoError" } },
    ],
  }),
};

/** Transcript with advanced events — errors, variables, redirects */
export const advancedEventsTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-advanced-001",
  name: "test_advanced",
  createdon: "2026-04-09T13:10:00Z",
  conversationstarttime: "2026-04-09T13:07:00Z",
  metadata: '{"BotId":"bot-advanced","AADTenantId":"tenant-test","BotName":"msftcsa_mcsagentshare","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775740000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Abandoned", lastSessionOutcomeReason: "UserExit", isDesignMode: false, locale: "en-US" } },
      { id: "start-adv", type: "event", timestamp: 1775740000, from: { id: "user-adv", aadObjectId: "aad-adv-user", role: 1 }, name: "startConversation", channelId: "msteams", attachments: [] },
      { id: "msg-adv-user", type: "message", timestamp: 1775740005, from: { id: "user-adv", aadObjectId: "aad-adv-user", role: 1 }, channelId: "msteams", textFormat: "plain", text: "who is my agent shared with", attachments: [] },
      // Variable assignment
      { valueType: "VariableAssignment", type: "trace", timestamp: 1775740006, from: { id: "bot-adv", role: 0 }, replyToId: "msg-adv-user", value: { name: "GlobalUserName", id: "Global.GlobalUserName", newValue: "Test User", type: "global" } },
      // System variable (should be filtered)
      { valueType: "VariableAssignment", type: "trace", timestamp: 1775740006, from: { id: "bot-adv", role: 0 }, replyToId: "msg-adv-user", value: { name: "CurrentTime", id: "Topic.CurrentTime", newValue: "2026-04-09T13:07:53Z", type: "local" } },
      // Error
      { valueType: "ErrorTraceData", type: "trace", timestamp: 1775740010, from: { id: "bot-adv", role: 0 }, replyToId: "msg-adv-user", value: { isUserError: true, errorCode: "FlowActionBadRequest", errorMessage: "The flow failed with BadGateway", errorSubCode: "Undefined" } },
      // Dialog redirect
      { valueType: "DialogRedirect", type: "trace", timestamp: 1775740012, from: { id: "bot-adv", role: 0 }, replyToId: "msg-adv-user", value: { targetDialogId: "escalation-topic-123", targetDialogType: 1 } },
      // Escalation
      { valueType: "EscalationRequested", type: "trace", timestamp: 1775740013, from: { id: "bot-adv", role: 0 }, replyToId: "msg-adv-user", value: { escalationRequestType: 0 } },
      // Server error
      { id: "evt-server-err", type: "event", timestamp: 1775740014, from: { id: "bot-adv", role: 0 }, name: "DynamicServerError", channelId: "msteams", attachments: [], replyToId: "msg-adv-user", value: { reasonCode: "RequestFailure", errorMessage: "Connector request failed", HttpStatusCode: "badRequest", errorResponse: "Server not initialized" } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775740020, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-09T13:07:00Z", endTimeUtc: "2026-04-09T13:07:20Z", type: "Engaged", outcome: "Abandoned", turnCount: 2, impliedSuccess: false, outcomeReason: "UserExit" } },
    ],
  }),
};

/** Transcript with adaptive card (connection consent) */
export const adaptiveCardTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-adaptive-001",
  name: "test_adaptive",
  createdon: "2026-04-09T05:50:00Z",
  conversationstarttime: "2026-04-09T05:47:00Z",
  metadata: '{"BotId":"bot-adaptive","AADTenantId":"tenant-test","BotName":"msftcsa_mcsagentshare","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775730000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "None", lastSessionOutcomeReason: "NoError", isDesignMode: false, locale: "en-US" } },
      { id: "start-ac", type: "event", timestamp: 1775730000, from: { id: "user-ac", aadObjectId: "aad-ac-user", role: 1 }, name: "startConversation", channelId: "msteams", attachments: [] },
      // Adaptive card message (no text, just card attachment)
      { id: "msg-ac-card", type: "message", timestamp: 1775730005, from: { id: "bot-ac", role: 0 }, channelId: "msteams", text: "", attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", content: { type: "AdaptiveCard", version: "1.3", body: [{ type: "TextBlock", size: "medium", weight: "bolder", text: "Connect to continue" }, { type: "TextBlock", text: "Allow access to Power Platform." }], actions: [{ type: "Action.Submit", title: "Allow" }] } }], replyToId: "start-ac" },
      // User clicks Allow (empty message)
      { id: "msg-ac-user-action", type: "message", timestamp: 1775730010, from: { id: "user-ac", aadObjectId: "aad-ac-user", role: 1 }, channelId: "msteams", text: "", attachments: [], value: { action: "Allow" } },
      // OAuth card
      { id: "msg-oauth", type: "message", timestamp: 1775730012, from: { id: "bot-ac", role: 0 }, channelId: "msteams", text: "", attachments: [{ contentType: "application/vnd.microsoft.card.oauth", content: { tokenExchangeResource: { id: "token-123", uri: "auth-uri" }, buttons: [] } }], replyToId: "start-ac" },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775730020, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-09T05:47:00Z", endTimeUtc: "2026-04-09T05:47:20Z", type: "Unengaged", outcome: "None", turnCount: 1, impliedSuccess: false, outcomeReason: "NoError" } },
    ],
  }),
};

/** Transcript with no user messages (only startConversation event has AAD ID) */
export const noUserMessagesTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-no-user-msgs",
  name: "test_no_user_msgs",
  createdon: "2026-04-08T20:48:00Z",
  conversationstarttime: "2026-04-08T20:18:00Z",
  metadata: '{"BotId":"bot-nousermsg","AADTenantId":"tenant-test","BotName":"msftcsa_mcsagentshare","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775679486, from: { id: "", role: 0 }, value: { lastSessionOutcome: "None", lastSessionOutcomeReason: "NoError", isDesignMode: true, locale: "en-US" } },
      { id: "start-nouser", type: "event", timestamp: 1775679486, from: { id: "user-nouser", aadObjectId: "aad-nouser-789", role: 1 }, name: "startConversation", channelId: "pva-studio", attachments: [] },
      { id: "msg-nouser-greeting", type: "message", timestamp: 1775679486, from: { id: "bot-nouser", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Hello, how can I help?", attachments: [], replyToId: "start-nouser" },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775679486, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-08T20:18:06Z", endTimeUtc: "2026-04-08T20:18:06Z", type: "Unengaged", outcome: "None", turnCount: 1, impliedSuccess: false, outcomeReason: "NoError" } },
    ],
  }),
};

/** Autonomous transcript — flow-triggered via Power Automate */
export const autonomousTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-autonomous-001",
  name: "test_autonomous",
  createdon: "2026-03-16T02:17:42Z",
  conversationstarttime: "2026-03-16T01:43:27Z",
  metadata: '{"BotId":"bot-auto","AADTenantId":"tenant-test","BotName":"msftcsa_serffagent","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775000000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Abandoned", lastSessionOutcomeReason: "UserExit", isDesignMode: false, locale: "en-US" } },
      { id: "start-auto", type: "event", timestamp: 1775000000, from: { id: "user-auto", aadObjectId: "aad-auto-001", role: 1 }, name: "startConversation", channelId: "pva-autonomous", attachments: [] },
      { id: "msg-auto-user", type: "message", timestamp: 1775000001, from: { id: "user-auto", role: 1 }, channelId: "pva-autonomous", text: "Use content from {}", channelData: { triggerTest: { flowId: "flow-001", flowRunId: "run-001", trigger: { displayName: "When a file is created", connectorDisplayName: "SharePoint" } }, enableDiagnostics: true, testMode: "Text" } },
      { id: "msg-auto-bot", type: "message", timestamp: 1775000005, from: { id: "bot-auto", role: 0 }, channelId: "pva-autonomous", textFormat: "markdown", text: "Processing your document.", channelData: { feedbackLoop: { type: "default" } } },
      { id: "msg-postback", type: "message", timestamp: 1775000006, from: { id: "user-auto", role: 1 }, channelId: "pva-autonomous", text: "", channelData: { postBack: true, enableDiagnostics: true, testMode: "Text" } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775000010, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-03-16T01:43:27Z", endTimeUtc: "2026-03-16T01:47:34Z", type: "Engaged", outcome: "Abandoned", turnCount: 6, impliedSuccess: false, outcomeReason: "UserExit" } },
    ],
  }),
};

/** Evaluation transcript — testMode + enableDiagnostics but no triggerTest */
export const evaluationTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-eval-001",
  name: "test_eval",
  createdon: "2026-04-10T14:00:00Z",
  conversationstarttime: "2026-04-10T13:50:00Z",
  metadata: '{"BotId":"bot-eval","AADTenantId":"tenant-test","BotName":"msftcsa_testbot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1776000000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "None", lastSessionOutcomeReason: "NoError", isDesignMode: false, locale: "en-US" } },
      { id: "start-eval", type: "event", timestamp: 1776000000, from: { id: "user-eval", aadObjectId: "aad-eval-001", role: 1 }, name: "startConversation", channelId: "pva-studio", attachments: [] },
      { id: "msg-eval-user", type: "message", timestamp: 1776000001, from: { id: "user-eval", role: 1 }, channelId: "pva-studio", text: "Tell me a joke", channelData: { clientActivityID: "test-123", enableDiagnostics: true, testMode: "Text", attachmentSizes: [] } },
      { id: "msg-eval-bot", type: "message", timestamp: 1776000003, from: { id: "bot-eval", role: 0 }, channelId: "pva-studio", text: "Why did the chicken...", channelData: { feedbackLoop: { type: "default" } } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776000005, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-10T13:50:00Z", endTimeUtc: "2026-04-10T13:50:05Z", type: "Engaged", outcome: "None", turnCount: 1, impliedSuccess: false, outcomeReason: "NoError" } },
    ],
  }),
};

/** Chat transcript — real production interactive chat, no test flags */
export const chatTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-chat-001",
  name: "test_chat",
  createdon: "2026-04-10T15:00:00Z",
  conversationstarttime: "2026-04-10T14:50:00Z",
  metadata: '{"BotId":"bot-chat","AADTenantId":"tenant-test","BotName":"msftcsa_prodbot","BatchId":""}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1776010000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Resolved", lastSessionOutcomeReason: "Resolved", isDesignMode: false, locale: "en-US" } },
      { id: "start-chat", type: "event", timestamp: 1776010000, from: { id: "user-chat", aadObjectId: "aad-chat-001", role: 1 }, name: "startConversation", channelId: "msteams", attachments: [] },
      { id: "msg-chat-user", type: "message", timestamp: 1776010001, from: { id: "user-chat", role: 1 }, channelId: "msteams", text: "What's the status of my order?", channelData: { source: "teams", tenant: "tenant-test" } },
      { id: "msg-chat-bot", type: "message", timestamp: 1776010005, from: { id: "bot-chat", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Your order #1234 is in transit.", channelData: { feedbackLoop: { type: "default" } } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776010010, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-10T14:50:00Z", endTimeUtc: "2026-04-10T14:50:10Z", type: "Engaged", outcome: "Resolved", turnCount: 2, impliedSuccess: true, outcomeReason: "Resolved" } },
    ],
  }),
};

/** Transcript with new advanced event types */
export const newAdvancedEventsTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-new-adv-001",
  name: "test_new_advanced",
  createdon: "2026-04-10T16:00:00Z",
  conversationstarttime: "2026-04-10T15:50:00Z",
  metadata: '{"BotId":"bot-adv","AADTenantId":"tenant-test","BotName":"msftcsa_advbot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1776020000, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Abandoned", lastSessionOutcomeReason: "UserExit", isDesignMode: false, locale: "en-US" } },
      { id: "start-adv", type: "event", timestamp: 1776020000, from: { id: "user-adv", aadObjectId: "aad-adv-001", role: 1 }, name: "startConversation", channelId: "msteams", attachments: [] },
      { id: "msg-adv-user", type: "message", timestamp: 1776020001, from: { id: "user-adv", role: 1 }, channelId: "msteams", text: "Help me with ServiceNow" },
      // IntentRecognition trace
      { valueType: "IntentRecognition", type: "trace", timestamp: 1776020002, from: { id: "", role: 0 }, replyToId: "msg-adv-user", value: { intentName: "ServiceNowHelp", score: 0.92, topIntent: "ServiceNowHelp" } },
      // NodeTraceData trace
      { valueType: "NodeTraceData", type: "trace", timestamp: 1776020003, from: { id: "", role: 0 }, replyToId: "msg-adv-user", value: { nodeId: "node-abc-123", nodeType: "ConditionGroup", actionType: "Condition" } },
      // endOfConversation activity type
      { type: "endOfConversation", timestamp: 1776020008, from: { id: "bot-adv", role: 0 }, value: { code: "completedSuccessfully" } },
      // pvaSetContext (should show as catch-all activity)
      { type: "event", timestamp: 1776020000, from: { id: "", role: 0 }, name: "pvaSetContext", value: { context: "test-context" } },
      // ConsentNotProvidedByUser error
      { valueType: "ErrorTraceData", type: "trace", timestamp: 1776020004, from: { id: "", role: 0 }, replyToId: "msg-adv-user", value: { errorCode: "ConsentNotProvidedByUser", errorMessage: "User declined connector consent", isUserError: true } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776020010, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-10T15:50:00Z", endTimeUtc: "2026-04-10T15:50:10Z", type: "Engaged", outcome: "Abandoned", turnCount: 1, impliedSuccess: false, outcomeReason: "UserExit" } },
    ],
  }),
};
