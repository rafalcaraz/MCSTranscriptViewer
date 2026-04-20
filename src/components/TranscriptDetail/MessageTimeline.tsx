import { useState, useEffect, useRef, useMemo } from "react";
import type { ChatMessage, Reaction, AttachmentItem, AttachmentKind } from "../../types/transcript";
import { formatTimestamp } from "../../utils/parseTranscript";
import { OrphanReactionItem } from "./OrphanReactionItem";
import { AdaptiveCardRenderer } from "./AdaptiveCardRenderer";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ATTACHMENT_KIND_META: Record<AttachmentKind, { icon: string; label: string }> = {
  paste: { icon: "📋", label: "pasted inline" },
  upload: { icon: "⬆️", label: "uploaded file" },
  file: { icon: "📄", label: "file" },
  card: { icon: "🎴", label: "card" },
  unknown: { icon: "📎", label: "attachment" },
};

function attachmentItemTitle(item: AttachmentItem): string {
  const kindLabel = ATTACHMENT_KIND_META[item.kind].label;
  const parts: string[] = [`${kindLabel} — ${item.contentType}`];
  if (item.width && item.height) parts.push(`${item.width}×${item.height}`);
  if (item.altText) parts.push(`"${item.altText}"`);
  if (item.referenceId) parts.push(`ref: ${item.referenceId}`);
  return parts.join(" · ");
}

// Deterministic accent palette so the same agent gets the same color across re-renders.
const AGENT_ACCENT_PALETTE = [
  "#4f8cff", // blue
  "#7d5fff", // purple
  "#22c55e", // green
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
  "#a855f7", // violet
];

function agentAccent(schemaName: string): string {
  let hash = 0;
  for (let i = 0; i < schemaName.length; i++) {
    hash = (hash * 31 + schemaName.charCodeAt(i)) | 0;
  }
  return AGENT_ACCENT_PALETTE[Math.abs(hash) % AGENT_ACCENT_PALETTE.length];
}

interface MessageTimelineProps {
  messages: ChatMessage[];
  reactions: Reaction[];
  activeMessageId: string | null;
  onMessageSelect: (messageId: string) => void;
  onOpenTranscript?: (transcriptId: string) => void;
}

