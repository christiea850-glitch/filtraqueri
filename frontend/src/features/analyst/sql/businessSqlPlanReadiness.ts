import type { SqlDialectId } from "../../sqlIntelligence";
import type { BusinessSqlPlanSupportLevel } from "./businessSqlQueryPlan";
import {
  normalizeMetricAndMeasures,
  type BusinessSqlSortTarget,
} from "./businessSqlQueryPlan";
import type { BusinessSqlQueryPlanJoinResolution } from "./businessSqlQueryPlanJoinResolution";
import {
  evaluateBusinessSqlAggregateResultConditionCompatibility,
  type BusinessSqlAggregateResultConditionCompatibilityReason,
} from "./businessSqlAggregateResultConditionCompatibility";
import {
  evaluateBusinessSqlDerivedMeasureCompatibility,
  type BusinessSqlDerivedMeasureCompatibilityReason,
} from "./businessSqlDerivedMeasureCompatibility";
import { evaluateBusinessSqlMeasureCompatibility } from "./businessSqlMeasureCompatibility";
import {
  evaluateBusinessSqlFilterGroupContract,
  type BusinessSqlFilterGroupContractReason,
} from "./businessSqlFilterGroupContract";

export type BusinessSqlPlanReadinessStatus = "ready" | "needs_review" | "blocked";

export type BusinessSqlPlanReadinessReasonCode =
  | "base_plan_blocked"
  | "join_resolution_blocked"
  | "join_resolution_needs_review"
  | "plan_support_needs_review"
  | "metric_missing"
  | "required_entity_missing"
  | "grouping_missing"
  | "sort_target_unresolved"
  | "derived_sort_target_unresolved"
  | "derived_sort_target_ambiguous"
  | "measure_field_type_incompatible"
  | "row_limit_invalid"
  | BusinessSqlDerivedMeasureCompatibilityReason
  | BusinessSqlAggregateResultConditionCompatibilityReason
  | BusinessSqlFilterGroupContractReason;

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

const isSortTargetUnresolved = (target: BusinessSqlSortTarget): boolean =>
  target.resolved === false ||
  (target.kind === "measure" && !target.measureId) ||
  (target.kind === "derived_measure" && !target.derivedMeasureId) ||
  (target.kind !== "measure" && target.kind !== "derived_measure" && !target.field);

const derivedSortTargetReasonCodes = (
  target: BusinessSqlSortTarget,
  derivedMeasures: readonly { derivedMeasureId: string }[],
): Array<"derived_sort_target_unresolved" | "derived_sort_target_ambiguous"> => {
  if (target.kind !== "derived_measure") return [];
  if (target.resolved === false || !target.derivedMeasureId) {
    return ["derived_sort_target_unresolved"];
  }
  const matchingCount = derivedMeasures.filter(
    (derivedMeasure) => derivedMeasure.derivedMeasureId === target.derivedMeasureId,
  ).length;
  if (matchingCount === 0) return ["derived_sort_target_unresolved"];
  if (matchingCount > 1) return ["derived_sort_target_ambiguous"];
  return [];
};

