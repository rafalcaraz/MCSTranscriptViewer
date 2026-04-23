// Compact typeahead for picking a Dataverse environment. Renders inline in the
// TranscriptList filter toolbar so the env picker lives next to the date /
// search filters instead of in a separate "card" above the list.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { EnvOption } from "./BrowseEnvironmentsWorkspace";

interface Props {
  envs: EnvOption[];
  selectedEnvUrl: string;
  onSelect: (apiUrl: string) => void;
}

function labelOf(env: EnvOption): string {
  return `${env.friendlyName} (${env.region})`;
}

export function EnvCombobox({ envs, selectedEnvUrl, onSelect }: Props) {
  const selected = envs.find((e) => e.apiUrl === selectedEnvUrl);
  const [query, setQuery] = useState<string>(selected ? labelOf(selected) : "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-sync query when the parent changes selection (e.g. cleared externally).
  useEffect(() => {
    setQuery(selected ? labelOf(selected) : "");
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // When the input matches the selected env's label, show full list (so
    // typing more or clearing reveals everything again).
    if (!q || (selected && q === labelOf(selected).toLowerCase())) return envs;
    return envs.filter((e) =>
      e.friendlyName.toLowerCase().includes(q) ||
      e.urlName.toLowerCase().includes(q) ||
      e.uniqueName.toLowerCase().includes(q) ||
      e.region.toLowerCase().includes(q),
    );
  }, [envs, query, selected]);

  // Close on click outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Restore label on blur if the user typed something that doesn't match.
        if (selected) setQuery(labelOf(selected));
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [selected]);

  const choose = (env: EnvOption) => {
    setQuery(labelOf(env));
    setOpen(false);
    onSelect(env.apiUrl);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const env = filtered[highlight];
      if (env) choose(env);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="filter-group env-combobox" style={{ flex: "1 1 320px", minWidth: 240, position: "relative" }} ref={containerRef}>
      <label>🌐 Environment</label>
      <input
        type="text"
        value={query}
        placeholder={envs.length === 0 ? "No environments" : "Type to search…"}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          // On focus, show the full list — and clear the field so typing
          // immediately filters from scratch instead of from the saved label.
          setOpen(true);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        spellCheck={false}
        autoComplete="off"
        aria-expanded={open}
        aria-haspopup="listbox"
        role="combobox"
      />
      {open && filtered.length > 0 && (
        <div className="user-dropdown" role="listbox" style={{ maxHeight: 320, overflowY: "auto" }}>
          {filtered.slice(0, 50).map((env, idx) => (
            <div
              key={env.apiUrl}
              role="option"
              aria-selected={idx === highlight}
              className={`user-dropdown-item${idx === highlight ? " highlighted" : ""}${env.apiUrl === selectedEnvUrl ? " selected" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); choose(env); }}
              onMouseEnter={() => setHighlight(idx)}
            >
              <div className="user-name">{env.friendlyName}</div>
              <div className="user-detail">
                <span>{env.region}</span>
                {env.urlName && <span> · {env.urlName}</span>}
              </div>
            </div>
          ))}
          {filtered.length > 50 && (
            <div className="user-dropdown-item loading">…and {filtered.length - 50} more — keep typing to narrow</div>
          )}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="user-dropdown">
          <div className="user-dropdown-item loading">No environments match</div>
        </div>
      )}
    </div>
  );
}