export function MessageTimeline({ messages, reactions, activeMessageId, onMessageSelect, onOpenTranscript }: MessageTimelineProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Build a map of messageId → reactions for quick lookup
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) {
      if (r.isOrphan) continue;
      const existing = map.get(r.replyToId) ?? [];
      existing.push(r);
      map.set(r.replyToId, existing);
    }
    return map;
  }, [reactions]);

  const orphanReactions = useMemo(() => reactions.filter((r) => r.isOrphan), [reactions]);

  // Auto-scroll to the highlighted message when selected from debug panel
  useEffect(() => {
    if (activeMessageId && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeMessageId]);

  const [messageSearch, setMessageSearch] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const matchRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Collect matching message indices
  const matchingIndices = useMemo(() => {
    if (!messageSearch) return [];
    return messages
      .map((msg, i) => msg.text.toLowerCase().includes(messageSearch.toLowerCase()) ? i : -1)
      .filter((i) => i >= 0);
  }, [messages, messageSearch]);

  // Reset search index when query changes
  useEffect(() => { setSearchIndex(0); }, [messageSearch]);

  // Scroll to current match
  useEffect(() => {
    if (matchingIndices.length > 0) {
      const idx = matchingIndices[searchIndex];
      const el = matchRefs.current.get(idx);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchIndex, matchingIndices]);

  const goNext = () => setSearchIndex((prev) => (prev + 1) % matchingIndices.length);
  const goPrev = () => setSearchIndex((prev) => (prev - 1 + matchingIndices.length) % matchingIndices.length);

  const renderMessageContent = (msg: ChatMessage) => {
    // Adaptive card or OAuth card — render with card component
    if (msg.attachments?.length && (msg.textFormat === "adaptive-card" || msg.textFormat === "oauth-card")) {
      return (
        <div>
          {msg.text && <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>}
          {msg.attachments.map((att, i) => (
            <div key={i}>
              <AdaptiveCardRenderer
                content={typeof att.content === "string" ? {} : att.content}
                contentType={att.contentType}
              />
              <div className="ac-disclaimer">⚠️ Adaptive Card — rendering may not match original</div>
            </div>
          ))}
        </div>
      );
    }

    // Regular bot message with markdown
    if (msg.role === "bot") {
      return <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>;
    }

    // User message — detect large JSON payloads and prettify them collapsed
    if (msg.role === "user" && msg.text.length > 200) {
      try {
        const jsonMatch = msg.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const prefix = msg.text.slice(0, msg.text.indexOf(jsonMatch[0])).trim();
          const pretty = JSON.stringify(parsed, null, 2);
          return (
            <div>
              {prefix && <div style={{ marginBottom: 4 }}>{prefix}</div>}
              <details className="json-collapse" onClick={(e) => e.stopPropagation()}>
                <summary>📋 JSON payload ({pretty.split("\n").length} lines) — click to expand</summary>
                <pre className="json-pretty">{pretty}</pre>
              </details>
            </div>
          );
        }
      } catch {
        // Not valid JSON — render as normal text
      }
    }

    // User message
    return <>{msg.text}</>;
  };

  return (
    <div className="panel">
      <div className="panel-title">Message Timeline</div>
      <div className="panel-body">
        <div className="search-bar">
          <input
            className="debug-search"
            placeholder="Search messages..."
            value={messageSearch}
            onChange={(e) => setMessageSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.shiftKey ? goPrev() : goNext(); } }}
          />
          {messageSearch && matchingIndices.length > 0 && (
            <div className="search-nav">
              <span className="search-count">{searchIndex + 1}/{matchingIndices.length}</span>
              <button className="search-nav-btn" onClick={goPrev} title="Previous (Shift+Enter)">▲</button>
              <button className="search-nav-btn" onClick={goNext} title="Next (Enter)">▼</button>
            </div>
          )}
          {messageSearch && matchingIndices.length === 0 && (
            <span className="search-no-results">No matches</span>
          )}
        </div>
        {messages.map((msg, msgIdx) => {
          // Search filter
          const matchesSearch = !messageSearch || msg.text.toLowerCase().includes(messageSearch.toLowerCase());
          const isCurrentMatch = matchingIndices[searchIndex] === msgIdx;

          // A message is "active" if:
          // - It's the selected user message (clicked directly)
          // - It's a bot message that replies to the selected user message
          const isActive =
            activeMessageId != null &&
            (msg.id === activeMessageId || msg.replyToId === activeMessageId);

          // For user messages, clicking selects them; for bot messages, clicking selects the user message they reply to
          const handleClick = () => {
            // Don't trigger sync if user is selecting/highlighting text
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;

            if (msg.role === "user") {
              onMessageSelect(msg.id);
            } else if (msg.replyToId) {
              onMessageSelect(msg.replyToId);
            }
          };

          return (
            <div
              key={msg.id}
              ref={(el) => {
                if (isActive && activeRef) (activeRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                if (matchesSearch && el) matchRefs.current.set(msgIdx, el);
              }}
              className={`message-row ${msg.role} ${isActive ? "active" : ""} ${isCurrentMatch ? "search-current" : ""}`}
              onClick={handleClick}
              style={{ cursor: "pointer", opacity: matchesSearch ? 1 : 0.3, transition: "opacity 0.2s" }}
            >
              <div>
                {msg.role === "bot" && msg.speakingAgent && (
                  <div
                    className={`agent-badge ${msg.speakingAgent.isChild ? "from-child" : "from-parent"}`}
                    style={{ "--agent-accent": agentAccent(msg.speakingAgent.schemaName) } as React.CSSProperties}
                    title={msg.speakingAgent.isChild ? `Child agent: ${msg.speakingAgent.schemaName}` : `Parent agent: ${msg.speakingAgent.schemaName}`}
                  >
                    <span className="agent-badge-dot" />
                    {msg.speakingAgent.displayName}
                    {msg.speakingAgent.isChild && <span className="agent-badge-tag">child</span>}
                  </div>
                )}
                <div
                  className={`msg-bubble ${msg.role} ${isActive ? "highlighted" : ""} ${isCurrentMatch ? "search-highlight" : ""} ${msg.speakingAgent?.isChild ? "from-child" : ""}`}
                  style={msg.speakingAgent?.isChild ? ({ "--agent-accent": agentAccent(msg.speakingAgent.schemaName) } as React.CSSProperties) : undefined}
                >
                  {renderMessageContent(msg)}
                  {msg.attachmentSummary && msg.attachmentSummary.kind !== "card" && (
                    <div className="msg-attachments">
                      {msg.attachmentSummary.items.map((item, i) => {
                        const meta = ATTACHMENT_KIND_META[item.kind];
                        const isImage = item.contentType.startsWith("image/");
                        const label = item.altText
                          ? `"${item.altText}"`
                          : item.width && item.height
                            ? `${item.label} (${item.width}×${item.height})`
                            : item.label;
                        return (
                          <span
                            key={i}
                            className={`attachment-chip attachment-chip-${item.kind}`}
                            title={attachmentItemTitle(item)}
                          >
                            {isImage ? "🖼️" : "📄"}{item.kind === "paste" || item.kind === "upload" ? meta.icon : ""} {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {reactionsByMessageId.has(msg.id) && (
                    <div className="reaction-badges">
                      {reactionsByMessageId.get(msg.id)!.map((r, i) => (
                        <span
                          key={i}
                          className={`reaction-badge ${r.reaction}`}
                          title={r.feedbackText || (r.reaction === "like" ? "Thumbs up" : "Thumbs down")}
                        >
                          {r.reaction === "like" ? "👍" : "👎"}
                          {r.feedbackText && <span className="reaction-comment">{r.feedbackText}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="msg-timestamp">{formatTimestamp(msg.timestamp)}</div>
              </div>
            </div>
          );
        })}
        {orphanReactions.length > 0 && (
          <div className="orphan-reactions">
            <div className="orphan-reactions-title">💬 Reactions to prior sessions</div>
            {orphanReactions.map((r, i) => (
              <OrphanReactionItem
                key={i}
                reaction={r}
                onOpenTranscript={onOpenTranscript}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
