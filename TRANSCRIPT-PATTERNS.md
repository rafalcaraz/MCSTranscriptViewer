# Transcript Content Patterns Reference

> **Purpose:** Living catalog of all known Copilot Studio conversation transcript patterns.
> When analyzing new transcripts, diff against this doc to identify what's truly new.
>
> **Last updated:** April 12, 2026
> **Based on:** 1,549 transcripts across 5 environments (evals, research, pipeline, autonomous, early-access)

---

## How to Analyze New Transcripts

When a new transcript file is shared, run this checklist:

1. **Parse the file** — count records, extract unique bots
2. **Collect all unique values** for each category below and diff against the master lists
3. **Flag anything not in the lists** — that's a genuinely new pattern
4. **Check classification signals** — what % are design/eval/autonomous/chat?
5. **Report new patterns** with JSON snippets and update this doc

### Master Checklists (for quick diffing)

**All Known Activity Types (8):**
`trace`, `event`, `message`, `invoke`, `invokeResponse`, `endOfConversation`, `conversationUpdate`, `installationUpdate`

**All Known Trace ValueTypes (19):**
`ConversationInfo`, `SessionInfo`, `ErrorTraceData`, `VariableAssignment`, `DialogRedirect`, `UnknownIntent`, `GPTAnswer`, `HandOff`, `EscalationRequested`, `KnowledgeTraceData`, `IntentRecognition`, `NodeTraceData`, `IntentCandidates`, `CSATSurveyRequest`, `CSATSurveyResponse`, `PRRSurveyRequest`, `PRRSurveyResponse`, `ImpliedSuccess`, `DynamicPlanFinished`

**All Known Event Names (32+):**
`DialogTracing`, `startConversation`, `DynamicServerInitialize`, `DynamicServerInitializeConfirmation`, `DynamicServerToolsList`, `DynamicServerCancellation`, `DynamicServerError`, `DynamicPlanReceived`, `DynamicPlanReceivedDebug`, `DynamicPlanStepTriggered`, `DynamicPlanStepBindUpdate`, `DynamicPlanStepFinished`, `DynamicPlanFinished`, `DynamicPlanStepBlocked`, `UniversalSearchToolTraceData`, `ResponseGeneratorSupportData`, `GenerativeAnswersSupportData`, `ConnectedAgentInitializeTraceData`, `ConnectedAgentCompletedTraceData`, `connectors/consentCard`, `connectors/connectionManagerCard`, `pvaSetContext`, `TEST-Clear-State`, `webchat/join`, `SidePaneAgent.InitializeContext`, `ProtocolInfo`, `Microsoft.PowerApps.Copilot.CopilotFeatures`, `Microsoft.PowerApps.Copilot.SetCanvasEntityContext`, `Microsoft.PowerApps.Copilot.ResetConversation`, `Microsoft.PowerApps.Copilot.SetModelFCSContext`, `AIBuilderTraceData`, `MS.PA.CopilotFeatures`, `MS.PA.DVCopilot`

**All Known Invoke Names (3):**
`signin/tokenExchange`, `signin/failure`, `message/submitAction`

**All Known ChannelData Keys (28):**
`feedbackLoop`, `testMode`, `enableDiagnostics`, `triggerTest`, `postBack`, `clientActivityID`, `attachmentSizes`, `source`, `tenant`, `legacy`, `settings`, `cci_trace_id`, `correlationId`, `pva:gpt-feedback`, `answersUrl1`, `answersUrl2`, `answersUrl3`, `answersUrl4`, `DialogTraceDetail`, `CurrentMessageDetail`, `DialogErrorDetail`, `ConversationUnderstandingDetail`, `VariableDetail`, `traceHistory`, `appId`, `userAgent`, `clientRequestId`, `SetCanvasEntityContext`

**All Known Channel IDs (5):**
`pva-studio`, `pva-autonomous`, `msteams`, `webchat`, `directline`

**All Known Error Codes (3):**
`ConnectorRequestFailure`, `SystemError`, `ConsentNotProvidedByUser`

**All Known Attachment ContentTypes (3):**
`application/vnd.microsoft.card.adaptive`, `application/vnd.microsoft.card.oauth`, `image/png`

**All Known Session Outcomes (5):**
`Resolved`, `Abandoned`, `None`, `Escalated`, `HandOff`

**All Known Outcome Reasons (5):**
`UserExit`, `NoError`, `Resolved`, `UserError`, `SystemError`

**All Known taskDialogId Formats:**
- `MCP:{schema}.topic:{toolName}` — MCP server tools
- `P:UniversalSearchTool` — built-in knowledge search
- `{agent_schema}.action.{Connector}-{ActionName}` — connector actions (e.g. `agent.action.Office365Outlook-SendanemailV2`)
- `{parent_schema}.InvokeConnectedAgentTaskAction.{Child}` — parent agent invoking a connected child agent

**All Known DynamicPlanStepTriggered `type` values (3 observed):**
`KnowledgeSource`, `LlmSkill`, `Action`

> Plan steps may also include a `thought` field — the planner's English-language explanation of *why* it picked this step (e.g. "Routing to Help-Desk-Agent because the user reported a ticketing issue.").

**All Known Plan Step `state` values:**
- Numeric: `1` (triggered/in-progress)
- String: `"completed"`, `"failed"`, `"blocked"`

**Timestamp format:** Unix epoch **seconds** (NOT milliseconds). e.g. `1775589131` = 2026-04-07.

### Classification Decision Tree

```
Has triggerTest in any user message channelData?
  └─ YES → ⚡ AUTONOMOUS
Has channelId === "pva-autonomous"?
  └─ YES → ⚡ AUTONOMOUS
Has isDesignMode === true in ConversationInfo?
  └─ YES → 🛠️ DESIGN  (test pane also sets testMode+enableDiagnostics, so check design FIRST)
Has testMode + enableDiagnostics in user message channelData?
  └─ YES → 🧪 EVALUATION  (external test harness, not studio test pane)
None of the above?
  └─ 💬 CHAT
```

---

## Table of Contents

