import type {
  BusinessSqlRendererPreviewUiModel,
} from "./businessSqlRendererPreviewUiAdapter";

export type BusinessSqlRendererPreviewManualInsertReasonCode =
  | "eligible"
  | "no_sql_available"
  | "insert_only_from_rendered_duckdb_preview"
  | "resolve_renderer_blockers"
  | "renderer_reason_not_eligible"
  | "editor_already_has_sql"
  | "one_suggestion_already_inserted";

export type BusinessSqlRendererPreviewManualInsertEligibilityInput = {
  rendererPreviewUiModel: BusinessSqlRendererPreviewUiModel | null;
  activeSqlDraft: string;
  priorInsertedFingerprint?: string | null;
};

export type BusinessSqlRendererPreviewManualInsertEligibility = {
  eligible: boolean;
  reasonCode: BusinessSqlRendererPreviewManualInsertReasonCode;
  disabledReason: string | null;
  sqlText: string | null;
  summary: string;
};

export type BusinessSqlRendererPreviewManualInsertResult = {
  inserted: boolean;
  nextSqlDraft: string;
  feedback: string;
  reasonCode: BusinessSqlRendererPreviewManualInsertReasonCode;
  disabledReason: string | null;
  summary: string;
};

const ELIGIBLE_RENDERER_REASONS = new Set(["rendered"]);

const disabledReasonFor = (
  reasonCode: Exclude<BusinessSqlRendererPreviewManualInsertReasonCode, "eligible">,
): string => {
  if (reasonCode === "no_sql_available") return "No SQL is available to insert.";
  if (reasonCode === "resolve_renderer_blockers") {
    return "Resolve renderer blockers before inserting preview SQL.";
  }
  if (reasonCode === "renderer_reason_not_eligible") {
    return "Renderer reason is not eligible for manual insertion.";
  }
  if (reasonCode === "editor_already_has_sql") {
    return "Editor already has SQL. Clear it before inserting preview SQL.";
  }
  if (reasonCode === "one_suggestion_already_inserted") {
    return "One suggestion has already been inserted for this editor draft.";
  }
  return "Insert is available only from a rendered DuckDB preview.";
};

const summaryFor = ({
  eligible,
  reasonCode,
  hasSql,
  draftEmpty,
  blockers,
  displayStatus,
}: {
  eligible: boolean;
  reasonCode: BusinessSqlRendererPreviewManualInsertReasonCode;
  hasSql: boolean;
  draftEmpty: boolean;
  blockers: number;
  displayStatus: string;
}): string =>
  [
    `eligible=${eligible}`,
    `reason=${reasonCode}`,
    `display=${displayStatus}`,
    `sql=${hasSql ? "present" : "none"}`,
    `editor=${draftEmpty ? "empty" : "non_empty"}`,
    `blockers=${blockers}`,
    "insert=manual_only",
    "execution=false",
  ].join("; ");

const ineligible = ({
  reasonCode,
  activeSqlDraft,
  model,
}: {
  reasonCode: Exclude<BusinessSqlRendererPreviewManualInsertReasonCode, "eligible">;
  activeSqlDraft: string;
  model: BusinessSqlRendererPreviewUiModel | null;
}): BusinessSqlRendererPreviewManualInsertEligibility => {
  const sqlText = model?.sqlText?.trim() ? model.sqlText : null;
  return {
    eligible: false,
    reasonCode,
    disabledReason: disabledReasonFor(reasonCode),
    sqlText: null,
    summary: summaryFor({
      eligible: false,
      reasonCode,
      hasSql: Boolean(sqlText),
      draftEmpty: activeSqlDraft.trim() === "",
      blockers: model?.blockers.length || 0,
      displayStatus: model?.displayStatus || "none",
    }),
  };
};

export function getBusinessSqlRendererPreviewManualInsertEligibility({
  rendererPreviewUiModel,
  activeSqlDraft,
  priorInsertedFingerprint = null,
}: BusinessSqlRendererPreviewManualInsertEligibilityInput): BusinessSqlRendererPreviewManualInsertEligibility {
  const model = rendererPreviewUiModel;

  if (!model) {
    return ineligible({ reasonCode: "no_sql_available", activeSqlDraft, model });
  }

  if (model.displayStatus !== "rendered" || model.rendererTargetLabel !== "DuckDB") {
    return ineligible({
      reasonCode: "insert_only_from_rendered_duckdb_preview",
      activeSqlDraft,
      model,
    });
  }

  if (!model.sqlText?.trim()) {
    return ineligible({ reasonCode: "no_sql_available", activeSqlDraft, model });
  }

  if (model.blockers.length > 0) {
    return ineligible({ reasonCode: "resolve_renderer_blockers", activeSqlDraft, model });
  }

  if (!ELIGIBLE_RENDERER_REASONS.has(model.reasonCode)) {
    return ineligible({ reasonCode: "renderer_reason_not_eligible", activeSqlDraft, model });
  }

  if (activeSqlDraft.trim()) {
    return ineligible({ reasonCode: "editor_already_has_sql", activeSqlDraft, model });
  }

  if (priorInsertedFingerprint?.trim()) {
    return ineligible({
      reasonCode: "one_suggestion_already_inserted",
      activeSqlDraft,
      model,
    });
  }

  return {
    eligible: true,
    reasonCode: "eligible",
    disabledReason: null,
    sqlText: model.sqlText,
    summary: summaryFor({
      eligible: true,
      reasonCode: "eligible",
      hasSql: true,
      draftEmpty: true,
      blockers: 0,
      displayStatus: model.displayStatus,
    }),
  };
}

export function applyBusinessSqlRendererPreviewManualInsert(
  input: BusinessSqlRendererPreviewManualInsertEligibilityInput,
): BusinessSqlRendererPreviewManualInsertResult {
  const eligibility = getBusinessSqlRendererPreviewManualInsertEligibility(input);

  if (!eligibility.eligible || !eligibility.sqlText) {
    return {
      inserted: false,
      nextSqlDraft: input.activeSqlDraft,
      feedback: eligibility.disabledReason || "Preview SQL was not inserted.",
      reasonCode: eligibility.reasonCode,
      disabledReason: eligibility.disabledReason,
      summary: eligibility.summary,
    };
  }

  return {
    inserted: true,
    nextSqlDraft: eligibility.sqlText,
    feedback: "Inserted into editor. Review the SQL before running it manually.",
    reasonCode: "eligible",
    disabledReason: null,
    summary: eligibility.summary,
  };
}
