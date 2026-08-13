import {
  doesSqlExecutionIdentityMatchContext,
  type CreateSqlExecutionContextIdentityInput,
  type SqlExecutionIdentity,
} from "./sqlExecutionIdentity";
import type { SqlExecutionStatus, SqlPreviewResult } from "./sqlTypes";

export type SqlExecutionDisplayStatus = "not_run" | "running" | "current" | "stale" | "failed";

export type SqlExecutionDisplayStatusModel = {
  status: SqlExecutionDisplayStatus;
  label: string;
  description: string;
};

export type DeriveSqlExecutionDisplayStatusInput = {
  editorStatus: SqlExecutionStatus;
  previewResult: SqlPreviewResult;
  currentContext: CreateSqlExecutionContextIdentityInput | null;
};

const displayStatusCopy: Record<SqlExecutionDisplayStatus, SqlExecutionDisplayStatusModel> = {
  not_run: {
    status: "not_run",
    label: "Not run",
    description: "Select Run Query to execute this SQL in DuckDB.",
  },
  running: {
    status: "running",
    label: "Running",
    description: "Executing this SQL in DuckDB.",
  },
  current: {
    status: "current",
    label: "Current",
    description: "Results match the current SQL and data source.",
  },
  stale: {
    status: "stale",
    label: "Stale",
    description: "SQL or data source changed after the last run. Run again to refresh.",
  },
  failed: {
    status: "failed",
    label: "Failed",
    description: "The latest run failed. Review the error and try again.",
  },
};

const hasUsableExecutionIdentity = (
  executionIdentity: SqlPreviewResult["executionIdentity"],
): executionIdentity is SqlExecutionIdentity =>
  Boolean(
    executionIdentity &&
      typeof executionIdentity.requestId === "string" &&
      typeof executionIdentity.exactSql === "string" &&
      typeof executionIdentity.datasetId === "string" &&
      (typeof executionIdentity.worksheetId === "string" || executionIdentity.worksheetId === null),
  );

const canCompareExecutionContext = (currentContext: CreateSqlExecutionContextIdentityInput | null) =>
  Boolean(currentContext?.exactSql?.trim() && currentContext?.datasetId?.trim());

export function getSqlExecutionDisplayStatusCopy(
  status: SqlExecutionDisplayStatus,
): SqlExecutionDisplayStatusModel {
  return displayStatusCopy[status];
}

export function deriveSqlExecutionDisplayStatus({
  editorStatus,
  previewResult,
  currentContext,
}: DeriveSqlExecutionDisplayStatusInput): SqlExecutionDisplayStatusModel {
  if (editorStatus === "running") {
    return displayStatusCopy.running;
  }

  if (!hasUsableExecutionIdentity(previewResult.executionIdentity)) {
    return displayStatusCopy.not_run;
  }

  if (!canCompareExecutionContext(currentContext)) {
    return displayStatusCopy.stale;
  }

  let isCurrentContext: boolean;
  try {
    isCurrentContext = doesSqlExecutionIdentityMatchContext(
      previewResult.executionIdentity,
      currentContext as CreateSqlExecutionContextIdentityInput,
    );
  } catch {
    return displayStatusCopy.stale;
  }

  if (!isCurrentContext) {
    return displayStatusCopy.stale;
  }

  if (editorStatus === "error" && previewResult.errorInsight) {
    return displayStatusCopy.failed;
  }

  if (editorStatus === "success" && !previewResult.errorInsight) {
    return displayStatusCopy.current;
  }

  return displayStatusCopy.not_run;
}
