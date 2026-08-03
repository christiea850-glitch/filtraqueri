import { stablePrimitiveId } from "./businessSqlQueryPlan";
import type { BusinessSqlExecutionRequest } from "./businessSqlExecutionRequest";
import type { BusinessSqlExecutionPolicyEvaluation } from "./businessSqlExecutionPolicyEvaluation";
import type { SqlArtifact } from "./businessSqlRendererContracts";

export type BusinessSqlExecutionAuditLifecycle = "policy_evaluated";

export type BusinessSqlExecutionAuditRecord = {
  auditRecordId: string;
  lifecycle: BusinessSqlExecutionAuditLifecycle;
  executionRequestId: string;
  policyEvaluationId: string;
  planId: string;
  artifactId: string;
  targetId: string;
  dialect: SqlArtifact["dialect"];
  rendererVersion: string;
  policyVersion: BusinessSqlExecutionPolicyEvaluation["evaluatedPolicyVersion"];
  decision: BusinessSqlExecutionPolicyEvaluation["status"];
  blockerCodes: BusinessSqlExecutionPolicyEvaluation["blockers"];
  warningCodes: BusinessSqlExecutionPolicyEvaluation["warnings"];
  manualTrigger: true;
  actorRefPlaceholder: "runtime_actor_ref";
  timestampRuntimeOnly: true;
  containsCredentials: false;
  containsResultRows: false;
  executionStarted: false;
  executionCompleted: false;
  metadataOnly: true;
};

export const createBusinessSqlExecutionAuditRecordId = ({
  executionRequestId,
  policyEvaluationId,
  planId,
  artifactId,
  targetId,
  decision,
}: Pick<
  BusinessSqlExecutionAuditRecord,
  | "executionRequestId"
  | "policyEvaluationId"
  | "planId"
  | "artifactId"
  | "targetId"
  | "decision"
>): string =>
  stablePrimitiveId("business-sql-execution-audit", [
    executionRequestId,
    policyEvaluationId,
    planId,
    artifactId,
    targetId,
    decision,
  ]);

export const createBusinessSqlExecutionAuditRecord = ({
  executionRequest,
  evaluation,
  artifact,
}: {
  executionRequest: BusinessSqlExecutionRequest;
  evaluation: BusinessSqlExecutionPolicyEvaluation;
  artifact: SqlArtifact;
}): BusinessSqlExecutionAuditRecord => ({
  auditRecordId: createBusinessSqlExecutionAuditRecordId({
    executionRequestId: executionRequest.requestId,
    policyEvaluationId: evaluation.evaluationId,
    planId: executionRequest.planId,
    artifactId: artifact.artifactId,
    targetId: executionRequest.executionTargetId,
    decision: evaluation.status,
  }),
  lifecycle: "policy_evaluated",
  executionRequestId: executionRequest.requestId,
  policyEvaluationId: evaluation.evaluationId,
  planId: executionRequest.planId,
  artifactId: artifact.artifactId,
  targetId: executionRequest.executionTargetId,
  dialect: artifact.dialect,
  rendererVersion: artifact.rendererVersion,
  policyVersion: evaluation.evaluatedPolicyVersion,
  decision: evaluation.status,
  blockerCodes: [...evaluation.blockers],
  warningCodes: [...evaluation.warnings],
  manualTrigger: true,
  actorRefPlaceholder: "runtime_actor_ref",
  timestampRuntimeOnly: true,
  containsCredentials: false,
  containsResultRows: false,
  executionStarted: false,
  executionCompleted: false,
  metadataOnly: true,
});
