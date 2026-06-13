import type { SqlDialectId } from "../../sqlIntelligence";
import type { BusinessSqlQueryPlan } from "./businessSqlQueryPlan";
import { renderBusinessSqlQueryPlan } from "./businessSqlRenderer";

export type BusinessSqlRenderPreview = {
  status: "ready" | "needs_review" | "blocked";
  title: string;
  body: string;
  sql: string | null;
  planId: string;
  rendererTarget: "duckdb";
  guidanceDialect?: SqlDialectId;
  reasons: string[];
  warnings: string[];
  actions: {
    canCopySql: boolean;
    canInsertSql: boolean;
    canRunSql: boolean;
  };
};

const titleForStatus = (status: BusinessSqlRenderPreview["status"]): string => {
  if (status === "ready") return "SQL preview ready";
  if (status === "blocked") return "SQL preview blocked";
  return "SQL preview needs review";
};

const bodyForStatus = (status: BusinessSqlRenderPreview["status"]): string => {
  if (status === "ready") {
    return "DuckDB SQL has been rendered for review. It has not been inserted or run.";
  }
  if (status === "blocked") {
    return "SQL cannot be previewed until the blocking plan issues are resolved.";
  }
  return "SQL cannot be previewed until the plan is safe to render.";
};

export function createBusinessSqlRenderPreview(
  plan: BusinessSqlQueryPlan,
): BusinessSqlRenderPreview {
  const renderResult = renderBusinessSqlQueryPlan(plan);
  const status: BusinessSqlRenderPreview["status"] =
    renderResult.status === "rendered"
      ? "ready"
      : renderResult.status === "blocked"
        ? "blocked"
        : "needs_review";
  const sql = status === "ready" ? renderResult.sql : null;

  return {
    status,
    title: titleForStatus(status),
    body: bodyForStatus(status),
    sql,
    planId: plan.id,
    rendererTarget: "duckdb",
    guidanceDialect: plan.renderer.selectedGuidanceDialect,
    reasons: [...renderResult.reasons],
    warnings: [...renderResult.warnings],
    actions: {
      canCopySql: status === "ready" && Boolean(sql),
      canInsertSql: false,
      canRunSql: false,
    },
  };
}

export function summarizeBusinessSqlRenderPreview(
  preview: BusinessSqlRenderPreview,
): string {
  return [
    `status=${preview.status}`,
    `target=${preview.rendererTarget}`,
    preview.guidanceDialect ? `guidance=${preview.guidanceDialect}` : "guidance=none",
    `copy=${preview.actions.canCopySql}`,
    `insert=${preview.actions.canInsertSql}`,
    `run=${preview.actions.canRunSql}`,
    `sql=${preview.sql ? "present" : "none"}`,
  ].join("; ");
}