0. [How to Analyze New Transcripts](#how-to-analyze-new-transcripts) (above)
1. [Full Transcript Walkthroughs](#1-full-transcript-walkthroughs)
2. [Top-Level Record Structure](#2-top-level-record-structure)
3. [Content → Activities Array](#3-content--activities-array)
4. [Activity Types](#4-activity-types)
5. [Trace ValueTypes](#5-trace-valuetypes)
6. [Event Names](#6-event-names)
7. [Message Patterns](#7-message-patterns)
8. [ChannelData Patterns](#8-channeldata-patterns)
9. [Channel IDs](#9-channel-ids)
10. [Transcript Classification Signals](#10-transcript-classification-signals)
11. [Reactions / Feedback](#11-reactions--feedback)
12. [Knowledge & Search](#12-knowledge--search)
13. [Plan Orchestration](#13-plan-orchestration)
14. [Error Patterns](#14-error-patterns)
15. [Connector & Auth Events](#15-connector--auth-events)
    - [15.5 Multi-Agent (Connected Agents)](#155-multi-agent-connected-agents-pattern)
    - [15.6 Provider Handoff Events](#156-provider-handoff-events-genesys-salesforce-etc)
    - [15.7 D365 Omnichannel (LCW) Handoff Pattern](#157-d365-omnichannel-lcw-handoff-pattern)
    - [15.8 D365 Omnichannel Session Context (msdyn_*)](#158-d365-omnichannel-session-context-msdyn_)
16. [Unhandled / Future Patterns](#16-unhandled--future-patterns)

---

## 1. Full Transcript Walkthroughs

### 💬 Chat Transcript (production interactive)

A real user on Teams asks a question, agent uses knowledge search to answer:

```
Activity 1:  trace   (ConversationInfo)            → isDesignMode: false, locale: "en-US"
Activity 2:  event   (startConversation)           → from.aadObjectId: "user-guid", channelId: "msteams"
Activity 3:  message (bot, role=0)                 → "Hello, how can I help?" (greeting)
Activity 4:  message (user, role=1)                → "What campaigns are active?" channelData: {source: "teams"}
Activity 5:  event   (DynamicPlanReceived)         → steps: ["P:UniversalSearchTool"], planIdentifier: "plan-1"
Activity 6:  event   (DynamicPlanStepTriggered)    → thought: "I'll search knowledge...", stepId: "step-1"
Activity 7:  event   (UniversalSearchToolTraceData) → knowledgeSources: [...], outputKnowledgeSources: [...]
Activity 8:  event   (DynamicPlanStepBindUpdate)   → arguments: {query: "active campaigns"}
Activity 9:  event   (DynamicPlanStepFinished)     → observation: {content: [{text: "Found 7 results"}]}, state: "completed"
Activity 10: event   (ResponseGeneratorSupportData) → response: "Here are 7 campaigns...", citations: [...]
Activity 11: message (bot, role=0)                 → "Here are **7 active campaigns**:\n\n| ID | Name |..." replyToId → Activity 4
Activity 12: event   (DynamicPlanFinished)         → planId: "plan-1"
Activity 13: invoke  (message/submitAction)        → reaction: "like", feedbackText: "Great!" replyToId → Activity 11
Activity 14: trace   (SessionInfo)                 → outcome: "Resolved", turnCount: 2, type: "Engaged"
```

**Key relationships:** Activity 11 `replyToId` → Activity 4 (user question). Steps 6-9 all share `replyToId` → Activity 4. This is how Timeline ↔ Debug sync works.

### ⚡ Autonomous Transcript (flow-triggered)

SharePoint file creation triggers Power Automate → agent searches knowledge → sends email:

```
Activity 1:  trace   (ConversationInfo)            → isDesignMode: false (production!)
Activity 2:  event   (startConversation)           → channelId: "pva-autonomous"
Activity 3:  message (user, role=1)                → "Use content from {...}" channelData: {triggerTest: {flowId, trigger: {displayName: "When a file is created"}}}
Activity 4:  event   (DynamicPlanReceived)         → steps: ["P:UniversalSearchTool"]
Activity 5:  event   (DynamicPlanStepTriggered)    → type: "KnowledgeSource", thought: "Search for guidance..."
Activity 6:  event   (DynamicPlanStepFinished)     → observation: {search_result: {search_results: [...]}}
Activity 7:  event   (DynamicPlanReceived)         → steps: ["agent.action.Office365Outlook-SendanemailV2"] (2nd plan!)
Activity 8:  event   (DynamicPlanStepTriggered)    → thought: "Send email to user with summary..."
Activity 9:  event   (connectors/consentCard)      → {} (agent needs connector auth)
Activity 10: message (user, role=1)                → "" channelData: {postBack: true} — auto-consent
Activity 11: event   (DynamicPlanStepFinished)     → observation: {Response: null}, state: "completed"
Activity 12: message (bot, role=0)                 → "Processing your document."
Activity 13: trace   (SessionInfo)                 → outcome: "Abandoned", outcomeReason: "UserExit"
```

**Key differences from chat:** Multiple sequential plans, `postBack` messages (not human), `connectors/consentCard`, `type: "KnowledgeSource"` on steps, different observation formats.

### 🧪 Evaluation Transcript (test run)

Studio evaluation harness sends test input:

```
Activity 1:  trace   (ConversationInfo)            → isDesignMode: true
Activity 2:  event   (startConversation)           → channelId: "pva-studio"
Activity 3:  message (user, role=1)                → "Tell me a joke" channelData: {testMode: "Text", enableDiagnostics: true, clientActivityID: "test-123"}
Activity 4:  event   (DialogTracing)               → actions: [{actionType: "ConditionGroup"}]
Activity 5:  event   (DialogTracing)               → actions: [{actionType: "SendActivity"}]
Activity 6:  message (bot, role=0)                 → "Why did the chicken..." channelData: {feedbackLoop: {type: "default"}}
Activity 7:  trace   (SessionInfo)                 → outcome: "None", turnCount: 1, type: "Engaged"
```

**Key signals:** `testMode` + `enableDiagnostics` in user channelData, lots of `DialogTracing`, no plan steps (simple topic-based flow).

### 🛠️ Design Transcript (studio test pane)

Maker testing in the Copilot Studio test pane, doesn't type anything:

```
Activity 1:  trace   (ConversationInfo)            → isDesignMode: true
Activity 2:  event   (startConversation)           → channelId: "pva-studio"
Activity 3:  message (bot, role=0)                 → "Hello, how can I help?"
Activity 4:  trace   (SessionInfo)                 → outcome: "None", turnCount: 1, type: "Unengaged"
```

**Minimal:** No user message. `type: "Unengaged"`, `turnCount: 1`. User identity only from `startConversation` event's `from.aadObjectId`.

---

## 2. Top-Level Record Structure

Every Dataverse `conversationtranscript` record:

```json
{
  "conversationtranscriptid": "808e73f9-9c76-482f-b313-2475ddd13659",
  "name": "802a9ad2-157a-4f9d-b576-2762c06917b7_0f1b3dac-0e03-2458-d311-1ac1fb4c8f61",
  "createdon": "2026-03-16T02:17:42Z",
  "conversationstarttime": "2026-03-16T01:43:27Z",
  "metadata": "{\"BotId\":\"...\",\"BotName\":\"...\",\"AADTenantId\":\"...\",\"BatchId\":0}",
  "content": "{\"activities\":[...]}",
  "schematype": "powervirtualagents",
  "schemaversion": "0.2.2",
  "_bot_conversationtranscriptid_value": "..."
}
```

**Notes:**
- `name` format: `{conversationGuid}_{botId}`
- `createdon` ≠ conversation time (it's when the transcript record was written)
- `_bot_conversationtranscriptid_value` does NOT match `BotId` from metadata — use `metadata.BotName` for agent matching

---

## 2. Metadata Field

JSON string with consistent keys:

```json
{
  "BotId": "0f1b3dac-0e03-2458-d311-1ac1fb4c8f61",
  "AADTenantId": "1557f771-4c8e-4dbd-8b80-dd00a88e833e",
  "BotName": "copilots_header_csamsft_serff_agent",
  "BatchId": 0
}
```

| Key | Type | Notes |
|-----|------|-------|
| `BotId` | GUID | Agent identifier |
| `BotName` | string | Schema name (not display name) — e.g. `msftcsa_testbot` |
| `AADTenantId` | GUID | Azure AD tenant |
| `BatchId` | number or string | Always `0` or `""` in all samples; purpose unclear |

**No additional metadata keys observed across 1,549 records.**

---

## 3. Content → Activities Array

The `content` field is a JSON string:

```json
{
  "activities": [
    { "type": "trace", "timestamp": 1775589131, "from": {...}, "valueType": "ConversationInfo", "value": {...} },
    { "type": "event", "timestamp": 1775589131, "from": {...}, "name": "startConversation", ... },
    { "type": "message", "timestamp": 1775589134, "from": {...}, "text": "...", ... },
    ...
  ]
}
```

### Common Activity Fields

```json
{
  "id": "unique-activity-id",
  "type": "trace|event|message|invoke|invokeResponse|endOfConversation|conversationUpdate|installationUpdate",
  "timestamp": 1775589131,
  "from": {
    "id": "user-or-bot-id",
    "role": 0,
    "aadObjectId": "aad-guid"
  },
  "name": "EventName",
  "channelId": "pva-studio",
  "textFormat": "markdown|plain",
  "text": "message content",
  "attachments": [],
  "replyToId": "parent-activity-id",
  "channelData": {},
  "value": {},
  "valueType": "TraceType"
}
```

**Roles:** `0` = bot, `1` = user

---

## 4. Activity Types

| Type | Description | Frequency |
|------|-------------|-----------|
| `event` | Named events (plan steps, dialog tracing, server init) | ~50-90% of activities |
| `trace` | Telemetry traces with `valueType` (session info, errors, variables) | ~5-33% |
| `message` | Actual conversation messages (user + bot) | ~3-17% |
| `invoke` | OAuth token exchange, feedback submission | Rare (~0.06%) |
| `invokeResponse` | Response to invoke | Rare |
| `endOfConversation` | Signals conversation end | Rare (autonomous runs) |
| `conversationUpdate` | Session lifecycle update | Rare |
| `installationUpdate` | Installation state change | Rare |

### endOfConversation snippet
```json
{
  "type": "endOfConversation",
  "timestamp": 1776020008,
  "from": { "id": "bot-id", "role": 0 },
  "value": { "code": "completedSuccessfully" }
}
```
**Parser:** Catch-all in `advancedEvents.ts` → category `"activity"`, 📋 icon. Not a dedicated parsed type.

### conversationUpdate snippet
```json
{
  "type": "conversationUpdate",
  "timestamp": 1776000000,
  "from": { "id": "", "role": 0 },
  "membersAdded": [{ "id": "user-id" }]
}
```
**Parser:** Catch-all in `advancedEvents.ts` → category `"activity"`. Signals session membership change, no dedicated parsing.

### invokeResponse snippet
```json
{
  "type": "invokeResponse",
  "timestamp": 1776000001,
  "from": { "id": "bot-id", "role": 0 },
  "value": { "status": 200, "body": {} }
}
```
**Parser:** Not caught by any handler — `invokeResponse` is not in the catch-all activity types list. Effectively silently dropped (no UI rendering). Only the initiating `invoke` matters.

### installationUpdate snippet
```json
{
  "type": "installationUpdate",
  "timestamp": 1776000000,
  "from": { "id": "", "role": 0 },
  "action": "add"
}
```
**Parser:** Catch-all in `advancedEvents.ts` → category `"activity"`, 📋 icon. Signals bot installation/removal.

---

## 5. Trace ValueTypes

### ConversationInfo (1 per transcript)
```json
{
  "valueType": "ConversationInfo",
  "type": "trace",
  "value": {
    "lastSessionOutcome": "Abandoned",
    "lastSessionOutcomeReason": "UserExit",
    "isDesignMode": true,
    "locale": "en-US"
  }
}
```
**Key signal:** `isDesignMode` for classification.

### SessionInfo (1 per transcript)
```json
{
  "valueType": "SessionInfo",
  "type": "trace",
  "value": {
    "startTimeUtc": "2026-04-07T19:12:11Z",
    "endTimeUtc": "2026-04-07T19:16:56Z",
    "type": "Engaged",
    "outcome": "Abandoned",
    "turnCount": 4,
    "impliedSuccess": false,
    "outcomeReason": "UserExit"
  }
}
```
**Session types:** `Engaged`, `Unengaged`
**Outcomes:** `Resolved`, `Abandoned`, `None`, `Escalated`, `HandOff`
**Outcome reasons:** `UserExit`, `NoError`, `Resolved`, `UserError`

### ErrorTraceData
```json
{
  "valueType": "ErrorTraceData",
  "type": "trace",
  "value": {
    "errorCode": "ConnectorRequestFailure",
    "errorMessage": "The connector 'ServiceNow' returned an HTTP error with code 401.",
    "errorSubCode": "",
    "isUserError": true
  }
}
```
**Known error codes:** `ConnectorRequestFailure`, `SystemError`, `ConsentNotProvidedByUser`

### VariableAssignment
```json
{
  "valueType": "VariableAssignment",
  "type": "trace",
  "value": {
    "id": "Global.MyVariable",
    "name": "MyVariable",
    "newValue": "some value",
    "type": "String"
  }
}
```
**Noisy system variables (filtered):** `Topic.CurrentTime`, `Global.CurrentTime`, `System.*`

### DialogRedirect
```json
{
  "valueType": "DialogRedirect",
  "type": "trace",
  "value": {
    "targetDialogId": "msftcsa_bot.topic.OnError",
    "targetDialogType": "EventHandler"
  }
}
```

### UnknownIntent
```json
{
  "valueType": "UnknownIntent",
  "type": "trace",
  "value": {}
}
```

### GPTAnswer
```json
{
  "valueType": "GPTAnswer",
  "type": "trace",
  "value": {
    "gptAnswerState": "Answered"
  }
}
```
**States:** `Answered`, `NotAnswered`, `Filtered`

### HandOff / EscalationRequested
```json
{
  "valueType": "HandOff",
  "type": "trace",
  "value": {
    "escalationType": "AgentTransfer"
  }
}
```

### KnowledgeTraceData
```json
{
  "valueType": "KnowledgeTraceData",
  "type": "trace",
  "value": {
    "completionState": "Answered",
    "isKnowledgeSearched": true,
    "citedKnowledgeSources": ["agent.topic.KnowledgeSource1"],
    "failedKnowledgeSourcesTypes": []
  }
}
```

### IntentRecognition
```json
{
  "valueType": "IntentRecognition",
  "type": "trace",
  "value": {
    "intentName": "ServiceNowHelp",
    "score": 0.92,
    "topIntent": "ServiceNowHelp"
  }
}
```
**Frequency:** 139x in research dataset. Very useful for debugging topic routing.

### NodeTraceData
```json
{
  "valueType": "NodeTraceData",
  "type": "trace",
  "value": {
    "nodeId": "node-abc-123",
    "nodeType": "ConditionGroup",
    "actionType": "Condition"
  }
}
```
**Frequency:** 229x across evals+research. Shows dialog node execution path.

### IntentCandidates
```json
{
  "valueType": "IntentCandidates",
  "type": "trace",
  "value": {
    "candidates": [
      { "intentName": "TopicA", "score": 0.85 },
      { "intentName": "TopicB", "score": 0.42 }
    ]
  }
}
```

### Survey Types (rare)
```json
{ "valueType": "CSATSurveyRequest", "type": "trace", "value": {} }
{ "valueType": "CSATSurveyResponse", "type": "trace", "value": {} }
{ "valueType": "PRRSurveyRequest", "type": "trace", "value": {} }
{ "valueType": "PRRSurveyResponse", "type": "trace", "value": {} }
```

### ImpliedSuccess (rare)
```json
{ "valueType": "ImpliedSuccess", "type": "trace", "value": {} }
```

---

## 6. Event Names

### Dialog Tracing (most common event)
```json
{
  "type": "event",
  "name": "DialogTracing",
  "value": {
    "actions": [{
      "actionId": "action-guid",
      "topicId": "topic-guid",
      "actionType": "ConditionGroup|SendActivity|SetVariable|InvokeConnectorAction|CancelAllDialogs"
    }]
  }
}
```

### startConversation
```json
{
  "type": "event",
  "name": "startConversation",
  "from": { "id": "user-id", "aadObjectId": "aad-guid", "role": 1 },
  "channelId": "pva-studio"
}
```
**Key:** User identity fallback when no user messages exist.

### DynamicServer Lifecycle
```json
{ "name": "DynamicServerInitialize", "value": { "initializationResult": { "serverInfo": { "name": "ServerName", "version": "1.0" } }, "dialogSchemaName": "schema" } }
{ "name": "DynamicServerInitializeConfirmation", "value": {} }
{ "name": "DynamicServerToolsList", "value": { "toolsList": [{ "displayName": "Tool", "description": "...", "identifier": "id", "inputs": [] }] } }
{ "name": "DynamicServerCancellation", "value": {} }
{ "name": "DynamicServerError", "value": { "reasonCode": "...", "errorMessage": "...", "HttpStatusCode": 500 } }
```

### DynamicPlan Orchestration (see §13)
- `DynamicPlanReceived` / `DynamicPlanReceivedDebug`
- `DynamicPlanStepTriggered` / `DynamicPlanStepBindUpdate` / `DynamicPlanStepFinished`
- `DynamicPlanFinished`
- `DynamicPlanStepBlocked`

### DynamicPlanReceivedDebug
```json
{
  "type": "event",
  "name": "DynamicPlanReceivedDebug",
  "value": {
    "steps": ["P:UniversalSearchTool", "agent.action.Office365Outlook-SendanemailV2"],
    "isFinalPlan": true,
    "planIdentifier": "plan-guid",
    "debugInfo": "..."
  }
}
```
**Note:** No `valueType` on this event (unlike `DynamicPlanReceived` which has `valueType: "DynamicPlanReceived"`).

### Knowledge & Search (see §12)
- `UniversalSearchToolTraceData`
- `ResponseGeneratorSupportData`
- `GenerativeAnswersSupportData`

### Connector Events (see §15)
- `connectors/consentCard`
- `connectors/connectionManagerCard`

### Other Named Events
| Name | Count | Description |
|------|-------|-------------|
| `pvaSetContext` | 19x | PVA context injection for testing |
| `TEST-Clear-State` | 1x | Test directive: `/debug clearstate` |
| `webchat/join` | 36x | Web chat initialization |
| `SidePaneAgent.InitializeContext` | 20x | Side pane UI initialization |
| `ProtocolInfo` | 10x | Protocol handshake |
| `Microsoft.PowerApps.Copilot.CopilotFeatures` | 42x | Copilot feature flags |
| `Microsoft.PowerApps.Copilot.SetCanvasEntityContext` | 38x | Canvas context propagation |
| `Microsoft.PowerApps.Copilot.ResetConversation` | 3x | Conversation reset |
| `Microsoft.PowerApps.Copilot.SetModelFCSContext` | 3x | Field Control System context |
| `AIBuilderTraceData` | 3x | AI Builder activity trace |

---

## 7. Message Patterns

### User Message (interactive)
```json
{
  "type": "message",
  "from": { "id": "user-id", "aadObjectId": "aad-guid", "role": 1 },
  "text": "What campaigns are active?",
  "channelId": "msteams",
  "channelData": { "source": "teams", "tenant": "tenant-id" }
}
```

### Bot Message
```json
{
  "type": "message",
  "from": { "id": "bot-id", "role": 0 },
  "textFormat": "markdown",
  "text": "Here are **7 active campaigns**:\n\n| ID | Name |\n|---|---|",
  "replyToId": "user-message-id",
  "channelData": { "feedbackLoop": { "type": "default" } }
}
```

### Empty Bot Message (SharePoint-redacted)
```json
{
  "type": "message",
  "from": { "role": 0 },
  "text": "",
  "attachments": []
}
```
**Rendered as:** `🔒 [Response not stored in transcript — may contain knowledge source content]`

### Empty User Message (user action)
```json
{
  "type": "message",
  "from": { "role": 1 },
  "text": "",
  "attachments": []
}
```
**Rendered as:** `⚡ [User action]`

**Note on postBack:** PostBack messages (see below) also have empty text and currently render identically as `⚡ [User action]`. The parser does NOT yet distinguish postBack from other empty user messages — differentiating is a backlog item.
```json
{
  "type": "message",
  "text": "",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "body": [{ "type": "TextBlock", "text": "Connection needed", "weight": "Bolder" }],
      "actions": [{ "type": "Action.OpenUrl", "title": "Sign in", "url": "https://..." }]
    }
  }]
}
```

### OAuth Card Message
```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.oauth",
    "content": { "connectionName": "ServiceNow", "text": "Sign in to continue" }
  }]
}
```

### Autonomous / Flow-Triggered User Message
```json
{
  "type": "message",
  "from": { "role": 1 },
  "text": "Use content from {\"value\":[{\"@odata.etag\":\"\\\"1\\\"\",\"ItemInternalId\":\"121\",...}]}",
  "channelData": {
    "triggerTest": {
      "flowId": "c4a40956-0e11-f111-8406-002248081659",
      "flowRunId": "08584279862042023552360722729CU27",
      "trigger": {
        "id": "8f478b79-4da7-4e2a-9dab-fc89160d3f43",
        "displayName": "When a file is created (properties only)",
        "connectorDisplayName": "SharePoint",
        "connectorIconUri": "https://...sharepoint/icon.png"
      },
      "payload": "..."
    },
    "enableDiagnostics": true,
    "testMode": "Text"
  }
}
```

### PostBack Message (connector consent)
```json
{
  "type": "message",
  "from": { "role": 1 },
  "text": "",
  "channelData": {
    "postBack": true,
    "enableDiagnostics": true,
    "testMode": "Text",
    "clientActivityID": "70st7z2nf93"
  }
}
```
**Currently rendered as `⚡ [User action]`** — same as any empty user message. The `postBack` flag in channelData is not yet used for differentiation.

---

## 8. ChannelData Patterns

### Bot Message ChannelData
```json
{ "feedbackLoop": { "type": "default" } }
```

### Evaluation/Test User ChannelData
```json
{
  "attachmentSizes": [],
  "clientActivityID": "vu7l9w2dgzc",
  "enableDiagnostics": true,
  "testMode": "Text"
}
```

### Teams User ChannelData
```json
{ "source": "teams", "tenant": "tenant-guid" }
```

### Legacy Routing
```json
{ "legacy": true, "source": "webchat", "tenant": "tenant-guid" }
```

### All Known ChannelData Keys

| Key | Type | Context | Description |
|-----|------|---------|-------------|
| `feedbackLoop` | `{type}` | Bot messages | Feedback mechanism |
| `testMode` | `"Text"` | Eval user msgs | Test mode flag |
| `enableDiagnostics` | `boolean` | Eval user msgs | Diagnostic logging |
| `triggerTest` | `{flowId, flowRunId, trigger, payload}` | Autonomous user msgs | Power Automate flow trigger |
| `postBack` | `boolean` | Consent user msgs | Connector consent confirmation |
| `clientActivityID` | `string` | User msgs | Activity correlation |
| `attachmentSizes` | `[]` | User msgs | Attachment tracking |
| `source` | `string` | User msgs | Message source (teams, webchat) |
| `tenant` | `string` | User msgs | Tenant context |
| `legacy` | `boolean` | User msgs | Legacy feature flag |
| `settings` | `object` | Initialization | Configuration |
| `cci_trace_id` | `string` | Rare | Cloud Conversation Intelligence trace |
| `correlationId` | `string` | Rare | Distributed tracing |
| `pva:gpt-feedback` | `string` | Bot msgs | GPT feedback tags |
| `answersUrl1`-`4` | `string` | Rare | Answers API URLs |
| `DialogTraceDetail` | `object` | Rare | Dialog execution details |
| `CurrentMessageDetail` | `object` | Rare | Current message context |
| `DialogErrorDetail` | `object` | Rare | Error information |
| `ConversationUnderstandingDetail` | `object` | Rare | NLU/Intent details |
| `VariableDetail` | `object` | Rare | Variable state |
| `traceHistory` | `object` | Rare | Historical trace |
| `appId` | `string` | Rare | Application identifier |
| `userAgent` | `string` | Rare | Client user agent |
| `clientRequestId` | `string` | Rare | Request tracking |

---

## 9. Channel IDs

| Channel ID | Type | Description |
|-----------|------|-------------|
| `pva-studio` | Design/Eval | Copilot Studio test pane |
| `pva-autonomous` | Autonomous | Flow-triggered agent execution |
| `msteams` | Production | Microsoft Teams channel |
| `webchat` | Production | Web chat widget |
| `directline` | Production | Direct Line API |

---

## 10. Transcript Classification Signals

### Autonomous
- `channelId === "pva-autonomous"` OR
- `triggerTest` present in any user message channelData

### Evaluation
- `testMode` + `enableDiagnostics` in user message channelData (but no `triggerTest`)

### Design
- `isDesignMode === true` in ConversationInfo trace (and not evaluation)

### Chat (production)
- None of the above signals present

### Priority order: autonomous > design > evaluation > chat

---

## 11. Reactions / Feedback

### pva-studio Format (feedback as object)
```json
{
  "type": "invoke",
  "name": "message/submitAction",
  "replyToId": "bot-message-id",
  "value": {
    "actionName": "feedback",
    "actionValue": {
      "reaction": "like",
      "feedback": { "feedbackText": "Great response!" }
    }
  }
}
```

### Teams Format (feedback as double-encoded JSON string)
```json
{
  "type": "invoke",
  "name": "message/submitAction",
  "replyToId": "bot-message-id",
  "value": {
    "actionName": "feedback",
    "actionValue": {
      "reaction": "dislike",
      "feedback": "{\"feedbackText\":\"Not helpful\"}"
    }
  }
}
```

### Orphan Reactions
When `replyToId` points to a message from a *prior session's* transcript (not found in current transcript).

---

## 12. Knowledge & Search

### UniversalSearchToolTraceData
```json
{
  "type": "event",
  "name": "UniversalSearchToolTraceData",
  "value": {
    "toolId": "P:UniversalSearchTool",
    "knowledgeSources": ["agent.topic.KnowledgeSource1", "agent.topic.KnowledgeSource2"],
    "outputKnowledgeSources": ["agent.topic.KnowledgeSource1"],
    "fullResults": [...],
    "filteredResults": [...]
  }
}
```

### ResponseGeneratorSupportData
```json
{
  "type": "event",
  "name": "ResponseGeneratorSupportData",
  "value": {
    "query": "user question",
    "rewritten_query": "reformulated question",
    "response": "Full generated response text...",
    "completion_state": "Answered",
    "citations": [{ "Id": "1", "Text": "citation text" }]
  }
}
```
**Contains the actual generated response** — crucial when `message.text` is redacted (SharePoint knowledge). This is the "rich" knowledge response event.

### GenerativeAnswersSupportData
```json
{
  "type": "event",
  "name": "GenerativeAnswersSupportData",
  "value": {
    "completionState": "Answered",
    "gptAnswerState": "Answered",
    "searchTerms": "search query",
    "message": "user message",
    "rewrittenMessage": "reformulated"
  }
}
```
**Metadata about the generation process** — lighter than ResponseGeneratorSupportData. Does NOT contain the full generated response.

### Relationship between the two
- `ResponseGeneratorSupportData` — the **response content** (query, rewritten query, full response, citations). Used by `DebugPanel` to show the knowledge response section.
- `GenerativeAnswersSupportData` — **process metadata** (completion state, search terms). Used as an advanced debug event.
- They can co-occur in the same transcript. `ResponseGeneratorSupportData` is the one you want for the actual answer; `GenerativeAnswersSupportData` is supplementary diagnostic info.
- Both appear in agents using **generative answers / knowledge sources**. Neither appears in simple topic-only bots.

---

## 13. Plan Orchestration

### DynamicPlanReceived
```json
{
  "name": "DynamicPlanReceived",
  "valueType": "DynamicPlanReceived",
  "value": {
    "steps": ["P:UniversalSearchTool"],
    "isFinalPlan": false,
    "planIdentifier": "plan-guid"
  }
}
```

### DynamicPlanStepTriggered
```json
{
  "name": "DynamicPlanStepTriggered",
  "valueType": "DynamicPlanStepTriggered",
  "value": {
    "planIdentifier": "plan-guid",
    "stepId": "step-guid",
    "taskDialogId": "MCP:schema.topic:tool_name",
    "thought": "The user wants X. I'll call Y.",
    "state": 1,
    "hasRecommendations": false,
    "type": "KnowledgeSource"
  }
}
```
**`type` field** (new, autonomous only): `"KnowledgeSource"`, `"LlmSkill"`, etc.

### DynamicPlanStepBindUpdate
```json
{
  "name": "DynamicPlanStepBindUpdate",
  "value": {
    "taskDialogId": "MCP:schema.topic:tool_name",
    "stepId": "step-guid",
    "arguments": { "param1": "value1" },
    "planIdentifier": "plan-guid"
  }
}
```
**Note:** No `valueType` on this event.

### DynamicPlanStepFinished
```json
{
  "name": "DynamicPlanStepFinished",
  "value": {
    "taskDialogId": "MCP:schema.topic:tool_name",
    "stepId": "step-guid",
    "observation": { "content": [{ "text": "Tool output...", "type": "text" }] },
    "planIdentifier": "plan-guid",
    "state": "completed",
    "executionTime": "00:00:02.25",
    "planUsedOutputs": {}
  }
}
```

#### Observation Format Variants

**MCP tool observation** (content array):
```json
"observation": { "content": [{ "text": "Found 7 results", "type": "text" }] }
```

**Knowledge search observation** (search_result):
```json
"observation": {
  "downloaded_files": null,
  "search_result": {
    "search_errors": [],
    "search_results": [{ "FileType": "pdf", "Name": "doc.pdf", "IconUrl": "" }]
  }
}
```

**Connector action observation** (Response):
```json
"observation": { "Response": null }
```

### DynamicPlanFinished
```json
{
  "type": "event",
  "name": "DynamicPlanFinished",
  "valueType": "DynamicPlanFinished",
  "value": { "planId": "plan-guid" }
}
```
**Note:** This is `type: "event"` (not trace), but also has `valueType` set — one of the few events that does. Also appears in the trace valueTypes master list because the parser checks `valueType`.

### DynamicPlanStepBlocked
```json
{
  "name": "DynamicPlanStepBlocked",
  "value": {
    "stepId": "step-guid",
    "taskDialogId": "...",
    "messageBlockedError": {
      "code": "ContentFilter",
      "message": "Content was filtered"
    }
  }
}
```

---

## 14. Error Patterns

| Error Code | Source | Description |
|-----------|--------|-------------|
| `ConnectorRequestFailure` | Connector auth | HTTP error from connector (401, 500, etc.) |
| `SystemError` | System | Generic system error |
| `ConsentNotProvidedByUser` | Connector auth | User declined connector consent card |

### DynamicServerError
```json
{
  "name": "DynamicServerError",
  "value": {
    "reasonCode": "ServerError",
    "errorMessage": "MCP server failed",
    "HttpStatusCode": 500,
    "errorResponse": "...",
    "dialogSchemaName": "..."
  }
}
```

---

## 15. Connector & Auth Events

### connectors/consentCard
```json
{
  "type": "event",
  "name": "connectors/consentCard",
  "value": {}
}
```
Signals the agent requested connector auth consent from user.

### connectors/connectionManagerCard
```json
{
  "type": "event",
  "name": "connectors/connectionManagerCard",
  "value": {}
}
```
Connection management UI (different from consent).

### signin/tokenExchange
```json
{
  "type": "invoke",
  "name": "signin/tokenExchange",
  "value": { "connectionName": "ServiceNow", "token": "..." }
}
```
**Frequency:** 72x in research dataset. OAuth token exchange.

---

## 15.5 Multi-Agent (Connected Agents) Pattern

A Copilot Studio agent can be configured to call **other full agents** as connected (child) agents. The parent's planner picks a child to handle a turn, the child runs and produces messages, then control returns to the parent.

**Identifying signals:**
- Presence of `ConnectedAgentInitializeTraceData` events in the timeline
- A matching `ConnectedAgentCompletedTraceData` event later (same `planStepId`)
- A `DynamicPlanStepTriggered` with `type: "Action"` and `taskDialogId` of the form `{parent}.InvokeConnectedAgentTaskAction.{Child}` whose `value.thought` describes the routing rationale

**Critical caveat:**
> **All bot messages share the parent's `from.id`.** The `from` field on a message activity is **not** reliable for identifying *which* agent (parent vs. child) actually spoke. The speaking child must be **inferred from timeline position** — any bot message whose timestamp falls between an `Initialize`/`Completed` pair was spoken by that child.

**Trace value shape (`ConnectedAgentInitializeTraceData`):**
```json
{
  "valueType": "ConnectedAgentInitializeTraceData",
  "value": {
    "botSchemaName": "msftcsa_HelpDeskAgent",
    "parentBotSchemaName": "msftcsa_MainITAgent",
    "planStepId": "step-uuid-…"
  }
}
```

**Plan step shape (linkable via `planStepId`):**
```json
{
  "name": "DynamicPlanStepTriggered",
  "value": {
    "stepId": "step-uuid-…",
    "type": "Action",
    "taskDialogId": "msftcsa_MainITAgent.InvokeConnectedAgentTaskAction.HelpDeskAgent",
    "thought": "Routing to Help-Desk-Agent because the user reported a ticketing-system issue."
  }
}
```

**Nesting:** Treat invocations as a stack — children may theoretically invoke grandchildren (not yet seen in the wild but the parser supports it).

**Errors inside a child window** (e.g. `signin/failure` invokes) belong to that child, not the parent.

**Display:**
- The viewer's **right panel** shows a small agent-name badge above each bot bubble (parent vs. child + accent color from a deterministic `schemaName → palette` hash); child bubbles get a left-border accent.
- The viewer's **left panel** ("Agent Activity") shows a "Connected Agents" routing summary listing each invocation in order, with the parent → child → parent flow and the planner's `thought`.

### Connected Agent Sessions (the child's own transcript)

Each connected child invocation **also produces its own separate transcript record** in Dataverse, owned by the child agent. These look like normal one-off transcripts in isolation, but they're really just "the child's slice" of a larger parent conversation.

**Single-file signals (heuristic, not bulletproof):**
- `metadata.BotName` matches a known child agent
- **Zero `ConnectedAgent*` traces** in own activities (the child never sees its own orchestration)
- `lastSessionOutcome === "Abandoned"` + `Reason === "UserExit"` is very common (child "session" ends abruptly when control returns to parent)
- Conversation is short, tightly scoped, often ends mid-topic

**Bulletproof identification (cross-transcript):**
A transcript is a connected agent session iff its `metadata.BotName` appears as `botSchemaName` in any `ConnectedAgentInitializeTraceData` event of *any other loaded transcript*. The viewer auto-learns this set at runtime from the loaded list.

**Filtering:** the viewer ships a "Hide connected agent sessions" toggle (default ON) that drops these transcripts from the list, so by default users see only the parent-perspective conversation. A `🔗 child` badge appears next to the agent name on rows that are connected agent sessions (visible whenever the toggle is off, or when no parent in the loaded set has invoked them yet).

**Cross-transcript navigation (Phase 2):** when both sides are loaded, the viewer wires up two-way links between them:
- **From a parent's invocation card:** a "View {child}'s side →" button opens the child-side transcript.
- **From a child-side detail view:** a banner at the top reads "🔗 This is a connected agent session — Open parent conversation ↑" linking back to the parent.

Matching is heuristic (no Dataverse FK exists): same `userAadObjectId` + child's `metadata.botName` matches the invocation's `childSchemaName` + start timestamps within ±10 minutes. Closest timestamp wins. Links only appear when a confident match is found in the currently-loaded set.

---

## 15.6 Provider Handoff Events (Genesys, Salesforce, etc.)

When a Copilot Studio agent escalates a conversation to an external system (a
contact-center platform, CRM live agent queue, ticketing tool, …) it does so by
emitting a bot-side `event` activity whose `name` ends in `Handoff`. The
external integration listens for that event and takes over.

**Detection rule (provider-agnostic):**

```
type === "event" && from.role === 0 && /handoff$/i.test(name)
```

The provider is whatever precedes `Handoff` in the event name:

| Event name              | Provider     |
|-------------------------|--------------|
| `GenesysHandoff`        | Genesys      |
| `SalesforceHandoff`     | Salesforce   |
| `LiveAgentHandoff`      | LiveAgent    |
| `ServiceNowHandoff`     | ServiceNow   |
| `<Anything>Handoff`     | `<Anything>` |

**Example payload** (real `GenesysHandoff` from a Providence transcript):

```json
{
  "id": "...",
  "type": "event",
  "timestamp": 1776799565,
  "from": { "id": "<botId>", "role": 0 },
  "name": "GenesysHandoff",
  "channelId": "pva-studio",
  "replyToId": "<id of triggering message>",
  "value": "The user initially asked for help with..."
}
```

**`value` is polymorphic.** Different providers (and different topic authors)
serialize their handoff context in different shapes. We've seen — and our
renderer handles — all of these:

- **String** (markdown summary text) — Genesys text handoff
- **Structured object / array** (case fields, routing hints, tags) — typical
  for CRM-style integrations
- **Primitive** (`number`, `boolean`) — rare but valid
- **Empty / null / missing** — the handoff still fires; we render
  `(no context payload)` so reviewers can still see that escalation occurred

**How we render it:** an inline collapsible callout box (🚪) injected into the
Message Timeline directly after the message it `replyToId`-references. The
callout shows provider, full event name, timestamp, and a polymorphic body
(markdown for strings, pretty-printed JSON for objects, inline text for
primitives). Visually distinct from message bubbles via a dashed border so it
reads as a system event, not a chat turn.

**Often paired with** a `DialogTracing` trace for an `Escalate` topic (e.g.
`crc5e_agentkrDG73.topic.Escalate`) firing immediately before/after the
handoff. The dialog trace identifies *which* topic decided to escalate; the
handoff event carries the payload sent to the external system.

---

## 15.7 D365 Omnichannel (LCW) Handoff Pattern

A second, completely different handoff shape — used by Microsoft's own
Dynamics 365 Customer Service when a Copilot Studio agent is wired into
the Omnichannel for Customer Service via the **Live Chat Widget (LCW)**.

Unlike the §15.6 provider events, D365 emits **no `*Handoff` event**. The
signal is split across three things:

```jsonc
// 1. EscalationRequested trace (intent acknowledged)
{ "valueType": "EscalationRequested", "type": "trace",
  "value": { "escalationRequestType": 1 }, "from": { "role": 0 } }

// 2. Bot transfer message (visible to user)
{ "type": "message", "from": { "role": 0 }, "channelId": "lcw",
  "text": "I am transferring you to a representative. Please hold..." }

// 3. HandOff trace — usually emitted twice in succession (no payload)
{ "valueType": "HandOff", "type": "trace", "value": {} }
{ "valueType": "HandOff", "type": "trace", "value": {} }

// 4. Session ends with outcome=HandOff
{ "valueType": "SessionInfo", "type": "trace",
  "value": { "outcome": "HandOff",
             "outcomeReason": "AgentTransferRequestedByUser" } }
```

### ⚠ The PVA Escalate-not-configured fake-out

Critically, PVA's **built-in Escalate system topic** emits the SAME
`EscalationRequested` + `HandOff` traces even when escalation is NOT
configured. The bot tells the user *"Escalating to a representative is not
currently configured"* and the session may end as either:

  - `outcome=Abandoned`, `outcomeReason=UserError`, OR
  - `outcome=HandOff`, `outcomeReason=AgentTransferFromQuestionMaxAttempts`

So a `HandOff` trace alone — and even `outcome=HandOff` alone — is
**unreliable**. The discriminator is `outcomeReason`:

| `outcomeReason` prefix | Meaning | Real handoff? |
|---|---|---|
| `AgentTransferRequestedBy*` | Explicit user/bot ask | ✅ yes |
| `AgentTransferFrom*` | System bailout (max attempts, unknown intent) | ❌ no |
| anything else | Various fail/abandon | ❌ no |

### Detection rule (used by the parser)

We treat a transcript as a real D365 handoff only when **all three** are true:

1. `outcome === "HandOff"` (SessionInfo or ConversationInfo)
2. `outcomeReason` starts with `"AgentTransferRequestedBy"`
3. `channelId === "lcw"` — channel actually wired to a human queue

When the rule matches, the parser **synthesizes** a single `HandoffEvent`
(provider `"D365 Omnichannel"`, attached to the bot's transfer message)
so the transcript surfaces in the same list filter and inline 🚪 callout
as §15.6 custom event handoffs. Duplicate `HandOff` traces are deduped.

If we ever see legitimate non-LCW handoffs in the wild (other Omnichannel
channels, custom DirectLine integrations) we'll need to revisit the
channel gate.

---

## 15.8 D365 Omnichannel Session Context (msdyn_*)

When an LCW visitor opens a chat, D365 sends a `startConversation` event
from the visitor side carrying the full Omnichannel session context:

```jsonc
{
  "type": "event", "name": "startConversation",
  "from": { "role": 1 },
  "channelId": "lcw",
  "channelData": { "tags": "ChannelId-lcw,OmnichannelContextMessage,Hidden",
                   "sourceChannelId": "omnichannel" },
  "value": {
    "msdyn_liveworkitemid":   "<work item GUID — primary D365 record id>",
    "msdyn_ConversationId":   "<usually equal to liveworkitemid>",
    "msdyn_sessionid":        "<session GUID>",
    "msdyn_WorkstreamId":     "<workstream / queue GUID>",
    "msdyn_ChannelInstanceId":"<channel instance GUID>",
    "msdyn_Locale":           "en-US",
    "msdyn_browser":          "Edge",
    "msdyn_device":           "Desktop",
    "msdyn_os":               "Windows",
    "msdyn_msdyn_ocliveworkitem_msdyn_livechatengagementctx_liveworkitemid": [
      { "RecordId": "<contact GUID>", "PrimaryDisplayValue": "<email or name>" }
    ]
  }
}
```

The activity is tagged `Hidden` so it's not meant to render as a chat
turn. We surface it as the **🌐 D365 Omnichannel** card above the timeline,
with a Web API deep link to the work item.

### Authenticated visitors → OIDC claims

When the LCW is configured for authentication, the same `value` payload
**also** carries OIDC claims about the signed-in visitor:

```jsonc
{
  "sub":                "<stable user id>",
  "preferred_username": "john.doe@hls-mock.com",
  "email":              "john.doe@hls-mock.com",
  "given_name":         "John",
  "family_name":        "Doe",
  "phone_number":       "555-100-0001"
}
```

Recognized OIDC keys: `sub`, `preferred_username`, `email`, `given_name`,
`family_name`, `phone_number`. We treat `sub` as the marker for "this
session is authenticated" and surface the rest as the **🔐 Authenticated
visitor** card with a PII reveal toggle.

---

## 16. Unhandled / Future Patterns

These were observed but are **not yet parsed** by our app. Monitor for increased frequency:

| Pattern | Type | Count | Notes |
|---------|------|-------|-------|
| `MS.PA.CopilotFeatures` | event | 11x | Power Apps copilot feature flags |
| `MS.PA.DVCopilot` | event | 5x | Dataverse copilot |
| `SetModelNavigationContext` | channelData | 8x | Navigation state propagation |
| `SetModelPageContext` | channelData | 8x | Page context propagation |
| `answersUrl1`-`4` | channelData | 16x ea | Answers API endpoints (A/B testing?) |

---

## 17. Parser Internals (for developers)

### Catch-All Exclusion Lists

The catch-all in `advancedEvents.ts` has **two allowlists** of patterns that are handled elsewhere (and thus excluded from catch-all rendering):

**Handled event names** (have dedicated parsing in `parseTranscript.ts` or dedicated advanced event handlers):
```
DialogTracing, DynamicServerInitialize, DynamicServerToolsList,
DynamicPlanReceived, DynamicPlanReceivedDebug, DynamicPlanStepTriggered,
DynamicPlanStepBindUpdate, DynamicPlanStepFinished, DynamicPlanFinished,
UniversalSearchToolTraceData, ResponseGeneratorSupportData,
GenerativeAnswersSupportData, DynamicServerError, DynamicPlanStepBlocked,
startConversation, DynamicServerInitializeConfirmation
```

**Handled trace valueTypes** (have dedicated handlers in `advancedEvents.ts` or `parseTranscript.ts`):
```
ConversationInfo, SessionInfo, ErrorTraceData, VariableAssignment,
DialogRedirect, UnknownIntent, GPTAnswer, HandOff, EscalationRequested,
KnowledgeTraceData, IntentRecognition, NodeTraceData
```

**Catch-all triggers when:**
- Activity type is `endOfConversation`, `conversationUpdate`, or `installationUpdate`
- OR: `type === "event"` with a `name` NOT in the handled event names list
- OR: `type === "trace"` with a `valueType` NOT in the handled trace types list

**NOT caught:** `message` (always parsed as messages), `invoke` (only `message/submitAction` with `feedback` is parsed as reaction), `invokeResponse` (silently dropped — only the initiating invoke matters).

### DynamicPlanReceived vs DynamicPlanReceivedDebug

Both events appear for the same plan. They **co-occur** — you get both for each plan the orchestrator creates:
- `DynamicPlanReceived` — has `valueType: "DynamicPlanReceived"`, minimal payload
- `DynamicPlanReceivedDebug` — has NO `valueType`, includes additional `debugInfo` field with LLM reasoning details

The parser treats both as `"planReceived"` type. In the UI, they feed the plan step display but don't render separately.

### mergePlanSteps and Multiple Plans

`mergePlanSteps()` merges by `stepId` (not `planIdentifier`). Each step has a unique `stepId`, so steps from different plans stay separate. In the DebugPanel, all steps render in chronological order — plan boundaries are visible via the `planIdentifier` field but not explicitly grouped in the UI.

### replyToId Coverage

Not all activities have `replyToId`:
- **Always have it:** Bot messages (reply to user message), plan step events (Triggered/BindUpdate/Finished), knowledge events
- **Sometimes have it:** Advanced traces (IntentRecognition, ErrorTraceData) — depends on whether they relate to a specific user turn
- **Never have it:** ConversationInfo, SessionInfo, startConversation, DynamicServerInitialize/ToolsList

Activities without `replyToId` appear in the DebugPanel **outside** any message group (at the top or bottom of the timeline).

### Reaction Values

Only two reaction values are known: `"like"` and `"dislike"`. No other values have been observed across 1,549 transcripts. The parser maps anything that isn't `"like"` to `"dislike"` as a fallback.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-12 | Initial creation from analysis of 1,549 transcripts across 5 environments |
| 2026-04-12 | v2: Added walkthroughs, decision tree, master checklists, catch-all docs, parser internals |
