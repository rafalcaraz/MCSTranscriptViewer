import { useState, useRef, useEffect, useMemo } from "react";
import type { BotInfo } from "../../hooks/useLookups";

interface AgentMultiSelectProps {
  agents: BotInfo[];
  selectedSchemaNames: string[];
  onChange: (schemaNames: string[]) => void;
}

export function AgentMultiSelect({ agents, selectedSchemaNames, onChange }: AgentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => new Set(selectedSchemaNames), [selectedSchemaNames]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...agents].sort((a, b) =>
      (a.displayName || a.schemaName).localeCompare(b.displayName || b.schemaName)
    );
    if (!q) return sorted;
    return sorted.filter(
      (a) =>
        (a.displayName || "").toLowerCase().includes(q) ||
        a.schemaName.toLowerCase().includes(q)
    );
  }, [agents, query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (schemaName: string) => {
    const next = new Set(selected);
    if (next.has(schemaName)) next.delete(schemaName);
    else next.add(schemaName);
    onChange([...next]);
  };

  const clear = () => onChange([]);

  const buttonLabel = (() => {
    if (selectedSchemaNames.length === 0) return "All Agents";
    if (selectedSchemaNames.length === 1) {
      const match = agents.find((a) => a.schemaName === selectedSchemaNames[0]);
      return match?.displayName || match?.schemaName || "1 agent";
    }
    return `${selectedSchemaNames.length} agents`;
  })();

  return (
    <div className="agent-multiselect" ref={containerRef}>
      <button
        type="button"
        className={`agent-multiselect-trigger ${selectedSchemaNames.length > 0 ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={selectedSchemaNames.length > 0 ? selectedSchemaNames.join(", ") : "Filter by agent"}
      >
        🤖 {buttonLabel} <span className="agent-multiselect-caret">▾</span>
      </button>
      {open && (
        <div className="agent-multiselect-panel" role="listbox">
          <div className="agent-multiselect-search">
            <input
              autoFocus
              placeholder="Search agents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="agent-multiselect-list">
            {filtered.length === 0 && (
              <div className="agent-multiselect-empty">No agents match "{query}"</div>
            )}
            {filtered.map((agent) => {
              const isSelected = selected.has(agent.schemaName);
              return (
                <label
                  key={agent.schemaName}
                  className={`agent-multiselect-item ${isSelected ? "selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(agent.schemaName)}
                  />
                  <span className="agent-multiselect-text">
                    <span className="agent-multiselect-name">
                      {agent.displayName || agent.schemaName}
                    </span>
                    {agent.displayName && agent.displayName !== agent.schemaName && (
                      <span className="agent-multiselect-schema" title={agent.schemaName}>
                        {agent.schemaName}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
          <div className="agent-multiselect-footer">
            <span className="agent-multiselect-count">
              {selectedSchemaNames.length === 0
                ? "No filter — showing all agents"
                : `${selectedSchemaNames.length} selected`}
            </span>
            {selectedSchemaNames.length > 0 && (
              <button type="button" className="agent-multiselect-clear" onClick={clear}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
