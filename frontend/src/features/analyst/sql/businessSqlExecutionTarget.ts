import { stablePrimitiveId } from "./businessSqlQueryPlan";
import type { BusinessSqlRendererDialectId } from "./businessSqlRendererContracts";

export type BusinessSqlExecutionEnvironment = "local" | "development" | "staging" | "production";
export type BusinessSqlDataSensitivity = "public" | "internal" | "confidential" | "restricted";
export type BusinessSqlExecutionConnectionKind = "local_duckdb";
export type BusinessSqlExecutionMode = "read_only_analytical";

export type BusinessSqlExecutionTarget = {
  id: string;
  dialect: BusinessSqlRendererDialectId;
  connectionKind: BusinessSqlExecutionConnectionKind;
  environment: BusinessSqlExecutionEnvironment;
  dataSensitivity: BusinessSqlDataSensitivity;
  readOnlyRequired: true;
  allowedExecutionMode: BusinessSqlExecutionMode;
  targetConfigurationId: string;
  containsCredentials: false;
  containsLiveClient: false;
  containsNetworkHandle: false;
  containsSql: false;
  containsResultRows: false;
  grantsExecutionPermission: false;
};

export type CreateBusinessSqlExecutionTargetInput = Omit<
  BusinessSqlExecutionTarget,
  "id" | "containsCredentials" | "containsLiveClient" | "containsNetworkHandle" | "containsSql" | "containsResultRows" | "grantsExecutionPermission"
> & {
  id?: string;
};

export const createBusinessSqlExecutionTargetId = ({
  dialect,
  connectionKind,
  environment,
  dataSensitivity,
  readOnlyRequired,
  allowedExecutionMode,
  targetConfigurationId,
}: Omit<BusinessSqlExecutionTarget, "id" | "containsCredentials" | "containsLiveClient" | "containsNetworkHandle" | "containsSql" | "containsResultRows" | "grantsExecutionPermission">): string =>
  stablePrimitiveId("business-sql-execution-target", [
    dialect,
    connectionKind,
    environment,
    dataSensitivity,
    readOnlyRequired,
    allowedExecutionMode,
    targetConfigurationId,
  ]);

export const createBusinessSqlExecutionTarget = (
  input: CreateBusinessSqlExecutionTargetInput,
): BusinessSqlExecutionTarget => ({
  ...input,
  id: input.id || createBusinessSqlExecutionTargetId(input),
  containsCredentials: false,
  containsLiveClient: false,
  containsNetworkHandle: false,
  containsSql: false,
  containsResultRows: false,
  grantsExecutionPermission: false,
});

// Local DuckDB compatibility target only. This is not a production policy
// default; later production code must resolve an explicit active connection
// target. The target carries identity metadata and grants no execution permission.
export const DEFAULT_BUSINESS_SQL_EXECUTION_TARGET: BusinessSqlExecutionTarget =
  createBusinessSqlExecutionTarget({
    id: "business-sql-execution-target:local-duckdb",
    dialect: "duckdb",
    connectionKind: "local_duckdb",
    environment: "local",
    dataSensitivity: "internal",
    readOnlyRequired: true,
    allowedExecutionMode: "read_only_analytical",
    targetConfigurationId: "business-sql-execution-target-config:local-duckdb",
  });
