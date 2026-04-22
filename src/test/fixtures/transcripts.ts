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

/**
 * Multi-agent transcript: parent (MainITAgent) calls 2 different connected
 * children (HelpDeskAgent, then Cybersecurity). Includes a `thought` on the
 * second child's plan step and a signin/failure invoke inside the 2nd child window.
 */
export const multiAgentTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-multi-agent-001",
  name: "test_multi_agent",
  createdon: "2026-04-20T18:43:16Z",
  conversationstarttime: "2026-04-20T18:08:23Z",
  metadata: '{"BotId":"main-it-agent","AADTenantId":"tenant-test","BotName":"msftcsa_MainITAgent","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1776708500, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Resolved", lastSessionOutcomeReason: "Resolved", isDesignMode: false, locale: "en-US" } },
      // Parent greets
      { id: "msg-parent-greet", type: "message", timestamp: 1776708510, from: { id: "parent-bot", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Hello, I'm Main IT Agent. How can I help?", attachments: [] },
      // User asks about ticketing -> routed to HelpDesk
      { id: "msg-user-1", type: "message", timestamp: 1776708630, from: { id: "user-1", aadObjectId: "aad-user-multi", role: 1 }, channelId: "msteams", textFormat: "plain", text: "I have an issue with my ticketing system", attachments: [] },
      { valueType: "DynamicPlanStepTriggered", type: "event", timestamp: 1776708635, from: { id: "parent-bot", role: 0 }, name: "DynamicPlanStepTriggered", channelId: "msteams", attachments: [], replyToId: "msg-user-1", value: { planIdentifier: "plan-1", stepId: "step-helpdesk", taskDialogId: "msftcsa_MainITAgent.InvokeConnectedAgentTaskAction.HelpDeskAgent", thought: "Issue with ticketing system. Routing to Help-Desk-Agent.", state: 1, type: "Action" } },
      { valueType: "ConnectedAgentInitializeTraceData", type: "event", timestamp: 1776708635, from: { id: "parent-bot", role: 0 }, name: "ConnectedAgentInitializeTraceData", channelId: "msteams", attachments: [], value: { conversationId: "c1", sessionId: "s1", channelId: "msteams", userId: "u1", planStepId: "step-helpdesk", botSchemaName: "msftcsa_HelpDeskAgent", parentBotSchemaName: "msftcsa_MainITAgent", dialogSchemaName: "msftcsa_MainITAgent.InvokeConnectedAgentTaskAction.HelpDeskAgent" } },
      // Child speaks (HelpDesk)
      { id: "msg-helpdesk-1", type: "message", timestamp: 1776708640, from: { id: "parent-bot", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "You're now connected with the Help Desk Agent! Please describe your issue.", attachments: [] },
      { valueType: "ConnectedAgentCompletedTraceData", type: "event", timestamp: 1776708645, from: { id: "parent-bot", role: 0 }, name: "ConnectedAgentCompletedTraceData", channelId: "msteams", attachments: [], value: { parentBotSchemaName: "msftcsa_MainITAgent", connectedAgentBotSchemaName: "msftcsa_HelpDeskAgent" } },
      // Parent message after child returns
      { id: "msg-parent-2", type: "message", timestamp: 1776708650, from: { id: "parent-bot", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Anything else I can help with?", attachments: [] },
      // User asks about cybersecurity -> routed to Cybersecurity child (with signin/failure inside)
      { id: "msg-user-2", type: "message", timestamp: 1776708720, from: { id: "user-1", aadObjectId: "aad-user-multi", role: 1 }, channelId: "msteams", textFormat: "plain", text: "I am dealing with authentication and authorization issues", attachments: [] },
      { valueType: "DynamicPlanStepTriggered", type: "event", timestamp: 1776708725, from: { id: "parent-bot", role: 0 }, name: "DynamicPlanStepTriggered", channelId: "msteams", attachments: [], replyToId: "msg-user-2", value: { planIdentifier: "plan-2", stepId: "step-cyber", taskDialogId: "msftcsa_MainITAgent.InvokeConnectedAgentTaskAction.Cybersecurity", thought: "Authentication issues. Routing to Cybersecurity specialist.", state: 1, type: "Action" } },
      { valueType: "ConnectedAgentInitializeTraceData", type: "event", timestamp: 1776708725, from: { id: "parent-bot", role: 0 }, name: "ConnectedAgentInitializeTraceData", channelId: "msteams", attachments: [], value: { conversationId: "c1", sessionId: "s2", channelId: "msteams", userId: "u1", planStepId: "step-cyber", botSchemaName: "msftcsa_Cybersecurity", parentBotSchemaName: "msftcsa_MainITAgent", dialogSchemaName: "msftcsa_MainITAgent.InvokeConnectedAgentTaskAction.Cybersecurity" } },
      // signin/failure mid-child
      { id: "inv-fail", type: "invoke", timestamp: 1776708730, from: { id: "user-1", aadObjectId: "aad-user-multi", role: 1 }, name: "signin/failure", channelId: "msteams", attachments: [], value: { code: "invokeerror", message: "Invoke error occurred" } },
      { id: "msg-cyber-1", type: "message", timestamp: 1776708780, from: { id: "parent-bot", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Here's a comprehensive guide to troubleshoot your auth issues.", attachments: [] },
      { valueType: "ConnectedAgentCompletedTraceData", type: "event", timestamp: 1776708785, from: { id: "parent-bot", role: 0 }, name: "ConnectedAgentCompletedTraceData", channelId: "msteams", attachments: [], value: { parentBotSchemaName: "msftcsa_MainITAgent", connectedAgentBotSchemaName: "msftcsa_Cybersecurity" } },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776708790, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-20T18:08:23Z", endTimeUtc: "2026-04-20T18:13:10Z", type: "Engaged", outcome: "Resolved", turnCount: 4, impliedSuccess: true, outcomeReason: "Resolved" } },
    ],
  }),
};


/** Transcript with provider handoffs (Genesys text + Salesforce JSON) */
export const handoffTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-handoff-001",
  name: "test_handoff",
  createdon: "2026-04-22T10:00:00Z",
  conversationstarttime: "2026-04-22T09:55:00Z",
  metadata: '{"BotId":"handoff-bot","AADTenantId":"tenant-test","BotName":"msftcsa_handoffbot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { id: "msg-user-1", type: "message", timestamp: 1776800000, from: { id: "user-1", aadObjectId: "aad-user-h", role: 1 }, channelId: "pva-studio", textFormat: "plain", text: "I need a human agent please", attachments: [] },
      { id: "msg-bot-1", type: "message", timestamp: 1776800010, from: { id: "bot-1", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Connecting you to an agent now.", attachments: [], replyToId: "msg-user-1" },
      { id: "evt-handoff-1", type: "event", timestamp: 1776800011, from: { id: "bot-1", role: 0 }, name: "GenesysHandoff", channelId: "pva-studio", attachments: [], replyToId: "msg-bot-1", value: "The user requested human assistance. Summary: billing issue on account #4823." },
      { id: "evt-handoff-2", type: "event", timestamp: 1776800012, from: { id: "bot-1", role: 0 }, name: "SalesforceHandoff", channelId: "pva-studio", attachments: [], replyToId: "msg-bot-1", value: { caseNumber: "CASE-001", priority: "High", tags: ["billing", "vip"] } },
      { id: "evt-not-handoff", type: "event", timestamp: 1776800013, from: { id: "bot-1", role: 0 }, name: "DialogTracing", channelId: "pva-studio", attachments: [], value: {} },
    ],
  }),
};

/**
 * Transcript where PVA's Escalate system topic fired EscalationRequested +
 * HandOff traces but escalation was NOT actually configured — the bot told
 * the user it was unavailable and the session ended as 'Abandoned'.
 *
 * Regression: hasHandoff must be FALSE here even though a HandOff trace exists.
 */
export const fakeHandoffTraceTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-fake-handoff-001",
  name: "test_fake_handoff",
  createdon: "2026-04-09T04:07:46Z",
  conversationstarttime: "2026-04-09T04:00:33Z",
  metadata: '{"BotId":"fake-handoff","AADTenantId":"tenant-test","BotName":"msftcsa_fakehandoff","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1775707200, from: { id: "", role: 0 }, value: { lastSessionOutcome: "Abandoned", lastSessionOutcomeReason: "UserError", isDesignMode: false, locale: "en-US" } },
      { id: "msg-user-1", type: "message", timestamp: 1775707210, from: { id: "user-1", aadObjectId: "aad-x", role: 1 }, channelId: "msteams", textFormat: "plain", text: "talk to a human", attachments: [] },
      { valueType: "EscalationRequested", id: "esc-1", type: "trace", timestamp: 1775707215, from: { id: "bot-1", role: 0 }, value: { escalationRequestType: 1 } },
      { id: "msg-bot-1", type: "message", timestamp: 1775707216, from: { id: "bot-1", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Escalating to a representative is not currently configured for this conversation.", attachments: [], replyToId: "msg-user-1" },
      { valueType: "HandOff", id: "ho-1", type: "trace", timestamp: 1775707217, from: { id: "bot-1", role: 0 }, replyToId: "msg-user-1", value: {} },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775707666, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-09T04:00:33Z", endTimeUtc: "2026-04-09T04:07:46Z", type: "Engaged", outcome: "Abandoned", turnCount: 26, impliedSuccess: false, outcomeReason: "UserError" } },
    ],
  }),
};

