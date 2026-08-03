import { stablePrimitiveId } from "./businessSqlQueryPlan";
import type { BusinessSqlExecutionRequest } from "./businessSqlExecutionRequest";
import type { BusinessSqlExecutionTarget } from "./businessSqlExecutionTarget";
import type { BusinessSqlExecutionPolicy, BusinessSqlExecutionPolicyContext } from "./businessSqlExecutionPolicy";
import type { SqlArtifact } from "./businessSqlRendererContracts";

export type BusinessSqlExecutionPolicyStatus = "allowed" | "blocked" | "needs_review";

export type BusinessSqlExecutionPolicyBlocker =
  | "execution_request_missing"
  | "artifact_not_rendered"
  | "plan_identity_mismatch"
  | "artifact_identity_mismatch"
  | "target_identity_mismatch"
  | "dialect_mismatch"
  | "manual_trigger_missing"
  | "authentication_context_missing"
  | "authorization_context_missing"
  | "read_only_not_enforced"
  | "prohibited_statement_type"
  | "schema_not_allowed"
  | "table_not_allowed"
  | "sensitive_data_policy_missing"
  | "timeout_policy_missing"
  | "result_limit_missing"
  | "audit_logging_required"
  | "execution_artifact_required";

export type BusinessSqlExecutionPolicyWarning =
  | "high_row_limit"
  | "sensitive_data_present"
  | "production_target"
  | "result_persistence_disabled"
  | "audit_context_incomplete"
  | "local_target_only"
  | "production_review_required";

export type BusinessSqlExecutionPolicyRequiredAction =
  | "provide_authentication_context"
  | "provide_authorization_context"
  | "enforce_read_only"
  | "provide_required_limits"
  | "provide_sensitive_data_policy"
  | "provide_audit_context"
  | "obtain_production_review";

export type BusinessSqlExecutionPolicyEvaluation = {
  evaluationId: string;
  status: BusinessSqlExecutionPolicyStatus;
  allowed: boolean;
  blockers: BusinessSqlExecutionPolicyBlocker[];
  warnings: BusinessSqlExecutionPolicyWarning[];
  requiredActions: BusinessSqlExecutionPolicyRequiredAction[];
  evaluatedPolicyVersion: BusinessSqlExecutionPolicy["policyVersion"];
  requestId: string | null;
  artifactId: string;
  targetId: string;
  planId: string;
  metadataOnly: true;
  containsExecutionResult: false;
  containsCredentials: false;
};

export type EvaluateBusinessSqlExecutionPolicyInput = {
  executionRequest: BusinessSqlExecutionRequest | null;
  artifact: SqlArtifact;
  target: BusinessSqlExecutionTarget;
  policy: BusinessSqlExecutionPolicy;
  context: BusinessSqlExecutionPolicyContext;
};

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

const isTrustedAnalyticalSelect = (artifact: SqlArtifact): boolean => {
  if (!artifact.rendered || !artifact.sql || artifact.reasonCode !== "rendered") return false;
  if (artifact.renderPurpose !== "execution") return false;
  const normalized = artifact.sql.trim();
  if (!/^SELECT\b/i.test(normalized)) return false;
  return !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|MERGE|CALL|COPY|PRAGMA|ATTACH|DETACH|BEGIN|COMMIT|ROLLBACK)\b/i.test(normalized);
};

const evaluationIdFor = ({
  requestId,
  artifactId,
  targetId,
  policyId,
  blockers,
  warnings,
}: {
  requestId: string | null;
  artifactId: string;
  targetId: string;
  policyId: string;
  blockers: readonly BusinessSqlExecutionPolicyBlocker[];
  warnings: readonly BusinessSqlExecutionPolicyWarning[];
}): string =>
  stablePrimitiveId("business-sql-execution-policy-evaluation", [
    requestId,
    artifactId,
    targetId,
    policyId,
    blockers.join("|"),
    warnings.join("|"),
  ]);

