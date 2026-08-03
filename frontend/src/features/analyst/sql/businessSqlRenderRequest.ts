import type { BusinessSqlQueryPlan } from "./businessSqlQueryPlan";
import { stablePrimitiveId } from "./businessSqlQueryPlan";
import {
  DEFAULT_BUSINESS_SQL_EXECUTION_TARGET,
  type BusinessSqlExecutionTarget,
} from "./businessSqlExecutionTarget";
import type { BusinessSqlRendererDialectId } from "./businessSqlRendererContracts";

export type BusinessSqlRenderPurpose = "preview" | "export" | "execution";

export type { BusinessSqlExecutionTarget } from "./businessSqlExecutionTarget";

export type BusinessSqlRenderRequest = {
  requestId: string;
  planId: string;
  plan: BusinessSqlQueryPlan;
  dialect: BusinessSqlRendererDialectId;
  purpose: BusinessSqlRenderPurpose;
  rendererConfigurationId: string;
  capabilityContext?: {
    metadataOnly: true;
  };
  executionTarget?: BusinessSqlExecutionTarget;
  executionPermissionGranted: false;
  containsRenderedSql: false;
  containsExecutionCredentials: false;
  containsResultRows: false;
  containsUiComponentState: false;
  rawPromptReinterpreted: false;
};

export type CreateBusinessSqlRenderRequestInput = {
  plan: BusinessSqlQueryPlan;
  dialect?: BusinessSqlRendererDialectId;
  purpose: BusinessSqlRenderPurpose;
  rendererConfigurationId?: string;
  capabilityContext?: BusinessSqlRenderRequest["capabilityContext"];
  executionTarget?: BusinessSqlExecutionTarget;
};

const DEFAULT_RENDERER_CONFIGURATION_ID = "business-sql-renderer-config:default";

export const createBusinessSqlRenderRequestId = ({
  planId,
  dialect,
  purpose,
  rendererConfigurationId = DEFAULT_RENDERER_CONFIGURATION_ID,
  executionTarget,
}: {
  planId: string;
  dialect: BusinessSqlRendererDialectId;
  purpose: BusinessSqlRenderPurpose;
  rendererConfigurationId?: string;
  executionTarget?: BusinessSqlExecutionTarget;
}): string =>
  stablePrimitiveId("business-sql-render-request", [
    planId,
    dialect,
    purpose,
    rendererConfigurationId,
    executionTarget?.id,
    executionTarget?.dialect,
    executionTarget?.connectionKind,
    executionTarget?.environment,
    executionTarget?.dataSensitivity,
    executionTarget?.readOnlyRequired,
    executionTarget?.allowedExecutionMode,
    executionTarget?.targetConfigurationId,
  ]);

export const createBusinessSqlRenderRequest = ({
  plan,
  dialect = "duckdb",
  purpose,
  rendererConfigurationId = DEFAULT_RENDERER_CONFIGURATION_ID,
  capabilityContext,
  executionTarget,
}: CreateBusinessSqlRenderRequestInput): BusinessSqlRenderRequest => ({
  requestId: createBusinessSqlRenderRequestId({
    planId: plan.id,
    dialect,
    purpose,
    rendererConfigurationId,
    executionTarget,
  }),
  planId: plan.id,
  plan,
  dialect,
  purpose,
  rendererConfigurationId,
  ...(capabilityContext ? { capabilityContext } : {}),
  ...(executionTarget ? { executionTarget } : {}),
  executionPermissionGranted: false,
  containsRenderedSql: false,
  containsExecutionCredentials: false,
  containsResultRows: false,
  containsUiComponentState: false,
  rawPromptReinterpreted: false,
});

export const createBusinessSqlPreviewRenderRequest = (
  plan: BusinessSqlQueryPlan,
  dialect: BusinessSqlRendererDialectId = "duckdb",
): BusinessSqlRenderRequest =>
  createBusinessSqlRenderRequest({
    plan,
    dialect,
    purpose: "preview",
    capabilityContext: { metadataOnly: true },
  });

export const createBusinessSqlExecutionRenderRequest = ({
  plan,
  executionTarget,
}: {
  plan: BusinessSqlQueryPlan;
  executionTarget: BusinessSqlExecutionTarget;
}): BusinessSqlRenderRequest =>
  createBusinessSqlRenderRequest({
    plan,
    dialect: executionTarget.dialect,
    purpose: "execution",
    capabilityContext: { metadataOnly: true },
    executionTarget,
  });

export { DEFAULT_BUSINESS_SQL_EXECUTION_TARGET };