/**
 * Real D365 Omnichannel (Live Chat Widget) handoff. User explicitly asked to
 * be transferred; the platform routed the conversation to a human queue.
 *
 *   outcome === "HandOff"
 *   outcomeReason === "AgentTransferRequestedByUser"
 *   channelId === "lcw"
 *
 * Includes a full Omnichannel context startConversation event with OIDC
 * claims so the OmnichannelContextPanel + AuthenticatedVisitorPanel render.
 *
 * All three handoff signals must align — see hasHandoff derivation in parseTranscript.ts.
 */
export const d365LcwHandoffTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-d365-lcw-handoff-001",
  name: "test_d365_lcw_handoff",
  createdon: "2026-04-15T12:00:00Z",
  conversationstarttime: "2026-04-15T11:55:00Z",
  metadata: '{"BotId":"d365-bot","AADTenantId":"tenant-test","BotName":"msftcsa_d365bot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { valueType: "ConversationInfo", type: "trace", timestamp: 1776556499, from: { id: "", role: 0 }, value: { lastSessionOutcome: "HandOff", lastSessionOutcomeReason: "AgentTransferRequestedByUser", isDesignMode: false, locale: "en-US" } },
      {
        id: "evt-startconv-1",
        type: "event",
        name: "startConversation",
        timestamp: 1776556499,
        from: { id: "visitor-1", role: 1 },
        channelId: "lcw",
        channelData: { tags: "ChannelId-lcw,OmnichannelContextMessage,Hidden", sourceChannelId: "omnichannel" },
        value: {
          msdyn_liveworkitemid: "1970b59e-f5a1-4f02-8dd1-c36261ad0e8c",
          msdyn_ConversationId: "1970b59e-f5a1-4f02-8dd1-c36261ad0e8c",
          msdyn_sessionid: "0274bfd2-6242-42c2-b78e-fc9652e63752",
          msdyn_WorkstreamId: "3f956ca3-0ec9-db3f-b012-7c0ee5261aed",
          msdyn_ChannelInstanceId: "a7a1d904-b331-f111-88b4-000d3a59de25",
          msdyn_Locale: "en-US",
          msdyn_localecode: "en-US",
          msdyn_browser: "Edge",
          msdyn_device: "Desktop",
          msdyn_os: "Windows",
          msdyn_msdyn_ocliveworkitem_msdyn_livechatengagementctx_liveworkitemid: [
            { RecordId: "a4d38d7f-e903-4d55-a1fe-ababbb70ad8b", PrimaryDisplayValue: "john.doe@hls-mock.com" },
          ],
          sub: "user-001",
          preferred_username: "john.doe@hls-mock.com",
          email: "john.doe@hls-mock.com",
          given_name: "John",
          family_name: "Doe",
          phone_number: "555-100-0001",
        },
      },
      { id: "msg-user-1", type: "message", timestamp: 1776556500, from: { id: "user-1", role: 1 }, channelId: "lcw", textFormat: "plain", text: "I need a human agent", attachments: [] },
      { valueType: "EscalationRequested", id: "esc-1", type: "trace", timestamp: 1776556505, from: { id: "bot-1", role: 0 }, value: { escalationRequestType: 1 } },
      { id: "msg-bot-transfer", type: "message", timestamp: 1776556506, from: { id: "bot-1", role: 0 }, channelId: "lcw", textFormat: "markdown", text: "I am transferring you to a representative. Please hold...", attachments: [], replyToId: "msg-user-1" },
      { valueType: "HandOff", id: "ho-1", type: "trace", timestamp: 1776556507, from: { id: "bot-1", role: 0 }, replyToId: "1776556506", value: {} },
      { valueType: "HandOff", id: "ho-2", type: "trace", timestamp: 1776556508, from: { id: "bot-1", role: 0 }, replyToId: "1776556506", value: {} },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776556700, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-15T11:55:00Z", endTimeUtc: "2026-04-15T11:58:20Z", type: "Engaged", outcome: "HandOff", turnCount: 4, impliedSuccess: true, outcomeReason: "AgentTransferRequestedByUser" } },
    ],
  }),
};

