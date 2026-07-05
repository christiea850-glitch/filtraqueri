import type { SqlDialectId } from "../../sqlIntelligence";
import type { BusinessSqlPlanSupportLevel } from "./businessSqlQueryPlan";
import type { BusinessSqlQueryPlanJoinResolution } from "./businessSqlQueryPlanJoinResolution";

export type BusinessSqlPlanReadinessStatus = "ready" | "needs_review" | "blocked";

export type BusinessSqlPlanReadinessReasonCode =
  | "base_plan_blocked"
  | "join_resolution_blocked"
  | "join_resolution_needs_review"
  | "plan_support_needs_review"
  | "metric_missing"
  | "required_entity_missing"
  | "grouping_missing";

export type BusinessSqlRendererEligibility = {
  eligible: boolean;
  status: "eligible" | "ineligible";
  targetDialect: SqlDialectId;
  metadataOnly: true;
};

export type BusinessSqlPlanReadiness = {
  planId: string;
  status: BusinessSqlPlanReadinessStatus;
  support: BusinessSqlPlanSupportLevel;
  reasonCodes: BusinessSqlPlanReadinessReasonCode[];
  warnings: string[];
  assumptions: string[];
  blockingReasons: string[];
  reviewReasons: string[];
  rendererEligibility: BusinessSqlRendererEligibility;
  summary: string;
};

const GROUPED_PLAN_KINDS = new Set([
  "single_table_count_grouping",
  "multi_table_count_grouping",
]);

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

export function evaluateBusinessSqlPlanReadiness(
  integrated: BusinessSqlQueryPlanJoinResolution,
): BusinessSqlPlanReadiness {
  const { plan, joinResolution } = integrated;
  const reasonCodes: BusinessSqlPlanReadinessReasonCode[] = [];
  const blockingReasons: string[] = [];
  const reviewReasons: string[] = [];

  if (plan.support === "blocked" || plan.status === "blocked" || plan.kind === "blocked") {
    reasonCodes.push("base_plan_blocked");
    blockingReasons.push("The base business SQL plan is blocked.");
  }

  if (joinResolution.status === "blocked") {
    reasonCodes.push("join_resolution_blocked");
    blockingReasons.push("One or more required relationships are blocked.");
  } else if (joinResolution.status === "needs_review") {
    reasonCodes.push("join_resolution_needs_review");
    reviewReasons.push("One or more required relationships need review.");
  }

  if (!plan.metric) {
    reasonCodes.push("metric_missing");
    reviewReasons.push("The plan does not contain a supported metric.");
  }

  if (plan.entities.filter((entity) => entity.required).length === 0) {
    reasonCodes.push("required_entity_missing");
    reviewReasons.push("The plan does not contain a required entity.");
  }

  if (GROUPED_PLAN_KINDS.has(plan.kind) && plan.groupings.length === 0) {
    reasonCodes.push("grouping_missing");
    reviewReasons.push("The grouped plan does not contain a grouping.");
  }

  if (
    integrated.support === "needs_review" &&
    joinResolution.status !== "needs_review" &&
    reasonCodes.length === 0
  ) {
    reasonCodes.push("plan_support_needs_review");
    reviewReasons.push("The base plan support level requires review.");
  }

  const status: BusinessSqlPlanReadinessStatus =
    blockingReasons.length > 0
      ? "blocked"
      : reviewReasons.length > 0 || integrated.readiness === "needs_review"
        ? "needs_review"
        : "ready";
  const support: BusinessSqlPlanSupportLevel =
    status === "ready" ? "supported" : status;
  const uniqueReasonCodes = unique(reasonCodes);
  const rendererEligibility: BusinessSqlRendererEligibility = {
    eligible: status === "ready",
    status: status === "ready" ? "eligible" : "ineligible",
    targetDialect: plan.renderer.targetDialect,
    metadataOnly: true,
  };
  const summary = [
    `plan=${plan.id}`,
    `readiness=${status}`,
    `support=${support}`,
    `reasons=${uniqueReasonCodes.join(",") || "none"}`,
    `renderer=${rendererEligibility.status}`,
    `target=${rendererEligibility.targetDialect}`,
  ].join("; ");

  return {
    planId: plan.id,
    status,
    support,
    reasonCodes: uniqueReasonCodes,
    warnings: unique(integrated.warnings),
    assumptions: unique(integrated.assumptions),
    blockingReasons: unique(blockingReasons),
    reviewReasons: unique(reviewReasons),
    rendererEligibility,
    summary,
  };
}
