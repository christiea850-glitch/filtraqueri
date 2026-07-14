import type {
  BusinessSqlRendererReasonCode,
  BusinessSqlRenderResult,
} from "./businessSqlRenderer";

export type BusinessSqlRendererPreviewDisplayStatus =
  | "rendered"
  | "needs_review"
  | "blocked"
  | "unsupported";

export type BusinessSqlRendererPreviewUiModel = {
  displayStatus: BusinessSqlRendererPreviewDisplayStatus;
  title: string;
  body: string;
  sqlText: string | null;
  planId: string;
  rendererTargetLabel: "DuckDB";
  reasonCode: BusinessSqlRendererReasonCode;
  warnings: string[];
  blockers: string[];
  safetyLabels: {
    previewOnly: "Preview only";
    notExecuted: "Not executed";
    notInsertedAutomatically: "Not inserted automatically";
    runQueryManual: "Run Query remains manual";
  };
  actions: {
    canPreviewSql: boolean;
    canCopySql: boolean;
    canInsertSql: false;
    canRunSql: false;
  };
  insertEligibility: {
    eligible: false;
    metadataOnly: true;
    disabledReason: string;
  };
  noSqlExecution: true;
  noDuckDbExecution: true;
  noEditorMutation: true;
  noBackendCall: true;
  noProviderCall: true;
  noNetworkCall: true;
  noPersistence: true;
  summary: string;
};

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const displayStatusFor = (
  result: BusinessSqlRenderResult,
): BusinessSqlRendererPreviewDisplayStatus => {
  if (result.rendered) return "rendered";
  if (result.reasonCode === "unsupported_plan_shape") return "unsupported";
  return result.status === "blocked" ? "blocked" : "needs_review";
};

const titleFor = (status: BusinessSqlRendererPreviewDisplayStatus): string => {
  if (status === "rendered") return "Business SQL renderer preview ready";
  if (status === "blocked") return "Business SQL renderer preview blocked";
  if (status === "unsupported") return "Business SQL renderer shape unsupported";
  return "Business SQL renderer preview needs review";
};

const bodyFor = (status: BusinessSqlRendererPreviewDisplayStatus): string => {
  if (status === "rendered") {
    return "DuckDB SQL is available for read-only preview. It has not been inserted or run.";
  }
  if (status === "blocked") {
    return "SQL cannot be previewed until blocking renderer issues are resolved.";
  }
  if (status === "unsupported") {
    return "This plan shape is not supported by the deterministic renderer yet.";
  }
  return "SQL cannot be previewed until the plan is ready for guarded rendering.";
};

const insertDisabledReasonFor = (
  status: BusinessSqlRendererPreviewDisplayStatus,
): string => {
  if (status === "rendered") {
    return "Renderer preview is read-only in this adapter. Insert requires a separate explicit UI action.";
  }
  return "SQL can be inserted only from a rendered preview, and this adapter never inserts SQL.";
};

export function createBusinessSqlRendererPreviewUiModel(
  result: BusinessSqlRenderResult,
): BusinessSqlRendererPreviewUiModel {
  const displayStatus = displayStatusFor(result);
  const sqlText = result.rendered ? result.sql : null;
  const blockers = uniqueStrings([
    ...result.blockers,
    ...(displayStatus === "blocked" || displayStatus === "unsupported"
      ? result.reasons
      : []),
  ]);
  const summary = [
    `plan=${result.planId}`,
    `display=${displayStatus}`,
    `rendered=${result.rendered}`,
    `reason=${result.reasonCode}`,
    "target=DuckDB",
    `sql=${sqlText ? "present" : "none"}`,
    "copy=" + Boolean(sqlText),
    "insert=false",
    "run=false",
    "execution=false",
  ].join("; ");

  return {
    displayStatus,
    title: titleFor(displayStatus),
    body: bodyFor(displayStatus),
    sqlText,
    planId: result.planId,
    rendererTargetLabel: "DuckDB",
    reasonCode: result.reasonCode,
    warnings: uniqueStrings(result.warnings),
    blockers,
    safetyLabels: {
      previewOnly: "Preview only",
      notExecuted: "Not executed",
      notInsertedAutomatically: "Not inserted automatically",
      runQueryManual: "Run Query remains manual",
    },
    actions: {
      canPreviewSql: Boolean(sqlText),
      canCopySql: Boolean(sqlText),
      canInsertSql: false,
      canRunSql: false,
    },
    insertEligibility: {
      eligible: false,
      metadataOnly: true,
      disabledReason: insertDisabledReasonFor(displayStatus),
    },
    noSqlExecution: true,
    noDuckDbExecution: true,
    noEditorMutation: true,
    noBackendCall: true,
    noProviderCall: true,
    noNetworkCall: true,
    noPersistence: true,
    summary,
  };
}