/**
 * PVA Escalate-not-configured fake-out, second variant: this one ends with
 * outcome="HandOff" but outcomeReason="AgentTransferFromQuestionMaxAttempts"
 * (the system gave up, not a user-requested transfer). Same false-positive
 * source as fakeHandoffTraceTranscript, just a different reason code.
 *
 * Regression: hasHandoff must be FALSE.
 */
export const fakeHandoffOutcomeTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-fake-handoff-002",
  name: "test_fake_handoff_outcome",
  createdon: "2026-04-10T05:00:00Z",
  conversationstarttime: "2026-04-10T04:55:00Z",
  metadata: '{"BotId":"fake-handoff-2","AADTenantId":"tenant-test","BotName":"msftcsa_fakehandoff2","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { id: "msg-user-1", type: "message", timestamp: 1775793300, from: { id: "user-1", role: 1 }, channelId: "msteams", textFormat: "plain", text: "huh?", attachments: [] },
      { valueType: "EscalationRequested", id: "esc-1", type: "trace", timestamp: 1775793305, from: { id: "bot-1", role: 0 }, value: { escalationRequestType: 1 } },
      { id: "msg-bot-1", type: "message", timestamp: 1775793306, from: { id: "bot-1", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Escalating to a representative is not currently configured for this agent.", attachments: [], replyToId: "msg-user-1" },
      { valueType: "HandOff", id: "ho-1", type: "trace", timestamp: 1775793307, from: { id: "bot-1", role: 0 }, replyToId: "msg-user-1", value: {} },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1775793500, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-10T04:55:00Z", endTimeUtc: "2026-04-10T04:58:20Z", type: "Engaged", outcome: "HandOff", turnCount: 6, impliedSuccess: false, outcomeReason: "AgentTransferFromQuestionMaxAttempts" } },
    ],
  }),
};

