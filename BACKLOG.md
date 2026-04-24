# MCS Conversation Viewer — Backlog & Transcript Analysis Findings

> Last updated: April 12, 2026
> Based on analysis of **1,523 transcripts** across 3 environments (evals: 219, research: 1,292, pipeline: 12)

---

## 🔬 Transcript Analysis Findings

### Transcript Type Classification (4 types discovered)

| Type | Icon | Detection Heuristic | Prevalence |
|------|------|---------------------|------------|
| **Interactive** | 💬 | No test flags, no flow trigger | Production user chats |
| **Autonomous** | ⚡ | `triggerTest` in channelData OR `channelId="pva-autonomous"` | Flow-triggered runs (pipeline) |
| **Evaluation** | 🧪 | `testMode=true` + `enableDiagnostics=true` in user channelData | Evals: 54%, Research: 69% |
| **Design** | 🛠️ | `isDesignMode=true` + `channelId="pva-studio"` | Pipeline: 92%, Evals: 64% |

### New ValueTypes Not in Parser (8)

| ValueType | Occurrences | Description |
|-----------|-------------|-------------|
| `IntentRecognition` | 139x | Intent classification results — very useful for debugging topic routing |
| `NodeTraceData` | 229x | Dialog node execution trace (which node fired, in what order) |
| `IntentCandidates` | 4x | Alternative intent options the system considered |
| `CSATSurveyRequest` | 1x | Customer satisfaction survey prompt |
| `CSATSurveyResponse` | 1x | CSAT feedback response |
| `PRRSurveyRequest` | 3x | Power Rate Request survey prompt |
| `PRRSurveyResponse` | 1x | PRR survey response |
| `ImpliedSuccess` | 1x | System-inferred conversation success |

### New Activity Names Not Handled (18+)

| Activity Name | Count | Type | Description |
|---------------|-------|------|-------------|
| `endOfConversation` | 4x | activity type | Signals conversation end (new activity TYPE, not just name) |
| `conversationUpdate` | 37x | activity type | Session lifecycle update |
| `installationUpdate` | 39x | activity type | Installation state change |
| `signin/tokenExchange` | 72x | invoke | OAuth token exchange flow |
| `connectors/connectionManagerCard` | 6x | event | Connection management UI (different from consentCard) |
| `TEST-Clear-State` | 1x | event | Explicit test directive: `/debug clearstate` |
| `pvaSetContext` | 19x | event | PVA context injection for testing |
| `DynamicServerInitialize` | 12x | event | MCP server setup |
| `DynamicServerInitializeConfirmation` | 12x | event | MCP server setup confirmation |
| `DynamicServerToolsList` | 7x | event | MCP tool discovery |
| `DynamicServerCancellation` | 1x | event | MCP server cancellation |
| `AIBuilderTraceData` | 3x | event | AI Builder activity trace |
| `webchat/join` | 36x | event | Web chat initialization |
| `SidePaneAgent.InitializeContext` | 20x | event | Side pane UI initialization |
| `ProtocolInfo` | 10x | event | Protocol handshake |
| `Microsoft.PowerApps.Copilot.CopilotFeatures` | 42x | event | Copilot feature flags |
| `Microsoft.PowerApps.Copilot.SetCanvasEntityContext` | 38x | event | Canvas context propagation |
| `Microsoft.PowerApps.Copilot.ResetConversation` | 3x | event | Conversation reset |

### New ChannelData Keys Discovered

**Diagnostic/Tracing:**
- `clientActivityID` (1,068x) — activity correlation
- `cci_trace_id` (40x) — Cloud Conversation Intelligence trace
- `correlationId` (22x) — distributed tracing
- `testMode` (896x) — evaluation mode flag (value: `"Text"`)
- `enableDiagnostics` (951x) — diagnostic logging flag

**AI/Knowledge:**
- `pva:gpt-feedback` (74x) — GPT feedback tags
- `answersUrl1/2/3/4` (16x each) — Answers API URLs (possible A/B testing)

