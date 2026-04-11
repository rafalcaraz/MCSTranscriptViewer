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

export function DebugPanel({ planSteps, availableTools, mcpServerInit, knowledgeSearches, knowledgeResponses, knowledgeTrace, advancedEvents, activeMessageId, onStepSelect }: DebugPanelProps) {
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const [advancedMode, setAdvancedMode] = useState(false);
  const firstLinkedRef = useRef<HTMLDivElement>(null);

  // Steps linked to the active message
  const linkedStepIds = useMemo(() => {
    if (!activeMessageId) return new Set<string>();
    return new Set(
      planSteps
        .filter((s) => s.replyToId === activeMessageId)
        .map((s) => s.stepId)
    );
  }, [activeMessageId, planSteps]);

  // When a message is selected, auto-open and scroll to linked steps
  useEffect(() => {
    if (linkedStepIds.size > 0) {
      setOpenSteps((prev) => {
        const next = new Set(prev);
        linkedStepIds.forEach((id) => next.add(id));
        return next;
      });
      // Scroll after render
      setTimeout(() => {
        firstLinkedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [linkedStepIds]);

  const toggleStep = (stepId: string) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const activeTool = availableTools.find((t) => t.identifier === selectedTool);

  return (
    <div className="panel">
      <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Debug</span>
        <button
          className={`mode-toggle ${advancedMode ? "active" : ""}`}
          onClick={() => setAdvancedMode(!advancedMode)}
          title={advancedMode ? "Switch to basic view" : "Switch to advanced view"}
        >
          {advancedMode ? "🔧 Advanced" : "📋 Basic"}
          {advancedEvents.length > 0 && !advancedMode && (
            <span className="advanced-count">{advancedEvents.length}</span>
          )}
        </button>
      </div>
      <div className="panel-body">
        {mcpServerInit && (
          <div className="server-info">
            <strong>{mcpServerInit.name}</strong>
            <span className="version"> v{mcpServerInit.version}</span>
          </div>
        )}

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

        {/* Knowledge Sources */}
        {(knowledgeSearches.length > 0 || knowledgeResponses.length > 0) && (
          <div style={{ marginTop: 8 }}>
            <div className="section-label">📚 Knowledge Sources</div>
            {knowledgeSearches.map((ks, i) => {
              const isLinked = activeMessageId != null && ks.replyToId === activeMessageId;
              return (
              <div key={i} className={`knowledge-section ${isLinked ? "knowledge-linked" : ""}`} ref={isLinked ? firstLinkedRef : undefined}>
                <div className="knowledge-label">Sources Searched:</div>
                <div className="knowledge-sources">
                  {ks.knowledgeSources.map((s, j) => (
                    <span key={j} className="knowledge-source-badge">
                      {s.includes(".file.") ? "📄" : s.includes("Bing") ? "🌐" : s.includes("SharePoint") ? "📁" : "📋"}{" "}
                      {s.split(".").pop()?.replace(/_/g, " ") ?? s}
                    </span>
                  ))}
                </div>
                {ks.outputKnowledgeSources.length > 0 && (
                  <>
                    <div className="knowledge-label" style={{ marginTop: 4 }}>Sources Used:</div>
                    <div className="knowledge-sources">
                      {ks.outputKnowledgeSources.map((s, j) => (
                        <span key={j} className="knowledge-source-badge used">{s.split(".").pop()?.replace(/_/g, " ") ?? s}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              );
            })}
            {knowledgeResponses.map((kr, i) => {
              const isLinked = activeMessageId != null && kr.replyToId === activeMessageId;
              return (
              <div key={i} className={`knowledge-section ${isLinked ? "knowledge-linked" : ""}`} ref={isLinked && !firstLinkedRef.current ? firstLinkedRef : undefined}>
                <div className="knowledge-label">Query: <strong>{kr.query}</strong></div>
                {kr.rewrittenQuery !== kr.query && (
                  <div className="knowledge-label">Rewritten: <em>{kr.rewrittenQuery}</em></div>
                )}
                <div className="knowledge-label">
                  State: <span className={`badge ${kr.completionState === "Answered" ? "badge-success" : "badge-warning"}`}>{kr.completionState}</span>
                </div>
                {kr.response && (
                  <details className="knowledge-response-detail">
                    <summary>📝 Generated Response (from knowledge — may not appear in chat)</summary>
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
            })}
            {knowledgeTrace && (
              <div className="knowledge-section">
                <div className="knowledge-label">
                  Result: {knowledgeTrace.isKnowledgeSearched ? "Knowledge searched" : "Not searched"}
                  {" — "}
                  <span className={`badge ${knowledgeTrace.completionState === "Answered" ? "badge-success" : "badge-warning"}`}>
                    {knowledgeTrace.completionState}
                  </span>
                </div>
                {knowledgeTrace.failedKnowledgeSourcesTypes.length > 0 && (
                  <div className="knowledge-label" style={{ color: "#c4314b" }}>
                    ❌ Failed sources: {knowledgeTrace.failedKnowledgeSourcesTypes.join(", ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {planSteps.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 8 }}>Plan Steps ({planSteps.length})</div>
            {planSteps.map((step, index) => {
              const isOpen = openSteps.has(step.stepId);
              const isLinked = linkedStepIds.has(step.stepId);
              const isFirstLinked = isLinked && !planSteps.slice(0, index).some((s) => linkedStepIds.has(s.stepId));
              return (
                <div
                  key={step.stepId}
                  ref={isFirstLinked ? firstLinkedRef : undefined}
                  className={`step-item ${isLinked ? "step-linked" : ""}`}
                >
                  <div
                    className="step-header"
                    onClick={() => toggleStep(step.stepId)}
                    onDoubleClick={() => onStepSelect(step.replyToId)}
                    title={step.replyToId ? "Double-click to highlight linked message" : undefined}
                  >
                    <span className={`chevron ${isOpen ? "open" : ""}`}>▶</span>
                    <span className="step-num">{index + 1}</span>
                    <span className="step-name">{shortToolName(step.taskDialogId)}</span>
                    <span className={`badge ${step.state === "completed" ? "badge-success" : "badge-info"}`} style={{ fontSize: 11, padding: "2px 8px" }}>
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
            })}
          </>
        )}

        {planSteps.length === 0 && availableTools.length === 0 && (
          <p style={{ color: "#888", fontStyle: "italic" }}>
            No debug information available for this transcript.
          </p>
        )}

        {/* Advanced Events — only shown in advanced mode */}
        {advancedMode && advancedEvents.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label">🔧 Advanced Events ({advancedEvents.length})</div>
            {advancedEvents.map((evt, i) => {
              const isLinked = activeMessageId != null && evt.replyToId === activeMessageId;
              return (
                <div key={i} className={`advanced-event ${evt.category} ${isLinked ? "event-linked" : ""}`}>
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
            })}
          </div>
        )}

        {advancedMode && advancedEvents.length === 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="section-label">🔧 Advanced Events</div>
            <p style={{ color: "#888", fontStyle: "italic", fontSize: 12 }}>
              No additional events in this transcript.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