export function evaluateBusinessSqlPlanReadiness(
  integrated: BusinessSqlQueryPlanJoinResolution,
): BusinessSqlPlanReadiness {
  const { plan, joinResolution } = integrated;
  const normalizedPlan = normalizeMetricAndMeasures(plan);
  const reasonCodes: BusinessSqlPlanReadinessReasonCode[] = [];
  const blockingReasons: string[] = [];
  const reviewReasons: string[] = [];
  const fieldProjectionOnly =
    (plan.filters || []).length === 1 &&
    normalizedPlan.measures.length === 0 &&
    (normalizedPlan.derivedMeasures || []).length === 0 &&
    (normalizedPlan.aggregateResultConditions || []).length === 0 &&
    (normalizedPlan.orderBy || []).length === 0 &&
    normalizedPlan.groupings.length > 0;

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

  if (!fieldProjectionOnly && !normalizedPlan.metric && normalizedPlan.measures.length === 0) {
    reasonCodes.push("metric_missing");
    reviewReasons.push("The plan does not contain a supported metric.");
  }

  if (
    (plan.orderBy || []).some(
      (sort) => sort.target.kind !== "derived_measure" && isSortTargetUnresolved(sort.target),
    )
  ) {
    reasonCodes.push("sort_target_unresolved");
    reviewReasons.push("One or more planned sort targets are unresolved.");
  }

  const derivedSortReasonCodes = (plan.orderBy || []).flatMap((sort) =>
    derivedSortTargetReasonCodes(sort.target, normalizedPlan.derivedMeasures || []),
  );
  if (derivedSortReasonCodes.length > 0) {
    reasonCodes.push(...derivedSortReasonCodes);
    reviewReasons.push("One or more planned derived-measure sort targets are unresolved.");
  }

  if (
    normalizedPlan.measures.some(
      (measure) => !evaluateBusinessSqlMeasureCompatibility({ measure }).compatible,
    )
  ) {
    reasonCodes.push("measure_field_type_incompatible");
    reviewReasons.push("One or more planned measure fields are incompatible with the measure kind.");
  }

  const derivedMeasureReasonCodes = (plan.derivedMeasures || []).flatMap(
    (derivedMeasure) =>
      evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure,
        measures: normalizedPlan.measures,
        derivedMeasures: plan.derivedMeasures || [],
      }).reasonCodes,
  );

  if (derivedMeasureReasonCodes.length > 0) {
    reasonCodes.push(...derivedMeasureReasonCodes);
    blockingReasons.push("One or more derived measures are structurally invalid.");
  }

  const aggregateConditionReasonCodes = (plan.aggregateResultConditions || []).flatMap(
    (condition) =>
      evaluateBusinessSqlAggregateResultConditionCompatibility({
        condition,
        measures: normalizedPlan.measures,
        derivedMeasures: normalizedPlan.derivedMeasures,
      }).reasonCodes,
  );

  if (aggregateConditionReasonCodes.length > 0) {
    reasonCodes.push(...aggregateConditionReasonCodes);

    if (
      aggregateConditionReasonCodes.includes("aggregate_condition_measure_unresolved")
    ) {
      reviewReasons.push("One or more aggregate-result conditions reference an unresolved measure.");
    }

    if (
      aggregateConditionReasonCodes.includes("aggregate_condition_derived_measure_unresolved")
    ) {
      reviewReasons.push("One or more aggregate-result conditions reference an unresolved derived measure.");
    }

    if (
      aggregateConditionReasonCodes.includes("aggregate_condition_target_invalid")
    ) {
      reviewReasons.push("One or more aggregate-result conditions have an invalid target.");
    }

    if (
      aggregateConditionReasonCodes.includes("aggregate_condition_measure_not_aggregate")
    ) {
      reviewReasons.push("One or more aggregate-result conditions reference a non-aggregate measure.");
    }

    if (
      aggregateConditionReasonCodes.includes("aggregate_condition_operator_unsupported")
    ) {
      reviewReasons.push("One or more aggregate-result conditions use an unsupported operator.");
    }

    if (aggregateConditionReasonCodes.includes("aggregate_condition_value_invalid")) {
      reviewReasons.push("One or more aggregate-result condition values are invalid.");
    }
  }

  const filterGroupContract = evaluateBusinessSqlFilterGroupContract(plan);
  const filterReasonCodes = filterGroupContract.reasonCodes;

  if (filterReasonCodes.length > 0) {
    reasonCodes.push(...filterReasonCodes);
    blockingReasons.push(
      filterReasonCodes.includes("row_filter_combinator_unsupported")
        ? "Row-level filter combinator metadata is unsupported."
        : "One or more row-level filters are structurally invalid.",
    );
  }

  if (
    plan.rowLimit &&
    (!Number.isInteger(plan.rowLimit.value) || plan.rowLimit.value < 1 || plan.rowLimit.value > 10000)
  ) {
    reasonCodes.push("row_limit_invalid");
    reviewReasons.push("The planned row limit is not a safe positive bounded integer.");
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