**Context Propagation:**
- `SetCanvasEntityContext`, `SetModelFCSContext`, `SetModelNavigationContext`, `SetModelPageContext`, `SetModelAppUniqueNameContext`

**Tracing Detail Objects:**
- `DialogTraceDetail`, `CurrentMessageDetail`, `DialogErrorDetail`, `ConversationUnderstandingDetail`, `VariableDetail` (9x each)

### Autonomous Transcript Patterns (from pipeline file)

- **`triggerTest`** in channelData contains: `flowId`, `flowRunId`, `trigger.displayName`, `trigger.connectorDisplayName`, `trigger.connectorIconUri`
- **`postBack: true`** messages = connector consent confirmations (not human input)
- **`connectors/consentCard`** event = agent requested auth consent
- **`BatchId`** in metadata = batch processing indicator
- **Plan step `type` field** = `"KnowledgeSource"` on DynamicPlanStepTriggered (not present in interactive transcripts)
- **Two-step orchestration**: Search knowledge → Send email, triggered by SharePoint file creation

---

## 📋 Backlog Items

### 🔴 High Priority — Parser & Classification

#### 1. `autonomous-parser` — Comprehensive Parser Enhancements
**Scope:** Core parser changes to handle all newly discovered patterns

- Add `transcriptType` field to `ParsedTranscript`: `"interactive" | "autonomous" | "evaluation" | "design"`
- Detection heuristics (see classification table above)
- Parse 8 new ValueTypes (IntentRecognition, NodeTraceData, surveys, etc.)
- Handle 18+ new activity names
- Extract `triggerTest` from channelData (flow trigger metadata)
- Detect `postBack` messages — show as "[Connector consent]" instead of "[User action]"
- Parse `testMode` / `enableDiagnostics` flags
- Surface `BatchId` from metadata
- Extract `channelId` from ConversationInfo
- Extract plan step `type` field from DynamicPlanStepTriggered

#### 2. `autonomous-filter` — Transcript Type Filter (4 types)
**Depends on:** `autonomous-parser`

- Filter dropdown on list page: All / 💬 Interactive / ⚡ Autonomous / 🧪 Evaluation / 🛠️ Design
- Visual badge/icon on each list row
- Client-side detection (requires parsing content)
- For autonomous: show trigger source (e.g. "SharePoint → When a file is created")
- For evaluation: show test indicator

#### 3. `autonomous-detail-view` — Enhanced Detail View Per Type
**Depends on:** `autonomous-parser`

- **Autonomous:** Trigger source in GeneralInfo, dimmed postBack messages, plan step type labels, consent/connectionManager events
- **Evaluation:** "🧪 Evaluation Run" badge, testMode/diagnostics indicators, TEST-Clear-State events
- **Design:** "🛠️ Design Mode" badge
- **All types:** New advanced events (IntentRecognition, NodeTraceData, surveys, endOfConversation, signin/tokenExchange, DynamicServer lifecycle, AIBuilderTraceData)

---

### 🟡 Medium Priority — UX Features

#### 4. `dark-mode` — ✅ DONE (v1.0.5)
CSS variables + 🌙/☀️ toggle. Respects system preference, saves to localStorage.

#### 5. `triage-badges` — Error Triage Badges in List View
Color-code transcripts: 🟢 clean, 🟡 warnings (unknown intent, short session), 🔴 errors/failures/escalations. Makers scan for problems instantly.

#### 6. `common-questions` — Most Common User Questions
Parse user messages across loaded transcripts, group similar questions, show top 10 most frequent asks in Analytics view. Helps makers identify what users need most.

#### 7. `keyboard-shortcuts` — Keyboard Shortcuts
Esc = back to list, ↑↓ = navigate rows, Enter = open selected, / = focus search, B = toggle basic/advanced, E = export.

