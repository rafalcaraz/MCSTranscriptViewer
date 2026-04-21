import type { ListFilterState } from "../../state/listFilters";
import type { BotInfo } from "../../hooks/useLookups";

/** Keys we know how to remove individually from the active-filters strip. */
export type RemovableFilterKey =
  | "dateRange"
  | "serverSearch"
  | "clientSearch"
  | "selectedBotIds"
  | "transcriptTypeFilter"
  | "outcomeFilter"
  | "feedbackFilter"
  | "minTurns"
  | "participantAadId";

interface ActiveFiltersProps {
  f: ListFilterState;
  agents: BotInfo[];
  onRemove: (key: RemovableFilterKey) => void;
  onClearAll: () => void;
}

interface ActiveChip {
  key: RemovableFilterKey;
  label: string;
  title?: string;
}

const TYPE_LABELS: Record<string, string> = {
  chat: "💬 Chat",
  autonomous: "⚡ Autonomous",
  evaluation: "🧪 Eval",
  design: "🛠️ Design",
};

const FEEDBACK_LABELS: Record<string, string> = {
  any: "Has feedback",
  likes: "Has 👍",
  dislikes: "Has 👎",
};

function formatShortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ActiveFilters({ f, agents, onRemove, onClearAll }: ActiveFiltersProps) {
  const chips: ActiveChip[] = [];

  if (f.dateFrom || f.dateTo) {
    const from = formatShortDate(f.dateFrom);
    const to = formatShortDate(f.dateTo);
    let label: string;
    if (from && to) label = `📅 ${from} → ${to}`;
    else if (from) label = `📅 from ${from}`;
    else label = `📅 until ${to}`;
    chips.push({ key: "dateRange", label });
  }

  if (f.participantAadId) {
    chips.push({
      key: "participantAadId",
      label: `👤 ${f.userSearchQuery || f.participantAadId}`,
      title: `Participant AAD: ${f.participantAadId}`,
    });
  }

  if (f.serverSearch) {
    chips.push({ key: "serverSearch", label: `🔎 "${f.serverSearch}"` });
  }

  if (f.selectedBotIds.length > 0) {
    let label: string;
    if (f.selectedBotIds.length === 1) {
      const match = agents.find((a) => a.schemaName === f.selectedBotIds[0]);
      label = `🤖 ${match?.displayName || match?.schemaName || f.selectedBotIds[0]}`;
    } else {
      label = `🤖 ${f.selectedBotIds.length} agents`;
    }
    chips.push({
      key: "selectedBotIds",
      label,
      title: f.selectedBotIds.join(", "),
    });
  }

  if (f.transcriptTypeFilter) {
    chips.push({
      key: "transcriptTypeFilter",
      label: TYPE_LABELS[f.transcriptTypeFilter] || f.transcriptTypeFilter,
    });
  }

  if (f.outcomeFilter) {
    const label = f.outcomeFilter === "Handoff" ? "🚪 Handed off" : `🎯 ${f.outcomeFilter}`;
    chips.push({ key: "outcomeFilter", label });
  }

  if (f.feedbackFilter) {
    chips.push({
      key: "feedbackFilter",
      label: FEEDBACK_LABELS[f.feedbackFilter] || f.feedbackFilter,
    });
  }

  const minTurnsNum = parseInt(f.minTurns, 10);
  if (minTurnsNum > 0) {
    chips.push({ key: "minTurns", label: `≥ ${minTurnsNum} turns` });
  }

  if (f.clientSearch.trim()) {
    chips.push({
      key: "clientSearch",
      label: `🔬 within: "${f.clientSearch.trim()}"`,
      title: `Client-side refine in: ${f.clientSearchIn}`,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="active-filters" role="region" aria-label="Active filters">
      <span className="active-filters-label">Filters:</span>
      {chips.map((chip) => (
        <span key={chip.key} className="active-filter-chip" title={chip.title}>
          <span className="active-filter-chip-label">{chip.label}</span>
          <button
            type="button"
            className="active-filter-chip-close"
            onClick={() => onRemove(chip.key)}
            aria-label={`Remove ${chip.label}`}
            title="Remove this filter"
          >
            ✕
          </button>
        </span>
      ))}
      {chips.length >= 2 && (
        <button type="button" className="active-filters-clear-all" onClick={onClearAll}>
          Clear all
        </button>
      )}
    </div>
  );
}