/**
 * Edge case: outcome=HandOff with a RequestedBy* reason, but on a non-lcw
 * channel. We don't trust this without the LCW gate (no human queue
 * guaranteed to exist on this channel). Regression: hasHandoff must be FALSE.
 */
export const handoffNonLcwTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-handoff-non-lcw-001",
  name: "test_handoff_non_lcw",
  createdon: "2026-04-12T08:00:00Z",
  conversationstarttime: "2026-04-12T07:55:00Z",
  metadata: '{"BotId":"non-lcw","AADTenantId":"tenant-test","BotName":"msftcsa_nonlcw","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { id: "msg-user-1", type: "message", timestamp: 1776008100, from: { id: "user-1", role: 1 }, channelId: "msteams", textFormat: "plain", text: "agent please", attachments: [] },
      { id: "msg-bot-1", type: "message", timestamp: 1776008101, from: { id: "bot-1", role: 0 }, channelId: "msteams", textFormat: "markdown", text: "Connecting you...", attachments: [], replyToId: "msg-user-1" },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776008300, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-12T07:55:00Z", endTimeUtc: "2026-04-12T07:58:20Z", type: "Engaged", outcome: "HandOff", turnCount: 2, impliedSuccess: true, outcomeReason: "AgentTransferRequestedByUser" } },
    ],
  }),
};