export function evaluateBusinessSqlExecutionPolicy({
  executionRequest,
  artifact,
  target,
  policy,
  context,
}: EvaluateBusinessSqlExecutionPolicyInput): BusinessSqlExecutionPolicyEvaluation {
  const blockers: BusinessSqlExecutionPolicyBlocker[] = [];
  const warnings: BusinessSqlExecutionPolicyWarning[] = [];
  const requiredActions: BusinessSqlExecutionPolicyRequiredAction[] = [];

  if (!executionRequest) blockers.push("execution_request_missing");
  if (!artifact.rendered || !artifact.sql) blockers.push("artifact_not_rendered");
  if (!isTrustedAnalyticalSelect(artifact)) blockers.push("prohibited_statement_type");
  if (executionRequest && executionRequest.planId !== artifact.planId) blockers.push("plan_identity_mismatch");
  if (executionRequest && executionRequest.artifactId !== artifact.artifactId) blockers.push("artifact_identity_mismatch");
  if (executionRequest && executionRequest.executionTargetId !== target.id) blockers.push("target_identity_mismatch");
  if (executionRequest && (executionRequest.dialect !== target.dialect || artifact.dialect !== target.dialect)) {
    blockers.push("dialect_mismatch");
  }
  if (executionRequest && !executionRequest.manualTrigger) blockers.push("manual_trigger_missing");
  if (artifact.renderPurpose !== "execution") blockers.push("execution_artifact_required");

  if (policy.authenticationRequired && !context.authenticationContextPresent) {
    blockers.push("authentication_context_missing");
    requiredActions.push("provide_authentication_context");
  }
  if (policy.authorizationRequired && !context.authorizationContextPresent) {
    blockers.push("authorization_context_missing");
    requiredActions.push("provide_authorization_context");
  }
  if (policy.readOnlyEnforcementRequired && !context.readOnlyEnforced) {
    blockers.push("read_only_not_enforced");
    requiredActions.push("enforce_read_only");
  }
  if (policy.sensitiveDataPolicyRequired && !context.sensitiveDataPolicyPresent) {
    blockers.push("sensitive_data_policy_missing");
    requiredActions.push("provide_sensitive_data_policy");
  }
  if (policy.timeoutRequired && !executionRequest?.requestedLimits.maxExecutionMilliseconds) {
    blockers.push("timeout_policy_missing");
    requiredActions.push("provide_required_limits");
  }
  if (policy.maximumReturnedRowsRequired && !executionRequest?.requestedLimits.maxReturnedRows) {
    blockers.push("result_limit_missing");
    requiredActions.push("provide_required_limits");
  }
  if (policy.auditLoggingRequired && !context.auditContextPresent) {
    blockers.push("audit_logging_required");
    requiredActions.push("provide_audit_context");
  }

  const allowedSchemas = new Set([...(policy.allowedSchemas || []), ...(context.allowedSchemas || [])]);
  const allowedTables = new Set([...(policy.allowedTables || []), ...(context.allowedTables || [])]);
  if (allowedSchemas.size > 0) {
    for (const schema of context.referencedSchemas || []) {
      if (!allowedSchemas.has(schema)) blockers.push("schema_not_allowed");
    }
  }
  if (allowedTables.size > 0) {
    for (const table of context.referencedTables || []) {
      if (!allowedTables.has(table)) blockers.push("table_not_allowed");
    }
  }

  if ((executionRequest?.requestedLimits.maxReturnedRows || 0) > 10000) warnings.push("high_row_limit");
  if (context.containsSensitiveData) warnings.push("sensitive_data_present");
  if (target.environment === "production") warnings.push("production_target");
  if (target.environment === "local") warnings.push("local_target_only");
  if (!executionRequest?.requestedLimits.persistenceAllowed) warnings.push("result_persistence_disabled");
  if (!context.auditContextPresent) warnings.push("audit_context_incomplete");
  if (policy.productionReviewRequired && !context.productionReviewApproved) {
    warnings.push("production_review_required");
    requiredActions.push("obtain_production_review");
  }

  const uniqueBlockers = unique(blockers);
  const uniqueWarnings = unique(warnings);
  const status: BusinessSqlExecutionPolicyStatus =
    uniqueBlockers.length > 0
      ? "blocked"
      : uniqueWarnings.includes("production_review_required")
        ? "needs_review"
        : "allowed";
  const evaluationId = evaluationIdFor({
    requestId: executionRequest?.requestId || null,
    artifactId: artifact.artifactId,
    targetId: target.id,
    policyId: policy.policyId,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
  });

  return {
    evaluationId,
    status,
    allowed: status === "allowed",
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    requiredActions: unique(requiredActions),
    evaluatedPolicyVersion: policy.policyVersion,
    requestId: executionRequest?.requestId || null,
    artifactId: artifact.artifactId,
    targetId: target.id,
    planId: artifact.planId,
    metadataOnly: true,
    containsExecutionResult: false,
    containsCredentials: false,
  };
}

export const canExecuteBusinessSqlRequest = (
  evaluation: BusinessSqlExecutionPolicyEvaluation | null,
): boolean => Boolean(evaluation && evaluation.status === "allowed" && evaluation.allowed);
