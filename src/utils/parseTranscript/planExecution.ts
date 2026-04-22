import type {
  RawActivity,
  PlanExecution,
  PlanExecutionStep,
} from "../../types/transcript";

interface ReceivedValue {
  steps?: unknown;
  isFinalPlan?: unknown;
  planIdentifier?: unknown;
}

interface DebugValue {
  summary?: unknown;
  ask?: unknown;
}

interface AIPluginStepValue {
  taskDialogId?: unknown;
  stepId?: unknown;
  observation?: unknown;
  arguments?: unknown;
  planIdentifier?: unknown;
  state?: unknown;
  hasRecommendations?: unknown;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return undefined;
}

/**
 * Extract executed plan(s) from a D365 1P autonomous transcript.
 *
 * Inputs we read:
 *   - `DynamicPlanReceived`         → opens a new plan, captures declaredSteps + isFinalPlan
 *   - `DynamicPlanReceivedDebug`    → optional LLM ask/summary, attached to the latest plan
 *   - `DynamicPlanAIPluginStepFinished` → one execution step (args + observation)
 *
 * Returns `undefined` when no DynamicPlanReceived events are present, so the
 * UI can early-out with no churn for non-autonomous transcripts.
 */
export function extractPlanExecutions(
  rawActivities: RawActivity[],
): PlanExecution[] | undefined {
  const byId = new Map<string, PlanExecution>();
  const order: string[] = [];

  for (const a of rawActivities) {
    if (a.type !== "event") continue;
    const valueType = a.valueType;

    if (valueType === "DynamicPlanReceived") {
      const v = (a.value ?? {}) as ReceivedValue;
      const id = asString(v.planIdentifier);
      if (!id) continue;
      if (!byId.has(id)) {
        byId.set(id, {
          planIdentifier: id,
          receivedAt: a.timestamp,
          isFinalPlan: typeof v.isFinalPlan === "boolean" ? v.isFinalPlan : undefined,
          declaredSteps: asStringArray(v.steps),
          steps: [],
        });
        order.push(id);
      } else {
        // Plan re-issued (planner refined it) — keep the earliest receivedAt,
        // but update declaredSteps / isFinalPlan to the latest snapshot.
        const plan = byId.get(id)!;
        plan.isFinalPlan = typeof v.isFinalPlan === "boolean" ? v.isFinalPlan : plan.isFinalPlan;
        const newSteps = asStringArray(v.steps);
        if (newSteps.length > 0) plan.declaredSteps = newSteps;
      }
      continue;
    }

    if (valueType === "DynamicPlanReceivedDebug") {
      // Debug events don't carry planIdentifier — attach to the most recent plan.
      const lastId = order[order.length - 1];
      if (!lastId) continue;
      const plan = byId.get(lastId)!;
      const v = (a.value ?? {}) as DebugValue;
      plan.debug = {
        summary: asString(v.summary),
        ask: asString(v.ask),
      };
      continue;
    }

    if (valueType === "DynamicPlanAIPluginStepFinished") {
      const v = (a.value ?? {}) as AIPluginStepValue;
      const planId = asString(v.planIdentifier);
      const stepId = asString(v.stepId);
      const taskDialogId = asString(v.taskDialogId);
      if (!planId || !stepId || !taskDialogId) continue;
      const plan = byId.get(planId);
      if (!plan) continue;
      const step: PlanExecutionStep = {
        stepId,
        taskDialogId,
        timestamp: a.timestamp,
        state: asString(v.state),
        arguments: asRecord(v.arguments),
        observation: v.observation,
        hasRecommendations: typeof v.hasRecommendations === "boolean" ? v.hasRecommendations : undefined,
      };
      plan.steps.push(step);
    }
  }

  if (order.length === 0) return undefined;

  for (const plan of byId.values()) {
    plan.steps.sort((a, b) => a.timestamp - b.timestamp);
  }

  return order.map((id) => byId.get(id)!).sort((a, b) => a.receivedAt - b.receivedAt);
}

/**
 * Strip the agent prefix from a taskDialogId for display, e.g.
 *   "msdyn_PurchCopilotFollowupTaskAgent.topic.StoreEmailTopic"
 *     → "StoreEmailTopic"
 * Falls back to the input unchanged when the conventional shape isn't matched.
 */
export function shortenTaskDialogId(taskDialogId: string): string {
  const parts = taskDialogId.split(".");
  return parts.length > 0 ? parts[parts.length - 1] : taskDialogId;
}
