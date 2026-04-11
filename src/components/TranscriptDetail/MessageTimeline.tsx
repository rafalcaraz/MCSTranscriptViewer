import { useState, useEffect, useRef, useMemo } from "react";
import type { ChatMessage, Reaction } from "../../types/transcript";
import { formatTimestamp } from "../../utils/parseTranscript";
import { OrphanReactionItem } from "./OrphanReactionItem";
import { AdaptiveCardRenderer } from "./AdaptiveCardRenderer";

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

  const renderMessageContent = (msg: ChatMessage) => {
    // Adaptive card or OAuth card — render with card component
    if (msg.attachments?.length && (msg.textFormat === "adaptive-card" || msg.textFormat === "oauth-card")) {
      return (
        <div>
          {msg.text && <div dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.text) }} />}
          {msg.attachments.map((att, i) => (
            <div key={i}>
              <AdaptiveCardRenderer content={att.content} contentType={att.contentType} />
              <div className="ac-disclaimer">⚠️ Adaptive Card — rendering may not match original</div>
            </div>
          ))}
        </div>
      );
    }

    // Regular bot message with markdown
    if (msg.role === "bot") {
      return <div dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.text) }} />;
    }

    // User message
    return <>{msg.text}</>;
  };

  return (
    <div className="panel">
      <div className="panel-title">Message Timeline</div>
      <div className="panel-body">
        <input
          className="debug-search"
          placeholder="Search messages..."
          value={messageSearch}
          onChange={(e) => setMessageSearch(e.target.value)}
        />
        {messages.map((msg) => {
          // Search filter
          const matchesSearch = !messageSearch || msg.text.toLowerCase().includes(messageSearch.toLowerCase());

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
              ref={isActive ? activeRef : undefined}
              className={`message-row ${msg.role} ${isActive ? "active" : ""}`}
              onClick={handleClick}
              style={{ cursor: "pointer", opacity: matchesSearch ? 1 : 0.3, transition: "opacity 0.2s" }}
            >
              <div>
                <div className={`msg-bubble ${msg.role} ${isActive ? "highlighted" : ""}`}>
                  {renderMessageContent(msg)}
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

/** Lightweight markdown-to-HTML for bot messages (tables, bold, code, headers, lists, hr, blockquotes) */
function simpleMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Tables
  html = html.replace(
    /^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+)/gm,
    (_match, headerRow: string, _sep: string, bodyRows: string) => {
      const headers = headerRow.split("|").filter((c: string) => c.trim());
      const rows = bodyRows.trim().split("\n").map((r: string) => r.split("|").filter((c: string) => c.trim()));
      return `<table><thead><tr>${headers.map((h: string) => `<th>${h.trim()}</th>`).join("")}</tr></thead><tbody>${rows.map((r: string[]) => `<tr>${r.map((c: string) => `<td>${c.trim()}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
  );

  // Block quotes
  html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");
  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  // HR
  html = html.replace(/^---$/gm, "<hr/>");
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
