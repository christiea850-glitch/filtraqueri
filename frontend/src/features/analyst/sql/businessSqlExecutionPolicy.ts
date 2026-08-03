import { stablePrimitiveId } from "./businessSqlQueryPlan";
import type { BusinessSqlExecutionTarget } from "./businessSqlExecutionTarget";

export type BusinessSqlExecutionPolicyVersion = "business-sql-execution-policy:v1";

export type BusinessSqlSensitiveDataPolicy = {
  piiAllowed: boolean;
  confidentialColumnsAllowed: boolean;
  restrictedDataAllowed: boolean;
  resultPersistenceAllowed: boolean;
  sampleRowRetentionAllowed: boolean;
  exportAllowed: boolean;
  crossEnvironmentTransferAllowed: boolean;
};

export type BusinessSqlStatementRestrictions = {
  selectOnly: true;
  mutationsAllowed: false;
  ddlAllowed: false;
  transactionControlAllowed: false;
  adminStatementsAllowed: false;
};

export type BusinessSqlExecutionPolicy = {
  policyId: string;
  policyVersion: BusinessSqlExecutionPolicyVersion;
  authenticationRequired: boolean;
  authorizationRequired: boolean;
  readOnlyEnforcementRequired: true;
  allowedSchemas?: readonly string[];
  allowedTables?: readonly string[];
  forbiddenSchemas?: readonly string[];
  forbiddenTables?: readonly string[];
  rowLevelSecurityContextRequired: boolean;
  sensitiveDataPolicyRequired: boolean;
  sensitiveDataPolicy?: BusinessSqlSensitiveDataPolicy;
  statementRestrictions: BusinessSqlStatementRestrictions;
  maximumReturnedRowsRequired: boolean;
  maximumExecutionMillisecondsRequired: boolean;
  maximumScannedRowsRequired: boolean;
  timeoutRequired: boolean;
  resourceCostLimitRequired: boolean;
  cancellationRequired: boolean;
  auditLoggingRequired: boolean;
  resultPersistencePolicyRequired: boolean;
  productionReviewRequired: boolean;
  metadataOnly: true;
};

export type BusinessSqlExecutionPolicyContext = {
  authenticationContextPresent?: boolean;
  authorizationContextPresent?: boolean;
  readOnlyEnforced?: boolean;
  allowedSchemas?: readonly string[];
  allowedTables?: readonly string[];
  referencedSchemas?: readonly string[];
  referencedTables?: readonly string[];
  rowLevelSecurityContextPresent?: boolean;
  sensitiveDataPolicyPresent?: boolean;
  auditContextPresent?: boolean;
  productionReviewApproved?: boolean;
  containsSensitiveData?: boolean;
  metadataOnly: true;
};

export const createBusinessSqlExecutionPolicyId = (
  policy: Omit<BusinessSqlExecutionPolicy, "policyId">,
): string =>
  stablePrimitiveId("business-sql-execution-policy", [
    policy.policyVersion,
    policy.authenticationRequired,
    policy.authorizationRequired,
    policy.readOnlyEnforcementRequired,
    policy.rowLevelSecurityContextRequired,
    policy.sensitiveDataPolicyRequired,
    policy.maximumReturnedRowsRequired,
    policy.maximumExecutionMillisecondsRequired,
    policy.maximumScannedRowsRequired,
    policy.timeoutRequired,
    policy.resourceCostLimitRequired,
    policy.cancellationRequired,
    policy.auditLoggingRequired,
    policy.resultPersistencePolicyRequired,
    policy.productionReviewRequired,
  ]);

export const createBusinessSqlExecutionPolicy = (
  policy: Omit<BusinessSqlExecutionPolicy, "policyId" | "policyVersion" | "metadataOnly"> &
    Partial<Pick<BusinessSqlExecutionPolicy, "policyVersion">>,
): BusinessSqlExecutionPolicy => {
  const withoutId = {
    ...policy,
    policyVersion: policy.policyVersion || "business-sql-execution-policy:v1",
    metadataOnly: true,
  } satisfies Omit<BusinessSqlExecutionPolicy, "policyId">;
  return {
    ...withoutId,
    policyId: createBusinessSqlExecutionPolicyId(withoutId),
  };
};

export const DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY =
  createBusinessSqlExecutionPolicy({
    authenticationRequired: false,
    authorizationRequired: false,
    readOnlyEnforcementRequired: true,
    rowLevelSecurityContextRequired: false,
    sensitiveDataPolicyRequired: true,
    sensitiveDataPolicy: {
      piiAllowed: false,
      confidentialColumnsAllowed: false,
      restrictedDataAllowed: false,
      resultPersistenceAllowed: false,
      sampleRowRetentionAllowed: false,
      exportAllowed: false,
      crossEnvironmentTransferAllowed: false,
    },
    statementRestrictions: {
      selectOnly: true,
      mutationsAllowed: false,
      ddlAllowed: false,
      transactionControlAllowed: false,
      adminStatementsAllowed: false,
    },
    maximumReturnedRowsRequired: true,
    maximumExecutionMillisecondsRequired: true,
    maximumScannedRowsRequired: false,
    timeoutRequired: true,
    resourceCostLimitRequired: false,
    cancellationRequired: true,
    auditLoggingRequired: true,
    resultPersistencePolicyRequired: true,
    productionReviewRequired: false,
  });

export const productionPolicyFor = (
  target: BusinessSqlExecutionTarget,
): BusinessSqlExecutionPolicy =>
  createBusinessSqlExecutionPolicy({
    ...DEFAULT_LOCAL_DUCKDB_BUSINESS_SQL_EXECUTION_POLICY,
    authenticationRequired: target.environment === "production",
    authorizationRequired: target.environment === "production",
    rowLevelSecurityContextRequired: target.environment === "production",
    productionReviewRequired: target.environment === "production",
  });
