import { useState, useEffect, useRef, useMemo } from "react";
import type { PlanStep, ToolDefinition, McpServerInfo, KnowledgeSearchTrace, KnowledgeResponse, KnowledgeTraceInfo, AdvancedEvent, ConnectedAgentInvocation, ParsedTranscript } from "../../types/transcript";
import { shortToolName, formatTimestamp } from "../../utils/parseTranscript";

interface DebugPanelProps {
  planSteps: PlanStep[];
  availableTools: ToolDefinition[];
  mcpServerInit?: McpServerInfo;
  knowledgeSearches: KnowledgeSearchTrace[];
  knowledgeResponses: KnowledgeResponse[];
  knowledgeTrace?: KnowledgeTraceInfo;
  advancedEvents: AdvancedEvent[];
  connectedAgentInvocations?: ConnectedAgentInvocation[];
  parentAgentDisplayName?: string;
  activeMessageId: string | null;
  onStepSelect: (replyToId: string | undefined) => void;
  /** Map keyed `${childSchemaName}__${startTimestamp}` → matched child transcript, when one is loaded. */
  childTranscriptLookup?: Map<string, ParsedTranscript>;
  onOpenTranscript?: (transcriptId: string) => void;
}

// Deterministic accent palette (mirrors MessageTimeline so the same agent gets the same color).
const AGENT_ACCENT_PALETTE = [
  "#4f8cff", "#7d5fff", "#22c55e", "#f59e0b",
  "#ec4899", "#14b8a6", "#ef4444", "#a855f7",
];

function agentAccentInline(schemaName: string): string {
  let hash = 0;
  for (let i = 0; i < schemaName.length; i++) {
    hash = (hash * 31 + schemaName.charCodeAt(i)) | 0;
  }
  return AGENT_ACCENT_PALETTE[Math.abs(hash) % AGENT_ACCENT_PALETTE.length];
}

// Unified timeline item for interleaved display
interface TimelineItem {
  kind: "step" | "knowledge" | "advanced";
  timestamp: number;
  replyToId?: string;
  step?: PlanStep;
  knowledgeSearch?: KnowledgeSearchTrace;
  knowledgeResponse?: KnowledgeResponse;
  advancedEvent?: AdvancedEvent;
}