/**
 * D365 Voice Channel handoff: Bot Framework first-class `type:"handoff"`
 * activity with value.type="transferToAgent". Channel is conversationconductor
 * (D365 Voice / IVR). No *Handoff event, no LCW signaling — would have been
 * missed by both prior detection paths.
 *
 * Regression: hasHandoff must be TRUE; provider derived from value.context.va_BotName.
 */
export const voiceFirstClassHandoffTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-voice-handoff-001",
  name: "test_voice_handoff",
  createdon: "2026-04-22T10:00:00Z",
  conversationstarttime: "2026-04-22T09:55:00Z",
  metadata: '{"BotId":"voice-bot","AADTenantId":"tenant-test","BotName":"crd9b_voiceagent","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { id: "msg-user-1", type: "message", timestamp: 1776812000, from: { id: "user-1", role: 1 }, channelId: "conversationconductor", textFormat: "plain", text: "Connect me with sales", attachments: [] },
      { id: "msg-bot-1", type: "message", timestamp: 1776812005, from: { id: "bot-1", role: 0 }, channelId: "conversationconductor", textFormat: "plain", text: "Transferring you now.", attachments: [], replyToId: "msg-user-1" },
      {
        id: "ho-act-1",
        type: "handoff",
        timestamp: 1776812006,
        from: { id: "bot-1", role: 0 },
        channelId: "conversationconductor",
        replyToId: "msg-bot-1",
        value: { type: "transferToAgent", context: { va_BotName: "Salesforce", queueId: "q-sales-01" } },
      },
    ],
  }),
};

/**
 * Copilot Studio author-configured handoff (AgentTransferConfiguredByAuthor):
 * the author wired a transfer node into a topic, and at runtime the platform
 * emits both the first-class `handoff` activity AND a HandOff trace. The LCW
 * synthesizer would skip this (reason isn't AgentTransferRequestedBy*), but
 * the activity captures it.
 *
 * Regression: hasHandoff must be TRUE; exactly 1 handoff in the array
 * (no double-counting between the activity and any synthesized event).
 */
export const studioAuthorHandoffTranscript: DataverseTranscriptRecord = {
  conversationtranscriptid: "test-studio-author-handoff-001",
  name: "test_studio_author_handoff",
  createdon: "2026-04-22T11:00:00Z",
  conversationstarttime: "2026-04-22T10:55:00Z",
  metadata: '{"BotId":"studio-bot","AADTenantId":"tenant-test","BotName":"msftcsa_studiobot","BatchId":0}',
  schematype: "powervirtualagents",
  schemaversion: "0.2.2",
  content: JSON.stringify({
    activities: [
      { id: "msg-user-1", type: "message", timestamp: 1776815000, from: { id: "user-1", role: 1 }, channelId: "pva-studio", textFormat: "plain", text: "I want to buy something", attachments: [] },
      { id: "msg-bot-1", type: "message", timestamp: 1776815005, from: { id: "bot-1", role: 0 }, channelId: "pva-studio", textFormat: "markdown", text: "Routing you to our sales specialist.", attachments: [], replyToId: "msg-user-1" },
      {
        id: "ho-act-1",
        type: "handoff",
        timestamp: 1776815006,
        from: { id: "bot-1", role: 0 },
        channelId: "pva-studio",
        replyToId: "msg-bot-1",
        value: { type: "transferToAgent" },
      },
      { valueType: "HandOff", id: "ho-trace-1", type: "trace", timestamp: 1776815007, from: { id: "bot-1", role: 0 }, replyToId: "msg-bot-1", value: {} },
      { valueType: "SessionInfo", id: "0", type: "trace", timestamp: 1776815300, from: { id: "", role: 0 }, value: { startTimeUtc: "2026-04-22T10:55:00Z", endTimeUtc: "2026-04-22T11:00:00Z", type: "Engaged", outcome: "HandOff", turnCount: 2, impliedSuccess: true, outcomeReason: "AgentTransferConfiguredByAuthor" } },
    ],
  }),
};
