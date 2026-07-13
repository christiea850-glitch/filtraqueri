import type { SqlDialectId } from "../../sqlIntelligence";
import {
  evaluateBusinessSqlPlanReadiness,
  type BusinessSqlPlanReadiness,
  type BusinessSqlPlanReadinessReasonCode,
  type BusinessSqlPlanReadinessStatus,
} from "./businessSqlPlanReadiness";
import type { BusinessSqlPlanSupportLevel } from "./businessSqlQueryPlan";
import type { BusinessSqlQueryPlanJoinResolution } from "./businessSqlQueryPlanJoinResolution";

export type BusinessSqlRenderabilityStatus =
  | "renderable"
  | "needs_review"
  | "blocked";

export type BusinessSqlRendererTargetMetadata = {
  targetDialect: SqlDialectId;
  metadataOnly: true;
};

export type BusinessSqlRenderabilityGate = {
  status: BusinessSqlRenderabilityStatus;
  renderable: boolean;
  rendererTarget: BusinessSqlRendererTargetMetadata;
  readinessStatus: BusinessSqlPlanReadinessStatus;
  support: BusinessSqlPlanSupportLevel;
  reasonCodes: BusinessSqlPlanReadinessReasonCode[];
  blockingReasons: string[];
  reviewReasons: string[];
  warnings: string[];
  assumptions: string[];
  sqlGenerated: false;
  summary: string;
};

export type EvaluateBusinessSqlRenderabilityInput =
  | {
      readiness: BusinessSqlPlanReadiness;
    }
  | {
      integrated: BusinessSqlQueryPlanJoinResolution;
    };

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

const readinessFor = (
  input: EvaluateBusinessSqlRenderabilityInput,
): BusinessSqlPlanReadiness =>
  "readiness" in input
    ? input.readiness
    : evaluateBusinessSqlPlanReadiness(input.integrated);

const renderabilityForReadiness = (
  readiness: BusinessSqlPlanReadinessStatus,
): BusinessSqlRenderabilityStatus => {
  if (readiness === "ready") return "renderable";
  return readiness;
};

export function evaluateBusinessSqlRenderability(
  input: EvaluateBusinessSqlRenderabilityInput,
): BusinessSqlRenderabilityGate {
  const readiness = readinessFor(input);
  const status = renderabilityForReadiness(readiness.status);
  const rendererTarget: BusinessSqlRendererTargetMetadata = {
    targetDialect: readiness.rendererEligibility.targetDialect,
    metadataOnly: true,
  };
  const reasonCodes = unique(readiness.reasonCodes);
  const summary = [
    `plan=${readiness.planId}`,
    `renderability=${status}`,
    `readiness=${readiness.status}`,
    `support=${readiness.support}`,
    `reasons=${reasonCodes.join(",") || "none"}`,
    `target=${rendererTarget.targetDialect}`,
    "sqlGenerated=false",
  ].join("; ");

  return {
    status,
    renderable: status === "renderable",
    rendererTarget,
    readinessStatus: readiness.status,
    support: readiness.support,
    reasonCodes,
    blockingReasons: unique(readiness.blockingReasons),
    reviewReasons: unique(readiness.reviewReasons),
    warnings: unique(readiness.warnings),
    assumptions: unique(readiness.assumptions),
    sqlGenerated: false,
    summary,
  };
}
