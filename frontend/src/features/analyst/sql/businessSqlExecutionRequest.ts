import { stablePrimitiveId } from "./businessSqlQueryPlan";
import type { BusinessSqlRenderRequest, BusinessSqlRenderPurpose } from "./businessSqlRenderRequest";
import type { BusinessSqlExecutionTarget, BusinessSqlExecutionMode } from "./businessSqlExecutionTarget";
import type { BusinessSqlRendererDialectId, SqlArtifact } from "./businessSqlRendererContracts";

export type BusinessSqlExecutionRequestBlocker =
  | "artifact_not_rendered"
  | "artifact_identity_mismatch"
  | "plan_identity_mismatch"
  | "target_identity_mismatch"
  | "dialect_mismatch"
  | "execution_artifact_required"
  | "manual_trigger_missing";

export type BusinessSqlExecutionLimits = {
  maxReturnedRows?: number;
  maxExecutionMilliseconds?: number;
  maxBytesScanned?: number;
  maxEstimatedCost?: number;
  truncationRequired: boolean;
  cancellationSupported: boolean;
  persistenceAllowed: boolean;
};

export type BusinessSqlExecutionAuditContext = {
  auditRequired: boolean;
  actorRef?: string;
  purpose?: string;
  metadataOnly: true;
};

export type BusinessSqlExecutionRequest = {
  requestId: string;
  planId: string;
  renderRequestId: string;
  artifactId: string;
  executionTargetId: string;
  dialect: BusinessSqlRendererDialectId;
  requestedExecutionMode: BusinessSqlExecutionMode;
  requestedLimits: BusinessSqlExecutionLimits;
  requestedAuditContext: BusinessSqlExecutionAuditContext;
  manualTrigger: true;
  renderPurpose: Extract<BusinessSqlRenderPurpose, "execution">;
  executionPermissionGranted: false;
  containsCredentials: false;
  containsExecutionResult: false;
  containsUiComponentState: false;
};

export type CreateBusinessSqlExecutionRequestInput = {
  renderRequest: BusinessSqlRenderRequest;
  artifact: SqlArtifact;
  target: BusinessSqlExecutionTarget;
  requestedLimits: BusinessSqlExecutionLimits;
  requestedAuditContext: BusinessSqlExecutionAuditContext;
  manualTrigger: boolean;
};

export type BusinessSqlExecutionRequestCreationResult =
  | {
      status: "created";
      request: BusinessSqlExecutionRequest;
      blockers: [];
      metadataOnly: true;
    }
  | {
      status: "blocked";
      request: null;
      blockers: BusinessSqlExecutionRequestBlocker[];
      metadataOnly: true;
    };

export const createBusinessSqlExecutionRequestId = ({
  planId,
  renderRequestId,
  artifactId,
  executionTargetId,
  dialect,
  requestedExecutionMode,
  manualTrigger,
}: Pick<
  BusinessSqlExecutionRequest,
  | "planId"
  | "renderRequestId"
  | "artifactId"
  | "executionTargetId"
  | "dialect"
  | "requestedExecutionMode"
  | "manualTrigger"
>): string =>
  stablePrimitiveId("business-sql-execution-request", [
    planId,
    renderRequestId,
    artifactId,
    executionTargetId,
    dialect,
    requestedExecutionMode,
    manualTrigger,
  ]);

export const createBusinessSqlExecutionRequest = ({
  renderRequest,
  artifact,
  target,
  requestedLimits,
  requestedAuditContext,
  manualTrigger,
}: CreateBusinessSqlExecutionRequestInput): BusinessSqlExecutionRequestCreationResult => {
  const blockers: BusinessSqlExecutionRequestBlocker[] = [];
  if (!manualTrigger) blockers.push("manual_trigger_missing");
  if (!artifact.rendered || !artifact.sql) blockers.push("artifact_not_rendered");
  if (renderRequest.planId !== artifact.planId) blockers.push("plan_identity_mismatch");
  if (renderRequest.requestId !== artifact.requestId) blockers.push("artifact_identity_mismatch");
  if (renderRequest.executionTarget?.id && renderRequest.executionTarget.id !== target.id) {
    blockers.push("target_identity_mismatch");
  }
  if (target.dialect !== artifact.dialect || renderRequest.dialect !== target.dialect) {
    blockers.push("dialect_mismatch");
  }
  if (artifact.renderPurpose !== "execution" || renderRequest.purpose !== "execution") {
    blockers.push("execution_artifact_required");
  }

  const uniqueBlockers = Array.from(new Set(blockers));
  if (uniqueBlockers.length > 0) {
    return {
      status: "blocked",
      request: null,
      blockers: uniqueBlockers,
      metadataOnly: true,
    };
  }

  const request: BusinessSqlExecutionRequest = {
    requestId: createBusinessSqlExecutionRequestId({
      planId: artifact.planId,
      renderRequestId: renderRequest.requestId,
      artifactId: artifact.artifactId,
      executionTargetId: target.id,
      dialect: target.dialect,
      requestedExecutionMode: target.allowedExecutionMode,
      manualTrigger: true,
    }),
    planId: artifact.planId,
    renderRequestId: renderRequest.requestId,
    artifactId: artifact.artifactId,
    executionTargetId: target.id,
    dialect: target.dialect,
    requestedExecutionMode: target.allowedExecutionMode,
    requestedLimits: { ...requestedLimits },
    requestedAuditContext: { ...requestedAuditContext },
    manualTrigger: true,
    renderPurpose: "execution",
    executionPermissionGranted: false,
    containsCredentials: false,
    containsExecutionResult: false,
    containsUiComponentState: false,
  };

  return {
    status: "created",
    request,
    blockers: [],
    metadataOnly: true,
  };
};
