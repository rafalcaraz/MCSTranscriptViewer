/** Format a unix epoch seconds timestamp to a readable datetime string */
export function formatTimestamp(epoch: number): string {
  return new Date(epoch * 1000).toLocaleString();
}

/** Format a duration in seconds to a human-readable string */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/** Extract the short tool name from a full taskDialogId like "MCP:schema.topic:tool_name" */
export function shortToolName(taskDialogId: string): string {
  const parts = taskDialogId.split(":");
  return parts[parts.length - 1] ?? taskDialogId;
}

/** Sanitize user input for use in OData filter strings. */
export function escapeOData(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9\s\-._@:]/g, "")
    .replace(/'/g, "''");
}

/** Sanitize a GUID — strip anything that isn't hex or hyphens */
export function sanitizeGuid(value: string): string {
  return value.replace(/[^a-fA-F0-9\-]/g, "");
}
