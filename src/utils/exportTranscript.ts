import type { ParsedTranscript } from "../types/transcript";
import { formatTimestamp } from "./formatters";

/**
 * Generate HTML string for a transcript export.
 * Separated from download logic for testability.
 */
export function generateTranscriptHTML(transcript: ParsedTranscript, agentDisplayName?: string, userDisplayName?: string): string {
  const agent = agentDisplayName || transcript.metadata.botName || "Unknown Agent";
  const user = userDisplayName || transcript.userAadObjectId || "Anonymous";
  const startTime = new Date(transcript.conversationstarttime).toLocaleString();
  const outcome = transcript.globalOutcome ?? "Unknown";
  const outcomeReason = transcript.globalOutcomeReason ? ` (${transcript.globalOutcomeReason})` : "";

  const messagesHTML = transcript.messages.map((msg) => {
    const isUser = msg.role === "user";
    const label = isUser ? `👤 ${user}` : `🤖 ${agent}`;
    const time = formatTimestamp(msg.timestamp);
    const bgColor = isUser ? "#0078d4" : "#f0f0f0";
    const textColor = isUser ? "#fff" : "#1a1a1a";
    const align = isUser ? "flex-end" : "flex-start";
    const text = msg.text || (msg.textFormat === "system" ? msg.text : "[No content]");

    return `
      <div style="display:flex;justify-content:${align};margin-bottom:12px;">
        <div style="max-width:75%;">
          <div style="font-size:11px;color:#888;margin-bottom:2px;${isUser ? "text-align:right;" : ""}">${label}</div>
          <div style="background:${bgColor};color:${textColor};padding:10px 14px;border-radius:12px;font-size:14px;line-height:1.5;word-break:break-word;">
            ${escapeHTML(text).replace(/\n/g, "<br>")}
          </div>
          <div style="font-size:10px;color:#999;margin-top:2px;${isUser ? "text-align:right;" : ""}">${time}</div>
        </div>
      </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transcript — ${agent} — ${startTime}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #1a1a1a; }
    .header { background: #fff; padding: 20px 24px; border-bottom: 1px solid #e0e0e0; }
    .header h1 { font-size: 18px; margin: 0 0 12px; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .meta-item label { display: block; font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-item .value { font-size: 14px; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-warning { background: #fff4ce; color: #7a6400; }
    .badge-success { background: #dff6dd; color: #107c10; }
    .badge-danger { background: #fde7e9; color: #c4314b; }
    .badge-info { background: #e5f1fb; color: #0078d4; }
    .messages { padding: 24px; max-width: 800px; margin: 0 auto; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Conversation Transcript</h1>
    <div class="meta">
      <div class="meta-item">
        <label>Agent</label>
        <div class="value">${escapeHTML(agent)}</div>
      </div>
      <div class="meta-item">
        <label>User</label>
        <div class="value">${escapeHTML(user)}</div>
      </div>
      <div class="meta-item">
        <label>Conversation Start</label>
        <div class="value">${escapeHTML(startTime)}</div>
      </div>
      <div class="meta-item">
        <label>Turns</label>
        <div class="value">${transcript.turnCount}</div>
      </div>
      <div class="meta-item">
        <label>Outcome</label>
        <div class="value"><span class="badge ${outcomeBadgeClass(outcome)}">${escapeHTML(outcome)}${escapeHTML(outcomeReason)}</span></div>
      </div>
      <div class="meta-item">
        <label>Conversation ID</label>
        <div class="value" style="font-family:monospace;font-size:12px;">${escapeHTML(transcript.conversationtranscriptid)}</div>
      </div>
    </div>
  </div>
  <div class="messages">
    ${messagesHTML}
  </div>
  <div class="footer">
    Exported from MCS Conversation Viewer · ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

  return html;
}

/**
 * Export a transcript as a self-contained HTML file download.
 */
export function exportTranscriptHTML(transcript: ParsedTranscript, agentDisplayName?: string, userDisplayName?: string) {
  const html = generateTranscriptHTML(transcript, agentDisplayName, userDisplayName);
  downloadFile(html, `transcript_${transcript.conversationtranscriptid.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.html`, "text/html");
}

function outcomeBadgeClass(outcome: string): string {
  switch (outcome) {
    case "Resolved": return "badge-success";
    case "Abandoned": return "badge-warning";
    case "Escalated": case "HandOff": return "badge-danger";
    default: return "badge-info";
  }
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
