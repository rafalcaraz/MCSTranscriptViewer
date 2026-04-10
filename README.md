# MCS Conversation Viewer

A **Power Apps Code App** for reviewing Copilot Studio conversation transcripts. Built for makers and admins who need to debug, investigate, and understand agent conversations across their organization.

Unlike the built-in Copilot Studio activity view (which only shows your own conversations), this app lets you review **any user's conversations** with **any agent** you have access to — with full debug visibility into the agent's thinking, tool calls, and knowledge searches.

![Power Apps Code App](https://img.shields.io/badge/Power%20Apps-Code%20App-purple)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7-yellow)

## Features

### 📋 Transcript List
- Browse all conversation transcripts with sorting and pagination
- **Server-side filters**: date range, content search (OData `contains()`)
- **Client-side refinement**: search by messages, agent thinking, tool names, or user ID
- **Agent filter**: dropdown to filter by specific Copilot Studio agent
- **Feedback filter**: find conversations with 👍/👎 reactions
- **User column**: resolves AAD Object IDs to display names

### 🔍 Transcript Detail (Debug + Timeline)
- **Message Timeline** (right panel): Chat-style view with user/bot message bubbles, timestamps, and markdown rendering
- **Debug Panel** (left panel): Agent thinking, tool calls with arguments/results, execution times
- **Linked sync**: Click a message → debug panel auto-scrolls to the plan steps that processed it (and vice versa)
- **Knowledge Sources**: Shows which sources were searched (SharePoint, Bing, files), the generated response, citations, and completion state
- **Adaptive Card rendering**: Connection consent cards, OAuth indicators
- **Redacted content indicators**: Clear messaging when SharePoint responses are stripped for security

### 💬 Reactions
- Display 👍/👎 feedback on bot messages with user comments
- Handles both pva-studio and Teams feedback formats (including double-encoded JSON)
- **Orphan reaction lookup**: On-demand search when a reaction references a message from a prior session
- Feedback counts in the transcript list

### 👤 User Lookup
- **AAD User typeahead**: Search by name or email to find a user's conversations
- Resolves user identity via the Dataverse `aaduser` virtual table
- Auto-searches transcripts by the selected user's AAD Object ID

### 📊 Analytics
- Aggregate stats: total conversations, average turns, average duration, total tool calls
- Outcome breakdown (Resolved, Abandoned, Escalated)
- Channel distribution

## Prerequisites

- A **Power Platform environment** with Copilot Studio agents that have conversation transcripts
- The following Dataverse tables accessible:
  - `conversationtranscript` — the conversation data
  - `bot` — agent display names
  - `aaduser` (virtual table) — user display name resolution

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/rafalcaraz/MCSTranscriptViewer.git
cd MCSTranscriptViewer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Initialize Power Apps connection

```bash
pac code init
```

This creates/updates `power.config.json` with your environment ID. Ensure the `databaseReferences` include `conversationtranscripts`, `bots`, and `aadusers` (see the existing `power.config.json` for the expected format).

### 4. Run locally

```bash
npm run dev
```

The Power Apps Vite plugin will print a **Local Play URL** in the console:
```
➜  Local Play: https://apps.powerapps.com/play/e/{environmentId}/a/local?_localAppUrl=...
```

Open that URL to run the app with full Dataverse access.

### 5. Build for production

```bash
npm run build
```

The built app is output to `./dist` and can be published to Power Apps.

## Architecture

```
src/
├── App.tsx                              # Root component with routing + filter state
├── types/
│   └── transcript.ts                    # Full typed model for all activity types
├── utils/
│   └── parseTranscript.ts               # Parses raw Dataverse content JSON into structured data
├── hooks/
│   ├── useTranscripts.ts                # Dataverse data fetching + OData filters + pagination
│   └── useLookups.ts                    # AAD user search + bot display name resolution
├── components/
│   ├── TranscriptList/
│   │   ├── TranscriptList.tsx           # List page with filters, table, pagination
│   │   └── UserSearch.tsx               # AAD user typeahead component
│   ├── TranscriptDetail/
│   │   ├── TranscriptDetail.tsx         # Detail page container
│   │   ├── GeneralInfo.tsx              # Stats bar (agent, user, turns, duration, etc.)
│   │   ├── MessageTimeline.tsx          # Chat bubbles with reactions + adaptive cards
│   │   ├── DebugPanel.tsx               # Plan steps, tools, knowledge sources
│   │   ├── AdaptiveCardRenderer.tsx     # Lightweight adaptive card renderer
│   │   └── OrphanReactionItem.tsx       # On-demand cross-transcript reaction lookup
│   └── Analytics/
│       └── AnalyticsSummary.tsx          # Aggregate stats view
└── generated/                           # Auto-generated Dataverse service + models
```

## Transcript Content Structure

The app parses the `content` field of `conversationtranscript` records, which contains a JSON `activities[]` array with:

| Activity Type | What It Contains |
|---|---|
| `ConversationInfo` (trace) | Session outcome, locale, design mode |
| `message` (role=0/1) | Bot/user messages with markdown text |
| `DynamicPlanStepTriggered` | Agent's thinking/reasoning |
| `DynamicPlanStepBindUpdate` | Tool call arguments |
| `DynamicPlanStepFinished` | Tool results + execution time |
| `DynamicServerToolsList` | Available MCP tools |
| `UniversalSearchToolTraceData` | Knowledge sources searched |
| `ResponseGeneratorSupportData` | Generated response, citations |
| `KnowledgeTraceData` | Search completion state |
| `invoke/feedback` | User reactions (👍/👎) with comments |
| `SessionInfo` (trace) | Session duration, outcome, turn count |

## Known Limitations

- **SharePoint content redaction**: Copilot Studio strips bot responses that contain SharePoint knowledge source content from transcripts for security. The app shows a 🔒 indicator and displays the generated response from the debug data when available.
- **Cross-session reactions**: Users in Teams can react to bot messages from previous sessions. These appear as "orphan reactions" with an on-demand lookup to find the original message.
- **Adaptive Card rendering**: Cards are rendered with a lightweight custom renderer that may not match the original appearance exactly.

## License

MIT
