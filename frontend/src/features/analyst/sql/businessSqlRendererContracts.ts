import type { SqlDialectId } from "../../sqlIntelligence";
import type { BusinessSqlRenderabilityGate } from "./businessSqlRenderabilityGate";
import { stablePrimitiveId } from "./businessSqlQueryPlan";
import type { BusinessSqlQueryPlanJoinResolution } from "./businessSqlQueryPlanJoinResolution";
import type { BusinessSqlRenderRequest } from "./businessSqlRenderRequest";

export type BusinessSqlRendererDialectId = Extract<SqlDialectId, "duckdb" | "postgresql">;

export type BusinessSqlRendererReasonCode =
  | "rendered"
  | "renderability_not_renderable"
  | "readiness_not_ready"
  | "renderer_target_dialect_mismatch"
  | "renderer_target_not_duckdb"
  | "renderer_not_registered"
  | "join_resolution_unresolved"
  | "relationship_review_required"
  | "renderer_capability_incapable"
  | "unsupported_plan_shape"
  | "incomplete_plan_metadata"
  | "unsafe_sql";

export type BusinessSqlRenderResult = {
  status: "rendered" | "needs_review" | "blocked";
  rendered: boolean;
  sql: string | null;
  reasonCode: BusinessSqlRendererReasonCode;
  reasons: string[];
  blockers: string[];
  warnings: string[];
  planId: string;
  rendererTarget: BusinessSqlRendererDialectId;
  executionPayload: null;
  inserted: false;
  ranQuery: false;
  summary: string;
};

export type RenderBusinessSqlInput = {
  integrated: BusinessSqlQueryPlanJoinResolution;
  renderability?: BusinessSqlRenderabilityGate;
  request?: BusinessSqlRenderRequest;
};

export type SqlArtifact = {
  artifactId: string;
  dialect: BusinessSqlRendererDialectId;
  sql: string | null;
  rendererId: string;
  rendererVersion: string;
  renderPurpose: BusinessSqlRenderRequest["purpose"];
  rendererConfigurationId: string;
  requestId: string;
  status: BusinessSqlRenderResult["status"];
  rendered: boolean;
  reasonCode: BusinessSqlRendererReasonCode;
  reasons: string[];
  blockers: string[];
  warnings: string[];
  planId: string;
  executionPayload: null;
  inserted: false;
  ranQuery: false;
  summary: string;
};

export type BusinessSqlDialectCapability = {
  dialect: BusinessSqlRendererDialectId;
  rendererId: string;
  rendererVersion: string;
  capable: boolean;
  status: "capable" | "incapable";
  reasonCodes: string[];
  metadataOnly: true;
};

export type BusinessSqlDialectRenderer = {
  dialect: BusinessSqlRendererDialectId;
  rendererId: string;
  rendererVersion: string;
  render: (input: RenderBusinessSqlInput) => SqlArtifact;
  evaluateCapability: (input: RenderBusinessSqlInput) => BusinessSqlDialectCapability;
};

export const DEFAULT_BUSINESS_SQL_RENDERER_CONFIGURATION_ID =
  "business-sql-renderer-config:default";

export const createBusinessSqlArtifactId = ({
  planId,
  dialect,
  rendererId,
  rendererVersion,
  renderPurpose,
  rendererConfigurationId,
  sql,
  reasonCode,
}: {
  planId: string;
  dialect: BusinessSqlRendererDialectId;
  rendererId: string;
  rendererVersion: string;
  renderPurpose: BusinessSqlRenderRequest["purpose"];
  rendererConfigurationId: string;
  sql: string | null;
  reasonCode: BusinessSqlRendererReasonCode;
}): string =>
  stablePrimitiveId("business-sql-artifact", [
    planId,
    dialect,
    rendererId,
    rendererVersion,
    renderPurpose,
    rendererConfigurationId,
    reasonCode,
    sql || "",
  ]);

export const sqlArtifactFromRenderResult = ({
  result,
  request,
  rendererId,
  rendererVersion,
}: {
  result: BusinessSqlRenderResult;
  request: BusinessSqlRenderRequest;
  rendererId: string;
  rendererVersion: string;
}): SqlArtifact => ({
  artifactId: createBusinessSqlArtifactId({
    planId: result.planId,
    dialect: result.rendererTarget,
    rendererId,
    rendererVersion,
    renderPurpose: request.purpose,
    rendererConfigurationId: request.rendererConfigurationId,
    sql: result.sql,
    reasonCode: result.reasonCode,
  }),
  dialect: result.rendererTarget,
  sql: result.sql,
  rendererId,
  rendererVersion,
  renderPurpose: request.purpose,
  rendererConfigurationId: request.rendererConfigurationId,
  requestId: request.requestId,
  status: result.status,
  rendered: result.rendered,
  reasonCode: result.reasonCode,
  reasons: [...result.reasons],
  blockers: [...result.blockers],
  warnings: [...result.warnings],
  planId: result.planId,
  executionPayload: null,
  inserted: false,
  ranQuery: false,
  summary: result.summary,
});

export const renderResultFromSqlArtifact = (
  artifact: SqlArtifact,
): BusinessSqlRenderResult => ({
  status: artifact.status,
  rendered: artifact.rendered,
  sql: artifact.sql,
  reasonCode: artifact.reasonCode,
  reasons: [...artifact.reasons],
  blockers: [...artifact.blockers],
  warnings: [...artifact.warnings],
  planId: artifact.planId,
  rendererTarget: artifact.dialect,
  executionPayload: null,
  inserted: false,
  ranQuery: false,
  summary: artifact.summary,
});
