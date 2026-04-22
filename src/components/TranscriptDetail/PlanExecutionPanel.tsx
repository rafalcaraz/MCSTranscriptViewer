import { useState } from "react";
import type { PlanExecution, PlanExecutionStep } from "../../types/transcript";
import { shortenTaskDialogId } from "../../utils/parseTranscript/planExecution";

interface PlanExecutionPanelProps {
  plans: PlanExecution[];
}

const stateBadgeClass: Record<string, string> = {
  completed: "plan-step-state-ok",
  failed: "plan-step-state-fail",
  skipped: "plan-step-state-skip",
};

function StepRow({ step, index }: { step: PlanExecutionStep; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const argCount = step.arguments ? Object.keys(step.arguments).length : 0;
  const hasObservation = step.observation != null;
  const stateLabel = step.state ?? "—";
  const stateClass = stateBadgeClass[step.state ?? ""] ?? "plan-step-state-other";
  const tdShort = shortenTaskDialogId(step.taskDialogId);

  return (
    <li className="plan-step">
      <button
        type="button"
        className="plan-step-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="plan-step-num">{index + 1}.</span>
        <span className={`plan-step-state ${stateClass}`}>{stateLabel}</span>
        <span className="plan-step-name" title={step.taskDialogId}>{tdShort}</span>
        <span className="plan-step-meta">
          {argCount > 0 && <span title="Argument count">{argCount} arg{argCount === 1 ? "" : "s"}</span>}
          {hasObservation && <span title="Observation present">obs</span>}
        </span>
        <span className="plan-step-chevron">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="plan-step-body">
          <div className="plan-step-fact">
            <span className="plan-step-fact-label">taskDialogId</span>
            <code>{step.taskDialogId}</code>
          </div>
          <div className="plan-step-fact">
            <span className="plan-step-fact-label">stepId</span>
            <code>{step.stepId}</code>
          </div>
          {step.arguments && argCount > 0 && (
            <details className="plan-step-section" open>
              <summary>Arguments ({argCount})</summary>
              <pre className="plan-step-json">{JSON.stringify(step.arguments, null, 2)}</pre>
            </details>
          )}
          {hasObservation && (
            <details className="plan-step-section">
              <summary>Observation</summary>
              <pre className="plan-step-json">{JSON.stringify(step.observation, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </li>
  );
}

function PlanCard({ plan, index, total }: { plan: PlanExecution; index: number; total: number }) {
  const [collapsed, setCollapsed] = useState(false);
  const declaredCount = plan.declaredSteps.length;
  const executedCount = plan.steps.length;

  return (
    <div className="plan-card">
      <button
        type="button"
        className="plan-card-header"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="plan-card-icon" aria-hidden="true">📋</span>
        <span className="plan-card-title">
          Plan {index + 1}{total > 1 ? ` of ${total}` : ""}
          {plan.isFinalPlan ? <span className="plan-final-tag" title="Planner declared this its final plan">final</span> : null}
        </span>
        <span className="plan-card-summary">
          {executedCount} step{executedCount === 1 ? "" : "s"} executed
          {declaredCount > 0 && declaredCount !== executedCount ? ` · ${declaredCount} declared` : ""}
        </span>
        <span className="plan-card-chevron">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="plan-card-body">
          {plan.declaredSteps.length > 0 && (
            <div className="plan-declared">
              <span className="plan-declared-label">Declared steps:</span>
              {plan.declaredSteps.map((s) => (
                <code key={s} className="plan-declared-step" title={s}>{shortenTaskDialogId(s)}</code>
              ))}
            </div>
          )}
          {plan.steps.length > 0 ? (
            <ol className="plan-step-list">
              {plan.steps.map((s, i) => (
                <StepRow key={s.stepId} step={s} index={i} />
              ))}
            </ol>
          ) : (
            <div className="plan-empty">No execution steps were finished for this plan.</div>
          )}
          {plan.debug && (plan.debug.summary || plan.debug.ask) && (
            <details className="plan-step-section">
              <summary>LLM debug payload</summary>
              {plan.debug.summary && (
                <div className="plan-debug-block">
                  <strong>Summary:</strong> {plan.debug.summary}
                </div>
              )}
              {plan.debug.ask && (
                <details className="plan-debug-ask">
                  <summary>Ask (raw)</summary>
                  <pre className="plan-step-json">{plan.debug.ask}</pre>
                </details>
              )}
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Renders the LLM-issued plan(s) executed by a D365 1P platform agent on
 * the `pva-autonomous` channel. Shows each plan's declared steps and the
 * actual `DynamicPlanAIPluginStepFinished` events with their arguments and
 * observations — the autonomous-agent equivalent of OpenAI's tool-call
 * timeline. Renders nothing for non-autonomous transcripts (the parent
 * already gates on `transcript.planExecutions?.length`).
 */
export function PlanExecutionPanel({ plans }: PlanExecutionPanelProps) {
  if (plans.length === 0) return null;
  return (
    <div className="plan-execution-panel" role="region" aria-label="Plan execution trace">
      <div className="plan-execution-header">
        <span aria-hidden="true">🏛️</span>
        <strong>Plan execution</strong>
        <span className="plan-execution-subtle">
          {plans.length} plan{plans.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="plan-execution-body">
        {plans.map((p, i) => (
          <PlanCard key={p.planIdentifier} plan={p} index={i} total={plans.length} />
        ))}
      </div>
    </div>
  );
}
