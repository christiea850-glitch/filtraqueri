import type { BusinessSqlQueryPlan } from "./businessSqlQueryPlan";
import {
  createBusinessSqlRenderPreview,
  type BusinessSqlRenderPreview,
} from "./businessSqlRenderPreview";
import type {
  AdaptiveProposalBusinessSqlBridgeIssue,
  AdaptiveProposalBusinessSqlBridgeState,
} from "./adaptiveProposalBusinessSqlBridge";
import type { BusinessSqlRenderReadinessResult } from "./businessSqlRenderReadiness";

export type AdaptiveProposalBusinessSqlPreviewHandoffAction = {
  label: "Preview SQL from plan candidate";
  canPreview: boolean;
  disabledReason: string | null;
};

export type AdaptiveProposalBusinessSqlPreviewHandoffInput = {
  candidateState: AdaptiveProposalBusinessSqlBridgeState;
  plan: BusinessSqlQueryPlan | null;
  readiness: BusinessSqlRenderReadinessResult | null;
  issues: readonly AdaptiveProposalBusinessSqlBridgeIssue[];
  activeSqlDraft: string;
  existingPreview: BusinessSqlRenderPreview | null;
};

export type AdaptiveProposalBusinessSqlPreviewHandoffResult = {
  preview: BusinessSqlRenderPreview | null;
  action: AdaptiveProposalBusinessSqlPreviewHandoffAction;
  noDirectRendererCallFromUi: true;
  noInsertPerformed: true;
  noRunPerformed: true;
  noProviderOrLlmUsed: true;
};

export const BUSINESS_SQL_PLAN_CANDIDATE_PREVIEW_ACTION_LABEL =
  "Preview SQL from plan candidate" as const;

const action = (
  canPreview: boolean,
  disabledReason: string | null,
): AdaptiveProposalBusinessSqlPreviewHandoffAction => ({
  label: BUSINESS_SQL_PLAN_CANDIDATE_PREVIEW_ACTION_LABEL,
  canPreview,
  disabledReason,
});

export const getAdaptiveProposalBusinessSqlPreviewHandoffAction = ({
  candidateState,
  plan,
  readiness,
  issues,
  activeSqlDraft,
  existingPreview,
}: AdaptiveProposalBusinessSqlPreviewHandoffInput): AdaptiveProposalBusinessSqlPreviewHandoffAction => {
  if (candidateState !== "render_ready_plan") {
    return action(false, "SQL preview is available only for render-ready plan candidates.");
  }
  if (!plan) return action(false, "No Business SQL query plan candidate is available.");
  if (readiness?.status !== "renderable") {
    return action(false, "Plan readiness must be renderable before preview.");
  }
  if (plan.renderer.status !== "renderable") {
    return action(false, "Plan renderer status must be renderable before preview.");
  }
  if (plan.renderer.sql) {
    return action(false, "Plan candidate already contains rendered SQL.");
  }
  if (activeSqlDraft.trim()) {
    return action(false, "Clear the editor draft before previewing SQL from a plan candidate.");
  }
  if (existingPreview?.status === "ready" && existingPreview.planId === plan.id) {
    return action(false, "A ready SQL preview already exists for this plan candidate.");
  }
  if (issues.some((issue) => issue.severity !== "info")) {
    return action(false, "Resolve bridge review or blocking issues before preview.");
  }
  if (
    plan.joinPath.required &&
    (plan.joinPath.status !== "resolved" ||
      plan.joinPath.edges.some((edge) => !edge.verified) ||
      plan.joinPath.requirements.some((requirement) => requirement.required && !requirement.verified))
  ) {
    return action(false, "Required join path must be resolved and verified before preview.");
  }
  if (plan.renderer.targetDialect !== "duckdb") {
    return action(false, "Plan candidate must target DuckDB before preview.");
  }

  return action(true, null);
};

export function createAdaptiveProposalBusinessSqlPreviewHandoff(
  input: AdaptiveProposalBusinessSqlPreviewHandoffInput,
): AdaptiveProposalBusinessSqlPreviewHandoffResult {
  const previewAction = getAdaptiveProposalBusinessSqlPreviewHandoffAction(input);
  return {
    preview:
      previewAction.canPreview && input.plan
        ? createBusinessSqlRenderPreview(input.plan)
        : null,
    action: previewAction,
    noDirectRendererCallFromUi: true,
    noInsertPerformed: true,
    noRunPerformed: true,
    noProviderOrLlmUsed: true,
  };
}