export function DebugPanel({ planSteps, availableTools, mcpServerInit, knowledgeSearches, knowledgeResponses, knowledgeTrace, advancedEvents, connectedAgentInvocations, parentAgentDisplayName, activeMessageId, onStepSelect, childTranscriptLookup, onOpenTranscript }: DebugPanelProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const [advancedMode, setAdvancedMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debugSearchIndex, setDebugSearchIndex] = useState(0);
  const debugMatchRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const firstLinkedRef = useRef<HTMLDivElement>(null);

  // Build interleaved timeline sorted by timestamp
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    // Plan steps (use first timestamp from the step)
    for (const step of planSteps) {
      items.push({ kind: "step", timestamp: 0, replyToId: step.replyToId, step });
    }

    // Knowledge events
    for (const ks of knowledgeSearches) {
      items.push({ kind: "knowledge", timestamp: 0, replyToId: ks.replyToId, knowledgeSearch: ks });
    }
    for (const kr of knowledgeResponses) {
      items.push({ kind: "knowledge", timestamp: 0, replyToId: kr.replyToId, knowledgeResponse: kr });
    }

    // Advanced events (only in advanced mode)
    if (advancedMode) {
      for (const evt of advancedEvents) {
        items.push({ kind: "advanced", timestamp: evt.timestamp, replyToId: evt.replyToId, advancedEvent: evt });
      }
    }

    // Sort: items with timestamps sort by timestamp; items without go by their array order
    // For plan steps/knowledge, we use replyToId grouping to keep related items together
    return items;
  }, [planSteps, knowledgeSearches, knowledgeResponses, advancedEvents, advancedMode]);

  // Group timeline items by replyToId for chronological display
  const groupedTimeline = useMemo(() => {
    const groups = new Map<string, TimelineItem[]>();
    const ungrouped: TimelineItem[] = [];

    for (const item of timeline) {
      const key = item.replyToId ?? "";
      if (key) {
        const group = groups.get(key) ?? [];
        group.push(item);
        groups.set(key, group);
      } else {
        ungrouped.push(item);
      }
    }

    // Flatten: grouped items in order, then ungrouped
    const result: TimelineItem[] = [];
    const seen = new Set<string>();

    // Walk plan steps in order, inserting related advanced/knowledge events after each
    for (const step of planSteps) {
      const key = step.replyToId ?? "";
      result.push({ kind: "step", timestamp: 0, replyToId: step.replyToId, step });

      if (key && !seen.has(key)) {
        seen.add(key);
        const related = groups.get(key) ?? [];
        for (const item of related) {
          if (item.step) continue; // Already added
          result.push(item);
        }
      }
    }

    // Add knowledge/advanced items not linked to any plan step
    for (const [key, items] of groups) {
      if (seen.has(key)) continue;
      seen.add(key);
      for (const item of items) {
        result.push(item);
      }
    }

    // Add ungrouped items
    for (const item of ungrouped) {
      if (!item.step) result.push(item);
    }

    return result;
  }, [timeline, planSteps]);

  // Search filtering
  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const itemMatchesSearch = (item: TimelineItem): boolean => {
    if (!searchQuery) return true;
    if (item.step) {
      const s = item.step;
      return matchesSearch(s.thought) || matchesSearch(s.taskDialogId) ||
        matchesSearch(JSON.stringify(s.arguments ?? {})) || matchesSearch(s.observation ?? "");
    }
    if (item.knowledgeSearch) {
      return matchesSearch(item.knowledgeSearch.knowledgeSources.join(" "));
    }
    if (item.knowledgeResponse) {
      return matchesSearch(item.knowledgeResponse.query) || matchesSearch(item.knowledgeResponse.response);
    }
    if (item.advancedEvent) {
      return matchesSearch(item.advancedEvent.label) || matchesSearch(JSON.stringify(item.advancedEvent.details));
    }
    return true;
  };

  // Debug search navigation
  const debugMatchingIndices = useMemo(() => {
    if (!searchQuery) return [];
    return groupedTimeline
      .map((item, i) => itemMatchesSearch(item) ? i : -1)
      .filter((i) => i >= 0);
  }, [groupedTimeline, searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setDebugSearchIndex(0); }, [searchQuery]);

  useEffect(() => {
    if (debugMatchingIndices.length > 0) {
      const el = debugMatchRefs.current.get(debugMatchingIndices[debugSearchIndex]);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [debugSearchIndex, debugMatchingIndices]);

  const debugGoNext = () => setDebugSearchIndex((prev) => (prev + 1) % debugMatchingIndices.length);
  const debugGoPrev = () => setDebugSearchIndex((prev) => (prev - 1 + debugMatchingIndices.length) % debugMatchingIndices.length);

  // Linked items for message sync
  const isLinked = (item: TimelineItem) =>
    activeMessageId != null && item.replyToId === activeMessageId;

  // Auto-open and scroll to linked items
  useEffect(() => {
    if (!activeMessageId) return;
    const linkedSteps = planSteps.filter((s) => s.replyToId === activeMessageId);
    if (linkedSteps.length > 0) {
      setOpenSteps((prev) => {
        const next = new Set(prev);
        linkedSteps.forEach((s) => next.add(s.stepId));
        return next;
      });
      setTimeout(() => {
        firstLinkedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [activeMessageId, planSteps]);

  const toggleStep = (stepId: string) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const activeTool = availableTools.find((t) => t.identifier === selectedTool);
  let stepIndex = 0;

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Agent Activity</span>
        <button
          className={`mode-toggle ${advancedMode ? "active" : ""}`}
          onClick={() => setAdvancedMode(!advancedMode)}
        >
          {advancedMode ? "🔧 Advanced" : "📋 Basic"}
          {advancedEvents.length > 0 && !advancedMode && (
            <span className="advanced-count">{advancedEvents.length}</span>
          )}
        </button>
      </div>
      <div className="panel-body">
        {/* Search */}
        <div className="search-bar">
          <input
            className="debug-search"
            placeholder="Search agent activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.shiftKey ? debugGoPrev() : debugGoNext(); } }}
          />
          {searchQuery && debugMatchingIndices.length > 0 && (
            <div className="search-nav">
              <span className="search-count">{debugSearchIndex + 1}/{debugMatchingIndices.length}</span>
              <button className="search-nav-btn" onClick={debugGoPrev} title="Previous (Shift+Enter)">▲</button>
              <button className="search-nav-btn" onClick={debugGoNext} title="Next (Enter)">▼</button>
            </div>
          )}
          {searchQuery && debugMatchingIndices.length === 0 && (
            <span className="search-no-results">No matches</span>
          )}
        </div>

        {/* MCP Server Info */}
        {mcpServerInit && (
          <div className="server-info">
            <strong>{mcpServerInit.name}</strong>
            <span className="version"> v{mcpServerInit.version}</span>
          </div>
        )}

        {/* Available Tools */}
        {availableTools.length > 0 && (
          <div className="tools-section">
            <div className="section-label">Available Tools ({availableTools.length})</div>
            <div className="tools-list">
              {availableTools.map((tool) => (
                <button
                  key={tool.identifier}
                  className={`tool-badge ${selectedTool === tool.identifier ? "selected" : ""}`}
                  onClick={() => setSelectedTool(selectedTool === tool.identifier ? null : tool.identifier)}
                  title={tool.description}
                >
                  {tool.displayName}
                </button>
              ))}
            </div>
            {activeTool && (
              <div className="tool-detail">
                <strong>{activeTool.displayName}</strong>
                <div className="tool-desc">{activeTool.description}</div>
                {activeTool.inputs.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {activeTool.inputs.map((input) => (
                      <div key={input.name} className="tool-input">
                        • <code>{input.name}</code>
                        {input.isRequired && <span className="badge badge-danger" style={{ fontSize: 10, marginLeft: 4, padding: "1px 5px" }}>required</span>}
                        {" — "}{input.description}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Knowledge Trace Summary */}
        {knowledgeTrace && (
          <div className="knowledge-section">
            <div className="knowledge-label">
              📚 Knowledge: {knowledgeTrace.isKnowledgeSearched ? "Searched" : "Not searched"}
              {" — "}
              <span className={`badge ${knowledgeTrace.completionState === "Answered" ? "badge-success" : "badge-warning"}`}>
                {knowledgeTrace.completionState}
              </span>
            </div>
            {knowledgeTrace.failedKnowledgeSourcesTypes.length > 0 && (
              <div className="knowledge-label" style={{ color: "#c4314b" }}>
                ❌ Failed: {knowledgeTrace.failedKnowledgeSourcesTypes.join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Connected Agent Routing */}
        {connectedAgentInvocations && connectedAgentInvocations.length > 0 && (
          <div className="connected-agents-section">
            <div className="section-label">
              🔗 Connected Agents ({connectedAgentInvocations.length} routing{connectedAgentInvocations.length === 1 ? "" : "s"})
            </div>
            {connectedAgentInvocations.map((inv, i) => {
              const isLinked = activeMessageId != null && inv.messageIds.includes(activeMessageId);
              const childMatchKey = `${inv.childSchemaName}__${inv.startTimestamp}`;
              const childMatch = childTranscriptLookup?.get(childMatchKey);
              return (
                <div
                  key={`inv-${i}`}
                  className={`connected-agent-group ${isLinked ? "connected-agent-linked" : ""}`}
                  style={{ "--agent-accent": agentAccentInline(inv.childSchemaName) } as React.CSSProperties}
                >
                  <div className="connected-agent-header">
                    <span className="connected-agent-flow">
                      <span className="agent-name parent">{inv.parentDisplayName}</span>
                      <span className="connected-agent-arrow">→</span>
                      <span className="agent-name child" style={{ color: agentAccentInline(inv.childSchemaName) }}>
                        {inv.childDisplayName}
                      </span>
                      <span className="connected-agent-arrow">↩</span>
                      <span className="agent-name parent">{inv.parentDisplayName}</span>
                    </span>
                  </div>
                  {childMatch && onOpenTranscript && (
                    <button
                      className="connected-agent-child-link"
                      onClick={() => onOpenTranscript(childMatch.conversationtranscriptid)}
                      title={`Open ${inv.childDisplayName}'s side of this conversation (transcript ${childMatch.conversationtranscriptid})`}
                    >
                      View {inv.childDisplayName}'s side →
                    </button>
                  )}
                  {inv.thought && (
                    <>
                      <div className="step-section-label">🧠 Routing thought</div>
                      <div className="thought-box connected-agent-thought">{inv.thought}</div>
                    </>
                  )}
                  {inv.messageIds.length > 0 && (
                    <div className="connected-agent-messages">
                      <span className="step-section-label" style={{ display: "inline" }}>💬 Replied:</span>{" "}
                      {inv.messageIds.map((mid) => (
                        <button
                          key={mid}
                          className="connected-agent-msg-link"
                          onClick={() => onStepSelect(mid)}
                          title="Jump to message"
                        >
                          jump
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {parentAgentDisplayName && (
              <div className="connected-agents-hint">
                Parent: <strong>{parentAgentDisplayName}</strong>
              </div>
            )}
          </div>
        )}

        {/* Interleaved Timeline */}
        {groupedTimeline.length > 0 && (
          <div className="section-label" style={{ marginTop: 8 }}>
            Timeline ({planSteps.length} steps{advancedMode && advancedEvents.length > 0 ? ` + ${advancedEvents.length} events` : ""})
          </div>
        )}

        {groupedTimeline.map((item, i) => {
          if (!itemMatchesSearch(item)) return null;
          const linked = isLinked(item);

          // Plan Step
          if (item.step) {
            stepIndex++;
            const step = item.step;
            const isOpen = openSteps.has(step.stepId);
            const isFirst = linked && !groupedTimeline.slice(0, i).some((t) => isLinked(t));

            return (
              <div
                key={`step-${step.stepId}`}
                ref={isFirst ? firstLinkedRef : undefined}
                className={`step-item ${linked ? "step-linked" : ""}`}
              >
                <div
                  className="step-header"
                  onClick={() => toggleStep(step.stepId)}
                  onDoubleClick={() => onStepSelect(step.replyToId)}
                  title={step.replyToId ? "Double-click to highlight linked message" : undefined}
                >
                  <span className={`chevron ${isOpen ? "open" : ""}`}>▶</span>
                  <span className="step-num">{stepIndex}</span>
                  <span className="step-name">{shortToolName(step.taskDialogId)}</span>
                  <span className={`badge ${step.state === "completed" ? "badge-success" : step.state === "failed" || step.state === 1 ? "badge-danger" : "badge-info"}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                    {String(step.state)}
                  </span>
                  {step.executionTime && (
                    <span className="step-time">⏱ {step.executionTime}</span>
                  )}
                </div>
                {isOpen && (
                  <div className="step-body">
                    {step.thought && (
                      <>
                        <div className="step-section-label">🧠 Thought</div>
                        <div className="thought-box">{step.thought}</div>
                      </>
                    )}
                    {step.arguments && Object.keys(step.arguments).length > 0 && (
                      <>
                        <div className="step-section-label">📥 Arguments</div>
                        <div className="args-box">{JSON.stringify(step.arguments, null, 2)}</div>
                      </>
                    )}
                    {step.observation && (
                      <>
                        <div className="step-section-label">✅ Result</div>
                        <div className="observation-box">{step.observation}</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // Knowledge Search
          if (item.knowledgeSearch) {
            const ks = item.knowledgeSearch;
            return (
              <div key={`ks-${i}`} className={`knowledge-section ${linked ? "knowledge-linked" : ""}`} ref={linked ? firstLinkedRef : undefined}>
                <div className="knowledge-label">📚 Sources Searched:</div>
                <div className="knowledge-sources">
                  {ks.knowledgeSources.map((s, j) => (
                    <span key={j} className="knowledge-source-badge">
                      {s.includes(".file.") ? "📄" : s.includes("Bing") ? "🌐" : "📋"}{" "}
                      {s.split(".").pop()?.replace(/_/g, " ") ?? s}
                    </span>
                  ))}
                </div>
                {ks.searchResults.length > 0 && (
                  <details className="knowledge-response-detail" onClick={(e) => e.stopPropagation()}>
                    <summary>🔍 Search Results ({ks.searchResults.length})</summary>
                    {ks.searchResults.map((r, j) => (
                      <div key={j} className="search-result-item">
                        <div className="search-result-title">
                          {r.fileType ? `📄 ` : "🌐 "}{r.name || "Untitled"}
                        </div>
                        {r.text && (
                          <details className="search-result-content" onClick={(e) => e.stopPropagation()}>
                            <summary>View content ({r.text.length > 1000 ? `${Math.round(r.text.length / 1000)}K chars` : `${r.text.length} chars`})</summary>
                            <pre className="search-result-text">{r.text}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          }

          // Knowledge Response
          if (item.knowledgeResponse) {
            const kr = item.knowledgeResponse;
            return (
              <div key={`kr-${i}`} className={`knowledge-section ${linked ? "knowledge-linked" : ""}`} ref={linked ? firstLinkedRef : undefined}>
                <div className="knowledge-label">Query: <strong>{kr.query}</strong></div>
                <div className="knowledge-label">
                  State: <span className={`badge ${kr.completionState === "Answered" ? "badge-success" : "badge-warning"}`}>{kr.completionState}</span>
                </div>
                {kr.response && (
                  <details className="knowledge-response-detail">
                    <summary>📝 Generated Response (may not appear in chat)</summary>
                    <div className="knowledge-response-text">{kr.response}</div>
                  </details>
                )}
                {kr.citations.length > 0 && (
                  <details className="knowledge-response-detail">
                    <summary>📎 Citations ({kr.citations.length})</summary>
                    {kr.citations.map((c, j) => (
                      <div key={j} className="knowledge-citation">
                        <strong>[{c.id}]</strong> {c.text.slice(0, 150)}{c.text.length > 150 ? "..." : ""}
                      </div>
                    ))}
                  </details>
                )}
              </div>
            );
          }

          // Advanced Event
          if (item.advancedEvent) {
            const evt = item.advancedEvent;
            return (
              <div key={`adv-${i}`} className={`advanced-event ${evt.category} ${linked ? "event-linked" : ""}`}>
                <div className="advanced-event-header">
                  <span className="advanced-event-icon">{evt.icon}</span>
                  <span className="advanced-event-label">{evt.label}</span>
                  <span className="msg-timestamp">{formatTimestamp(evt.timestamp)}</span>
                </div>
                {Object.keys(evt.details).length > 0 && (
                  <div className="advanced-event-details">
                    {Object.entries(evt.details).map(([k, v]) => {
                      if (v === null || v === undefined || v === "") return null;
                      const display = typeof v === "object" ? JSON.stringify(v) : String(v);
                      if (display.length > 200) {
                        return (
                          <details key={k} className="advanced-detail-expandable">
                            <summary><strong>{k}:</strong> {display.slice(0, 80)}...</summary>
                            <div className="advanced-detail-full">{display}</div>
                          </details>
                        );
                      }
                      return <div key={k}><strong>{k}:</strong> {display}</div>;
                    })}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}

        {groupedTimeline.length === 0 && availableTools.length === 0 && (
          <p style={{ color: "#888", fontStyle: "italic" }}>
            No debug information available for this transcript.
          </p>
        )}
      </div>
    </div>
  );
}
