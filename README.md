# MCS Conversation Viewer

A **Power Apps Code App** for reviewing Copilot Studio conversation transcripts. Built for makers, admins, and support engineers who need to debug, investigate, and understand agent conversations across their organization.

Unlike the built-in Copilot Studio activity view (which only shows **your own** conversations and only goes back so far), this app lets you review **any user's conversations** with **any agent** you have access to — with full debug visibility into the agent's thinking, tool calls, knowledge searches, and connected-agent hand-offs.

![Power Apps Code App](https://img.shields.io/badge/Power%20Apps-Code%20App-purple)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7-yellow)
![Tests](https://img.shields.io/badge/tests-79-brightgreen)

---

## Why this exists

Debugging Copilot Studio agents from the maker portal hits real walls fast:

- **You can only see your own chats.** A user reports "the bot gave me a bad answer" — and you have nothing to look at.
- **The activity view is shallow.** You see the messages, not the *why*: which intent fired, which tool was called with what arguments, which knowledge source was searched, what the LLM was thinking.
- **Multi-agent flows are opaque.** When a parent agent hands off to a connected child agent (or a child hands back), there's no clear visualization of who-talked-to-who.
- **Cross-session reactions get lost.** A 👎 in Teams might be on a message from a session three days ago — the maker portal doesn't help you find it.

This app pulls directly from the `conversationtranscript` Dataverse table and renders it as a debug-first, side-by-side view: chat on the right, agent internals on the left.

---

## Features

### 📋 Transcript List

- Browse every conversation transcript you have access to, with sorting and pagination
- **Server-side filtering** (efficient OData queries):
  - Date range
  - Content `contains()` search
  - Agent (Copilot) selector
  - Specific user (AAD typeahead — see below)
- **Client-side refinement** on the loaded page:
  - Free-text search across messages, agent thinking, tool names, or user IDs
  - Outcome filter (Resolved / Abandoned / Escalated)
  - Feedback filter (find conversations with 👍 or 👎)
  - Minimum-turns filter (skip noise)
  - Transcript-type filter (see classification below)
- **AAD User column**: resolves user GUIDs to display names via the Dataverse `aaduser` virtual table
- **Hide connected-agent sub-sessions** (default: on) — keeps the list focused on real user-driven conversations rather than internal child-agent invocations

### 🔍 Transcript Detail — debug + timeline, side by side

Two-pane layout designed for "what happened and why":

**Right panel — Message Timeline**
- Chat-style bubbles for user / bot messages with timestamps and markdown rendering
- 👍 / 👎 reaction badges with the user's comment inline
- **Adaptive Card rendering** for connection consent, OAuth prompts, etc.
- **Per-bubble agent attribution** in multi-agent transcripts — color-coded chips so you can see exactly when control moved to a child agent
- **Redacted content indicators** (🔒) when SharePoint responses were stripped for security, with the underlying generated text surfaced from the debug data

**Left panel — Debug Panel**
- Agent **thinking / reasoning** at each plan step
- **Tool calls** with full arguments, results, execution time
- **Knowledge sources searched** — SharePoint, Bing, files, etc. — with citations and completion state
- **Connected-agent activity** — when the parent agent decides to invoke a child, the routing thought, the invocation, the child's response, and the hand-back
- **Linked sync between panels**: click a message → debug panel jumps to the plan steps that produced it (and vice versa)

### 🧠 Multi-agent (connected agents) visualization

When a parent Copilot Studio agent calls connected child agents, the app stitches it into one coherent picture:

- **Parent vs. child attribution** on every bot message bubble
- **Connected-agent invocations** rendered as expandable groups in the debug panel: routing thought → invocation activity → child's response → return to parent
- **Cross-transcript navigation**: each child invocation generates its own "connected agent session" transcript. From the parent view, jump straight into the child's full transcript and back.
- **List filter**: hide these child sub-session transcripts so you only see real user-initiated conversations (toggle in the filter bar)

### 💬 Reactions (including the cross-session case)

- 👍 / 👎 feedback on bot messages with user comments inline
- Handles both the `pva-studio` and Teams feedback formats (including the double-encoded JSON shape Teams uses)
- **Orphan reactions** — a user in Teams can react to a bot message from a *previous* session. The app detects these and offers an on-demand cross-transcript lookup to find the original conversation.

### 👤 User search

- AAD user typeahead in the filter bar — type a name or email
- Resolves to the user's AAD Object ID and filters server-side
- Substring matching is intentionally avoided (no false positives where a user's GUID happens to appear in another user's content)

### 🔗 Transcript ID is actionable

In the detail topbar:
- The conversation transcript GUID is a **clickable link** to the raw Dataverse Web API record (`/api/data/v9.2/conversationtranscripts(<id>)`) — handy for ops/support work
- 📋 button copies the GUID to clipboard
- The Dataverse environment URL is **auto-discovered** from the OData response on first load — zero configuration

### 🌐 Deep linking

Append `#t=<conversationtranscriptid>` to the app URL to land directly on a specific transcript. Browser back/forward works as expected.

### 📤 Export

- **PDF** — print-ready transcript export
- **HTML** — standalone HTML file for archival or sharing offline

### 🌓 Dark mode

System-aware with manual toggle. Persisted across sessions.

### 📊 Light analytics (optional)

Aggregate stats over the loaded set: total conversations, average turns, average duration, total tool calls, outcome breakdown, channel distribution. *Note: this app is intentionally focused on transcript inspection, not analytics.*

---

## Transcript classification

The app auto-classifies every transcript into one of four types based on signals in the activity stream:

| Type | Icon | Detection | When you'd see it |
|---|---|---|---|
| **Interactive** | 💬 | Default — no test/flow signals | Real user conversations in production |
| **Autonomous** | ⚡ | `triggerTest` in channelData *or* `channelId="pva-autonomous"` | Flow-triggered runs, scheduled agents |
| **Evaluation** | 🧪 | `testMode=true` + `enableDiagnostics=true` | Eval runs from the Test pane |
| **Design** | 🛠️ | `isDesignMode=true` + `channelId="pva-studio"` | Conversations from the maker's "Test your agent" pane |

A fifth pseudo-category — **connected agent sessions** — is detected and hidden by default in the list (toggle to show).

---

## Prerequisites

- A **Power Platform environment** with Copilot Studio agents that have produced conversation transcripts
- The following Dataverse tables accessible:
  - `conversationtranscript` — the conversation data
  - `bot` — agent display names
  - `aaduser` (virtual table) — user display name resolution

---

## Setup

### 1. Clone

```bash
git clone https://github.com/rafalcaraz/MCSTranscriptViewer.git
cd MCSTranscriptViewer
```

### 2. Install

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

The Power Apps Vite plugin prints a **Local Play URL**:

```
➜  Local Play: https://apps.powerapps.com/play/e/{environmentId}/a/local?_localAppUrl=...
```

**Open that URL** (not `localhost:5173` directly) — the Power Apps SDK only initializes inside the `apps.powerapps.com` wrapper.

### 5. Build for production

```bash
npm run build
```

Output goes to `./dist` — publish via `pac code push` or the Power Apps maker portal.

---

## Architecture

```
src/
├── App.tsx                              # Routing, lifted filter state, dark mode, hash deep-linking
├── types/
│   └── transcript.ts                    # All types: RawActivity, ParsedTranscript, ConnectedAgentInvocation, etc.
├── utils/
│   ├── parseTranscript.ts               # The core: classify type, classify activities, merge plan steps
│   ├── advancedEvents.ts                # Errors, intents, variables, catch-all activities
│   ├── findRelatedTranscripts.ts        # Parent ↔ child-session navigation
│   ├── dataverseEnvUrl.ts               # Auto-discover org URL from @odata.context
│   ├── exportTranscript.ts              # PDF + HTML export
│   └── formatters.ts                    # Timestamps, durations, OData escaping
├── hooks/
│   ├── useTranscripts.ts                # Dataverse fetch, OData filters, pagination, single-record load
│   └── useLookups.ts                    # AAD user typeahead + bot display name cache
├── state/
│   └── listFilters.ts                   # Lifted filter state shape
├── components/
│   ├── TranscriptList/
│   │   ├── TranscriptList.tsx           # Filters, table, pagination
│   │   └── UserSearch.tsx               # AAD typeahead
│   ├── TranscriptDetail/
│   │   ├── TranscriptDetail.tsx         # Detail container + topbar
│   │   ├── GeneralInfo.tsx              # Stats: agent, user, turns, duration, outcome
│   │   ├── MessageTimeline.tsx          # Chat bubbles + reactions + adaptive cards + agent attribution
│   │   ├── DebugPanel.tsx               # Plan steps, tools, knowledge, connected-agent invocations
│   │   ├── AdaptiveCardRenderer.tsx     # Lightweight inline renderer
│   │   └── OrphanReactionItem.tsx       # On-demand cross-transcript reaction lookup
│   └── Analytics/
│       └── AnalyticsSummary.tsx         # Aggregate stats
└── generated/                           # Auto-generated Dataverse service + models
```

---

## Transcript content structure

The app parses the `content` field of `conversationtranscript` records — a JSON document with an `activities[]` array. Activity types it understands:

| Activity Type | What It Contains |
|---|---|
| `ConversationInfo` (trace) | Session outcome, locale, design mode, root agent name |
| `message` (role=0/1) | User / bot messages with markdown text |
| `DynamicPlanStepTriggered` | Agent's thinking / reasoning |
| `DynamicPlanStepBindUpdate` | Tool call arguments |
| `DynamicPlanStepFinished` | Tool results + execution time |
| `DynamicServerToolsList` | Available MCP tools |
| `UniversalSearchToolTraceData` | Knowledge sources searched |
| `ResponseGeneratorSupportData` | Generated response text + citations |
| `KnowledgeTraceData` | Search completion state |
| `ConnectedAgentTraceData` | Parent → child agent routing decisions |
| `invoke/feedback` | User reactions (👍 / 👎) with comments |
| `SessionInfo` (trace) | Session duration, outcome, turn count |

See [`TRANSCRIPT-PATTERNS.md`](./TRANSCRIPT-PATTERNS.md) for a deeper dive into the activity stream patterns.

---

## Known limitations

- **SharePoint content redaction**: Copilot Studio strips bot responses that contain SharePoint knowledge source content from transcripts for security. The app shows a 🔒 indicator and recovers the generated response from the debug data when available.
- **Cross-session reactions**: Teams users can react to bot messages from previous sessions. These appear as "orphan reactions" with on-demand lookup to find the original message.
- **Adaptive card fidelity**: Cards render with a lightweight custom renderer that may not match the original tenant theming exactly.
- **SDK-only context**: The app must run inside the Power Apps wrapper (`apps.powerapps.com/play/...`). Bare `localhost:5173` won't bootstrap the Dataverse client.

---

## Tech stack

- **React 19** + **TypeScript 5.9** + **Vite 7**
- **@microsoft/power-apps** SDK for Dataverse
- **@microsoft/power-apps-vite** plugin for local development
- **Vitest** — 79 tests (55 parser + 24 component)
- **react-markdown** + **remark-gfm** for message rendering
- Plain CSS with CSS variables (dark mode, no UI framework dependency)
- GitHub Actions: release automation, Dependabot, CodeQL

---

## License

MIT
