import { useState, useEffect, useRef, useMemo } from "react";
import type { PlanStep, ToolDefinition, McpServerInfo, KnowledgeSearchTrace, KnowledgeResponse, KnowledgeTraceInfo, AdvancedEvent } from "../../types/transcript";
import { shortToolName, formatTimestamp } from "../../utils/parseTranscript";

interface DebugPanelProps {
  planSteps: PlanStep[];
  availableTools: ToolDefinition[];
  mcpServerInit?: McpServerInfo;
  knowledgeSearches: KnowledgeSearchTrace[];
  knowledgeResponses: KnowledgeResponse[];
  knowledgeTrace?: KnowledgeTraceInfo;
  advancedEvents: AdvancedEvent[];
  activeMessageId: string | null;
  onStepSelect: (replyToId: string | undefined) => void;
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

export function DebugPanel({ planSteps, availableTools, mcpServerInit, knowledgeSearches, knowledgeResponses, knowledgeTrace, advancedEvents, activeMessageId, onStepSelect }: DebugPanelProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const [advancedMode, setAdvancedMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
        <span>Debug</span>
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
        <input
          className="debug-search"
          placeholder="Search debug events..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

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
