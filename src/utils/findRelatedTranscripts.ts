import type { ParsedTranscript, ConnectedAgentInvocation } from "../types/transcript";

/**
 * Cross-transcript matching utilities for connected-agent flows.
 *
 * There is no direct ID linking a parent's ConnectedAgent invocation to the
 * child's own transcript record. We approximate the link with three signals,
 * in priority order:
 *   1. Same user (userAadObjectId) — STRICT, must match
 *   2. Same child agent schema name (metadata.botName === invocation.childSchemaName)
 *   3. Closest timestamp within a tolerance window
 *
 * The tolerance is intentionally generous (±10 minutes) because child sessions
 * can run for several minutes and the parent's "Initialize" timestamp is the
 * START of the call while the child's conversationstarttime is its first
 * activity — these can drift.
 */

const MATCH_WINDOW_MS = 10 * 60 * 1000; // ±10 min

function timestamp(t: ParsedTranscript): number {
  // Prefer conversationstarttime; fall back to createdon. Both are ISO-ish strings.
  const raw = t.conversationstarttime || t.createdon;
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * For the given parent invocation, find the corresponding *child-side*
 * transcript among the loaded set. Returns null if no plausible match exists.
 */
export function findChildTranscript(
  parent: ParsedTranscript,
  invocation: ConnectedAgentInvocation,
  allTranscripts: ParsedTranscript[]
): ParsedTranscript | null {
  const parentUserId = parent.userAadObjectId;
  if (!parentUserId) return null;

  const target = invocation.startTimestamp || timestamp(parent);

  let best: { t: ParsedTranscript; delta: number } | null = null;
  for (const t of allTranscripts) {
    if (t.conversationtranscriptid === parent.conversationtranscriptid) continue;
    if (t.metadata.botName !== invocation.childSchemaName) continue;
    if (t.userAadObjectId !== parentUserId) continue;
    const delta = Math.abs(timestamp(t) - target);
    if (delta > MATCH_WINDOW_MS) continue;
    if (!best || delta < best.delta) best = { t, delta };
  }
  return best?.t ?? null;
}

/**
 * For the given child-side transcript, find the parent transcript that invoked
 * it (and the specific invocation, when matched). Returns null if no match.
 */
export function findParentTranscript(
  child: ParsedTranscript,
  allTranscripts: ParsedTranscript[]
): { parent: ParsedTranscript; invocation: ConnectedAgentInvocation } | null {
  const childUserId = child.userAadObjectId;
  if (!childUserId) return null;
  const childSchema = child.metadata.botName;
  const childTime = timestamp(child);

  let best: { parent: ParsedTranscript; invocation: ConnectedAgentInvocation; delta: number } | null = null;
  for (const t of allTranscripts) {
    if (t.conversationtranscriptid === child.conversationtranscriptid) continue;
    if (t.userAadObjectId !== childUserId) continue;
    if (t.invokedChildAgentSchemaNames.length === 0) continue;
    for (const inv of t.connectedAgentInvocations) {
      if (inv.childSchemaName !== childSchema) continue;
      const delta = Math.abs((inv.startTimestamp || timestamp(t)) - childTime);
      if (delta > MATCH_WINDOW_MS) continue;
      if (!best || delta < best.delta) best = { parent: t, invocation: inv, delta };
    }
  }
  if (!best) return null;
  return { parent: best.parent, invocation: best.invocation };
}
