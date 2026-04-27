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

#### 10. `e2e-tests` — End-to-End Browser Tests (in progress)

Playwright suite established under `e2e/`. Run with `npx playwright test --project=<smoke|stress|rbac-admin|rbac-limited> --headed`.

**Done:**
- One-time auth capture per persona → `e2e/.auth/<user>.json`
- Multi-persona setup (`AUTH_USER` env var, gitignored states)
- `.env`-driven config (`TEST_ENV_URL`, `e2e/.env.example` committed as template)
- **smoke** (12 tests): app shell, tabs, theme toggle, Browse-via-Flows controls, **invalid env URL → ErrorCard**, **date filter inputs**, **console error scrape (fails on real errors)**
- **stress** (4 tests): Transcripts pagination scroll-to-end, Browse-via-Flows pagination scroll-to-end, content-search narrowing, detail navigation
- **rbac** (2 tests): per-persona bot/transcript visibility capture + admin ≥ limited cross-check

**Backlog (next iterations):**
- **Date filter applies (assert row count narrows)** — currently only smoke-tests the inputs render
- **Bot multi-select filter** — central RBAC concern, picks change rendered set
- **Detail view depth** — message timeline renders, debug panel opens, search-within-transcript, attachment links work
- **Multi-transcript navigation** — open A → back → open B, assert state preserved
- **Theme persistence across reload**
- **Empty state copy** — assert "No transcripts found" vs "No transcripts match your filters"
- **Network failure injection** (`page.route()`) — fail flow mid-scroll, assert error banner + recovery
- **Race conditions** — change filter mid-load, assert no stale results
- **Visual regression** — Playwright `toHaveScreenshot()` on badges, skeletons, error cards
- **Vitest coverage report** — measure actual % exercised in flowDataSource.ts
- **CI** — Vitest on GH Actions; Playwright self-hosted runner if/when needed


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

#### 15. `code-app-template-extraction` — Extract Reusable Code App Boilerplate

**Why:** The patterns we built for this project (unpacked solution-in-repo, `solution:pack` / `:pack:managed` / `:pull` scripts, flow contract tests driven by unpacked workflow JSON, FLOW INPUT LEGEND comment block) are project-agnostic — they apply to **any** Power Apps Code App + Dataverse solution. Today they're hardcoded to this repo's app/solution names. Worth extracting once we have a second project to validate the abstraction.

**Reusable assets to extract:**
- `scripts/pack-solution.mjs` — generalize: read app logical name + solution unique name from `power.config.json` (or a new `solution.config.json`) instead of hardcoded constants
- `scripts/pull-solution.mjs` — same generalization
- `solution/.gitignore` — already generic, copy as-is
- `solution/README.md` — templatize the placeholders (solution name, conn ref name, flow names)
- `package.json` script aliases (`solution:pack` / `:pack:managed` / `:pull`)
- The "ground-truth contract testing" pattern: mock generated services with `vi.hoisted()`, assert against the actual unpacked flow JSON envelope (see `src/test/flowDataSource.contract.test.ts`)
- The FLOW INPUT LEGEND convention (see `src/components/BrowseFlows/flowDataSource.ts:13-32`) — codegen strips Power Automate UI titles, so document the `text` / `text_6` mappings inline

**Possible extraction targets:**
- A `create-power-code-app` npx scaffold (long-term)
- A separate `microsoft/power-code-app-template` repo (medium-term)
- A doc/blog post + GitHub gist linking back to specific files in this repo (short-term, lowest effort)

**Pitfall to remember:** Vite's content-hashed filenames + `<CodeAppPackageUris>` in `.meta.xml` need re-syncing on every pack — that's the entire point of `pack-solution.mjs`. A naïve template that just copies `dist/` into the solution will produce zips that import but render a blank page.

**Other findings worth carrying over (not just code):**
- `npx power-apps push` (NOT `pac code push`) is the working publish path for Code Apps as of 2026-04
- `BotsService.ts` codegen has a TS2352 issue that needs re-patching after every `power-apps refresh-data-source` (see KNOWLEDGE.md)
- Connection refs in solution exports carry env-specific `workflowName` GUIDs that drift on every flow republish — managed-import behavior across envs is still untested

---

## 📊 Data Sources Analyzed

| File | Records | Agents | Key Finding |
|------|---------|--------|-------------|
| `ralop-mcs-evals.txt` | 219 | 2 | 63.5% design mode, 53.9% evaluation, new surveys + intent types |
| `pfekpresearch.txt` | 1,292 | 90 | 69.4% testMode, 18+ new activity names, rich Copilot platform events |
| `ralop-agent-pipeline.txt` | 12 | 3 | `pva-autonomous` channel, `endOfConversation` type, ServiceNow errors |
| Previous autonomous sample | 1 | 1 | `triggerTest`, `postBack`, `connectors/consentCard`, plan step `type` |
