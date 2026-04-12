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

**All Known Event Names (30+):**
`DialogTracing`, `startConversation`, `DynamicServerInitialize`, `DynamicServerInitializeConfirmation`, `DynamicServerToolsList`, `DynamicServerCancellation`, `DynamicServerError`, `DynamicPlanReceived`, `DynamicPlanReceivedDebug`, `DynamicPlanStepTriggered`, `DynamicPlanStepBindUpdate`, `DynamicPlanStepFinished`, `DynamicPlanFinished`, `DynamicPlanStepBlocked`, `UniversalSearchToolTraceData`, `ResponseGeneratorSupportData`, `GenerativeAnswersSupportData`, `connectors/consentCard`, `connectors/connectionManagerCard`, `pvaSetContext`, `TEST-Clear-State`, `webchat/join`, `SidePaneAgent.InitializeContext`, `ProtocolInfo`, `Microsoft.PowerApps.Copilot.CopilotFeatures`, `Microsoft.PowerApps.Copilot.SetCanvasEntityContext`, `Microsoft.PowerApps.Copilot.ResetConversation`, `Microsoft.PowerApps.Copilot.SetModelFCSContext`, `AIBuilderTraceData`, `MS.PA.CopilotFeatures`, `MS.PA.DVCopilot`

**All Known Invoke Names (2):**
`signin/tokenExchange`, `message/submitAction`

**All Known ChannelData Keys (28):**
`feedbackLoop`, `testMode`, `enableDiagnostics`, `triggerTest`, `postBack`, `clientActivityID`, `attachmentSizes`, `source`, `tenant`, `legacy`, `settings`, `cci_trace_id`, `correlationId`, `pva:gpt-feedback`, `answersUrl1`, `answersUrl2`, `answersUrl3`, `answersUrl4`, `DialogTraceDetail`, `CurrentMessageDetail`, `DialogErrorDetail`, `ConversationUnderstandingDetail`, `VariableDetail`, `traceHistory`, `appId`, `userAgent`, `clientRequestId`, `SetCanvasEntityContext`

**All Known Channel IDs (5):**
`pva-studio`, `pva-autonomous`, `msteams`, `webchat`, `directline`

**All Known Error Codes (3):**
`ConnectorRequestFailure`, `SystemError`, `ConsentNotProvidedByUser`

**All Known Attachment ContentTypes (2):**
`application/vnd.microsoft.card.adaptive`, `application/vnd.microsoft.card.oauth`

**All Known Session Outcomes (5):**
`Resolved`, `Abandoned`, `None`, `Escalated`, `HandOff`

**All Known Outcome Reasons (4):**
`UserExit`, `NoError`, `Resolved`, `UserError`

**All Known taskDialogId Formats:**
- `MCP:{schema}.topic:{toolName}` — MCP server tools
- `P:UniversalSearchTool` — built-in knowledge search
- `{agent_schema}.action.{Connector}-{ActionName}` — connector actions (e.g. `agent.action.Office365Outlook-SendanemailV2`)

**All Known DynamicPlanStepTriggered `type` values (2 observed):**
`KnowledgeSource`, `LlmSkill`

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
Has testMode + enableDiagnostics in user message channelData?
  └─ YES → 🧪 EVALUATION
Has isDesignMode === true in ConversationInfo?
  └─ YES → 🛠️ DESIGN
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

### Priority order: autonomous > evaluation > design > chat

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
