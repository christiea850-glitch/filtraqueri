import {
  resolveBusinessSqlJoinPaths,
  type BusinessSqlJoinPathResolution,
  type BusinessSqlJoinRequirementResolution,
  type BusinessSqlRelationshipMetadata,
} from "./businessSqlJoinPathResolver";
import {
  planBusinessSqlQueryRequest,
  type PlanBusinessSqlQueryRequestInput,
} from "./businessSqlQueryPlanner";
import type {
  BusinessSqlPlanSupportLevel,
  BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";

export type BusinessSqlIntegratedReadiness = "ready" | "needs_review" | "blocked";

export type BusinessSqlQueryPlanJoinResolution = {
  plan: BusinessSqlQueryPlan;
  joinResolution: BusinessSqlJoinPathResolution;
  readiness: BusinessSqlIntegratedReadiness;
  support: BusinessSqlPlanSupportLevel;
  resolvedJoinPaths: BusinessSqlJoinRequirementResolution[];
  unresolvedJoinRequirements: BusinessSqlJoinRequirementResolution[];
  blockedJoinRequirements: BusinessSqlJoinRequirementResolution[];
  warnings: string[];
  assumptions: string[];
  summary: string;
};

export type AttachBusinessSqlJoinResolutionInput = {
  plan: BusinessSqlQueryPlan;
  relationships?: readonly BusinessSqlRelationshipMetadata[];
};

export type PlanBusinessSqlQueryRequestWithJoinResolutionInput =
  PlanBusinessSqlQueryRequestInput & {
    relationships?: readonly BusinessSqlRelationshipMetadata[];
  };

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const summaryFor = (
  plan: BusinessSqlQueryPlan,
  resolution: BusinessSqlJoinPathResolution,
  readiness: BusinessSqlIntegratedReadiness,
): string =>
  [
    `plan=${plan.id}`,
    `readiness=${readiness}`,
    `join=${resolution.status}`,
    `resolved=${resolution.resolved.length}`,
    `unresolved=${resolution.unresolved.length}`,
    `blocked=${resolution.blocked.length}`,
    `relationships=${resolution.relationshipIds.join(",") || "none"}`,
  ].join("; ");

export function attachBusinessSqlJoinResolutionToPlan({
  plan,
  relationships = [],
}: AttachBusinessSqlJoinResolutionInput): BusinessSqlQueryPlanJoinResolution {
  const joinResolution = resolveBusinessSqlJoinPaths({
    requirements: plan.joinPath.requirements,
    relationships,
  });
  const readiness: BusinessSqlIntegratedReadiness =
    plan.support === "blocked" || joinResolution.status === "blocked"
      ? "blocked"
      : plan.support === "needs_review" && !plan.joinPath.required
        ? "needs_review"
        : joinResolution.status;
  const support: BusinessSqlPlanSupportLevel =
    readiness === "ready" ? "supported" : readiness;
  const warnings = uniqueStrings([
    ...plan.warnings
      .filter(
        (warning) =>
          warning.id !== "join-path-needs-review" || joinResolution.status !== "ready",
      )
      .map((warning) => warning.message),
    ...joinResolution.warnings,
  ]);
  const assumptions = uniqueStrings([
    ...plan.assumptions.map((assumption) => assumption.detail),
    ...joinResolution.assumptions,
  ]);

  return {
    plan,
    joinResolution,
    readiness,
    support,
    resolvedJoinPaths: joinResolution.resolved,
    unresolvedJoinRequirements: joinResolution.unresolved,
    blockedJoinRequirements: joinResolution.blocked,
    warnings,
    assumptions,
    summary: summaryFor(plan, joinResolution, readiness),
  };
}

export function planBusinessSqlQueryRequestWithJoinResolution({
  relationships = [],
  ...plannerInput
}: PlanBusinessSqlQueryRequestWithJoinResolutionInput): BusinessSqlQueryPlanJoinResolution {
  const plan = planBusinessSqlQueryRequest(plannerInput);
  return attachBusinessSqlJoinResolutionToPlan({ plan, relationships });
}