#### 8. `zoom-message` — Zoom/Expand Long Messages
Needs better UX design. Initial double-click approach was removed. Consider: visible expand icon, modal overlay for wide tables/long markdown responses.

---

### 🟢 Low Priority — Performance & Testing

#### 9. `content-indexing` — Content Indexing for Instant Search
Pre-parse transcript content on load, build client-side search index for instant full-text search across messages, thinking, tool names, errors.

#### 10. `e2e-tests` — End-to-End Browser Tests
Playwright or Cypress: full app flow — load list, filter, open transcript, verify panels, search, navigate back. Requires mock Dataverse API or test environment. Best done on local drive (not NAS).

---

### 📥 Ongoing

#### 11. `new-transcript-samples` — Provide New Transcript Samples
User to provide additional transcript samples to discover more activity types, edge cases, and content patterns. Each new environment/agent type may reveal patterns we haven't seen.

---

### 🛠️ ALM / Repo Hygiene

#### 12. `solution-in-repo` — ✅ DONE (April 2026)

Unpacked solution lives under [`solution/`](./solution/). Tracks 2 flows (`Get-Agents`, `Get-Transcripts`), connection reference (`msftcsa_MCSConvoViewerDataverse`), and the Code App metadata stub. Compiled bundle (`*_CodeAppPackages/`) is gitignored — regenerated on every `power-apps push`. See [`solution/README.md`](./solution/README.md) for pack/unpack workflow.

**Bonus verified:** flow trigger schema confirms our `flowDataSource.ts` legend — `text` is `envUrl`, `text_6` is `fetchXml`.

#### 13. `code-app-mda-coexistence` — Solve Code App ↔ Solution Coupling
**Context:** If the solution grows to include a model-driven app that references the Code App, the Code App becomes a hard solution dependency. Need a clean pattern to avoid double-sourcing the compiled bundle.

**Options to evaluate:**
- **A (recommended starting point):** Single solution, gitignore `CanvasApps/*.msapp`, keep metadata stub. `power-apps push` keeps the live component fresh; MDA reference holds via stub.
- **B:** Two-solution split — `Infra` (flows + conn ref + MDA) in git, `App` (Code App only) auto-managed by `power-apps push`. Cross-solution reference via publisher prefix.
- **C:** Pre-commit hook strips `.msapp`, CI repacks before import.

Pick + document once we actually add the MDA.

#### 14. `contributing-md` — Author CONTRIBUTING.md
**Why:** No onboarding doc today. New contributor would have to reverse-engineer setup.

**Should cover:**
- Repo layout (`my-app/` Code App vs `solution/` Dataverse artifacts)
- One-time env setup: `pac solution pack` → import → wire up connection reference → turn on flows
- Per-dev-cycle: `npm install` → `npx power-apps refresh-data-source` → `npm run dev` (local) or `npx power-apps push` (publish)
- How to regenerate `src/generated/` after flow signature changes
- Branching model (main, Dev, demo/* branches)
- Build/lint/test commands (`npm run build`, `npm run lint`, `npm run test`)
- How to update the FLOW INPUT LEGEND in `flowDataSource.ts` when adding/changing flows

**Depends on:** `solution-in-repo` (so the steps actually point at real folders).

---

## 📊 Data Sources Analyzed

| File | Records | Agents | Key Finding |
|------|---------|--------|-------------|
| `ralop-mcs-evals.txt` | 219 | 2 | 63.5% design mode, 53.9% evaluation, new surveys + intent types |
| `pfekpresearch.txt` | 1,292 | 90 | 69.4% testMode, 18+ new activity names, rich Copilot platform events |
| `ralop-agent-pipeline.txt` | 12 | 3 | `pva-autonomous` channel, `endOfConversation` type, ServiceNow errors |
| Previous autonomous sample | 1 | 1 | `triggerTest`, `postBack`, `connectors/consentCard`, plan step `type` |
