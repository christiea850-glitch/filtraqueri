import type { SchemaColumn } from "../dataset/datasetTypes";
import type { WorkbookAnalysisSource } from "../workbook";

export type NumericTransformationKind =
  | "fill_missing_mean"
  | "fill_missing_median"
  | "fill_missing_mode"
  | "fill_missing_zero"
  | "fill_missing_custom"
  | "cap_outliers_percentile"
  | "log_transform"
  | "z_score_scale"
  | "min_max_scale";

export type CategoricalTransformationKind =
  | "fill_missing_mode"
  | "fill_missing_unknown"
  | "one_hot_encode"
  | "ordinal_encode"
  | "frequency_encode";

export type TextTransformationKind =
  | "fill_missing_unknown"
  | "trim_whitespace"
  | "lowercase"
  | "uppercase";

export type DateTransformationKind =
  | "extract_year"
  | "extract_month"
  | "extract_quarter"
  | "extract_day_of_week"
  | "days_since";

export type BooleanTransformationKind =
  | "boolean_to_integer"
  | "fill_missing_true"
  | "fill_missing_false";

export type SqlTransformationKind = "sql_select_transform";

export type TransformationStepKind =
  | NumericTransformationKind
  | CategoricalTransformationKind
  | TextTransformationKind
  | DateTransformationKind
  | BooleanTransformationKind
  | SqlTransformationKind;

export type TransformationStepStatus = "draft" | "valid" | "blocked" | "needs_review";
export type TransformationPipelineStatus = "empty" | "draft" | "ready" | "blocked";

export type TransformationBlockerCode =
  | "no_target_column"
  | "unsupported_kind_for_type"
  | "missing_parameter"
  | "invalid_percentile_range"
  | "sql_execution_disabled"
  | "empty_pipeline"
  | "pipeline_has_blocked_step";

export type TransformationWarningCode =
  | "column_type_inference_low_confidence"
  | "custom_value_type_mismatch"
  | "encoded_output_name_collision";

export type TransformationBlocker = {
  code: TransformationBlockerCode;
  message: string;
};

export type TransformationWarning = {
  code: TransformationWarningCode;
  message: string;
};

export type TransformationStepParameters =
  | { kind: "fill_missing_custom"; customValue: string | number | boolean }
  | { kind: "cap_outliers_percentile"; lowerPercentile: number; upperPercentile: number }
  | { kind: "ordinal_encode"; order: string[] }
  | { kind: "days_since"; anchorDate: string }
  | { kind: "sql_select_transform"; sqlDraft: string }
  | {
      kind: Exclude<
        TransformationStepKind,
        | "fill_missing_custom"
        | "cap_outliers_percentile"
        | "ordinal_encode"
        | "days_since"
        | "sql_select_transform"
      >;
    };

export type TransformationStep = {
  id: string;
  order: number;
  kind: TransformationStepKind;
  targetColumn: string;
  outputColumn: string;
  parameters: TransformationStepParameters;
  status: TransformationStepStatus;
  warnings: TransformationWarning[];
  blockers: TransformationBlocker[];
  summary: string;
  executionDisabled: true;
};

export type TransformationPipelineReadiness = {
  previewReady: boolean;
  applyReady: false;
  reasons: TransformationBlockerCode[];
};

export type TransformationPipelineSafety = {
  noSqlExecution: true;
  noDuckDbExecution: true;
  noBackendCall: true;
  noProviderCall: true;
  noNetworkCall: true;
  noPersistence: true;
  noRowMutation: true;
  noWorkbookMutation: true;
  noAutoRun: true;
  noEditorMutation: true;
};

export type TransformationPipeline = {
  id: string;
  worksheetId: string;
  sourceTableName: string;
  sourceType: WorkbookAnalysisSource["type"];
  steps: TransformationStep[];
  status: TransformationPipelineStatus;
  readiness: TransformationPipelineReadiness;
  warnings: TransformationWarning[];
  blockers: TransformationBlocker[];
  summary: string;
  safety: TransformationPipelineSafety;
};

export type CreateEmptyTransformationPipelineInput = {
  worksheetId: string;
  sourceTableName: string;
  sourceType: WorkbookAnalysisSource["type"];
  seed: string;
  steps?: TransformationStep[];
  warnings?: TransformationWarning[];
};

export type CreateTransformationStepInput = {
  pipelineId: string;
  sequenceIndex: number;
  kind: TransformationStepKind;
  targetColumn?: SchemaColumn | null;
  outputColumn?: string;
  parameters?: TransformationStepParameters;
  warnings?: TransformationWarning[];
};

export type CreateBlockedTransformationStepInput = CreateTransformationStepInput & {
  blocker: TransformationBlocker;
};

const numericTransformations: NumericTransformationKind[] = [
  "fill_missing_mean",
  "fill_missing_median",
  "fill_missing_mode",
  "fill_missing_zero",
  "fill_missing_custom",
  "cap_outliers_percentile",
  "log_transform",
  "z_score_scale",
  "min_max_scale",
];

const categoricalTransformations: CategoricalTransformationKind[] = [
  "fill_missing_mode",
  "fill_missing_unknown",
  "one_hot_encode",
  "ordinal_encode",
  "frequency_encode",
];

const textTransformations: TextTransformationKind[] = [
  "fill_missing_unknown",
  "trim_whitespace",
  "lowercase",
  "uppercase",
];

const dateTransformations: DateTransformationKind[] = [
  "extract_year",
  "extract_month",
  "extract_quarter",
  "extract_day_of_week",
  "days_since",
];

const booleanTransformations: BooleanTransformationKind[] = [
  "boolean_to_integer",
  "fill_missing_true",
  "fill_missing_false",
];

const safety: TransformationPipelineSafety = {
  noSqlExecution: true,
  noDuckDbExecution: true,
  noBackendCall: true,
  noProviderCall: true,
  noNetworkCall: true,
  noPersistence: true,
  noRowMutation: true,
  noWorkbookMutation: true,
  noAutoRun: true,
  noEditorMutation: true,
};

const blockerMessages: Record<TransformationBlockerCode, string> = {
  no_target_column: "Choose a target column before preparing this step.",
  unsupported_kind_for_type: "This transformation is not supported for the target column type.",
  missing_parameter: "This transformation needs a required parameter before preview can be ready.",
  invalid_percentile_range: "Percentile caps need a lower value below the upper value.",
  sql_execution_disabled: "Scripted cleaning is represented for planning only in this slice.",
  empty_pipeline: "Add at least one transformation step before preview can be ready.",
  pipeline_has_blocked_step: "Resolve blocked transformation steps before preview can be ready.",
};

const labels: Record<TransformationStepKind, string> = {
  fill_missing_mean: "fill missing values with the mean",
  fill_missing_median: "fill missing values with the median",
  fill_missing_mode: "fill missing values with the most common value",
  fill_missing_zero: "fill missing values with zero",
  fill_missing_custom: "fill missing values with a custom value",
  cap_outliers_percentile: "cap outliers by percentile",
  log_transform: "create a log-transformed value",
  z_score_scale: "scale values with z scores",
  min_max_scale: "scale values between minimum and maximum",
  fill_missing_unknown: "fill missing values with Unknown",
  one_hot_encode: "create indicator fields for categories",
  ordinal_encode: "encode categories using a fixed order",
  frequency_encode: "encode categories by frequency",
  trim_whitespace: "trim whitespace",
  lowercase: "convert text to lowercase",
  uppercase: "convert text to uppercase",
  extract_year: "extract the year",
  extract_month: "extract the month",
  extract_quarter: "extract the quarter",
  extract_day_of_week: "extract the day of week",
  days_since: "calculate days since an anchor date",
  boolean_to_integer: "convert true and false values to integers",
  fill_missing_true: "fill missing values with true",
  fill_missing_false: "fill missing values with false",
  sql_select_transform: "represent scripted cleaning for later review",
};

const fnv1a = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export const createPipelineId = (seed: string): string =>
  `transformation-pipeline:${fnv1a(seed)}`;

export const createStepId = (pipelineId: string, sequenceIndex: number): string =>
  `transformation-step:${fnv1a(`${pipelineId}:${sequenceIndex}`)}`;

const blocker = (code: TransformationBlockerCode): TransformationBlocker => ({
  code,
  message: blockerMessages[code],
});

const parametersFor = (
  kind: TransformationStepKind,
  parameters?: TransformationStepParameters,
): TransformationStepParameters => {
  if (parameters?.kind === kind) return parameters;
  return { kind } as TransformationStepParameters;
};

const missingParametersFor = (parameters: TransformationStepParameters): boolean => {
  switch (parameters.kind) {
    case "fill_missing_custom":
      return (
        parameters.customValue === undefined ||
        parameters.customValue === "" ||
        parameters.customValue === null
      );
    case "cap_outliers_percentile":
      return (
        typeof parameters.lowerPercentile !== "number" ||
        typeof parameters.upperPercentile !== "number"
      );
    case "ordinal_encode":
      return !Array.isArray(parameters.order) || parameters.order.length === 0;
    case "days_since":
      return typeof parameters.anchorDate !== "string" || parameters.anchorDate.trim().length === 0;
    case "sql_select_transform":
      return typeof parameters.sqlDraft !== "string" || parameters.sqlDraft.trim().length === 0;
    default:
      return false;
  }
};

const hasInvalidPercentiles = (parameters: TransformationStepParameters): boolean =>
  parameters.kind === "cap_outliers_percentile" &&
  (parameters.lowerPercentile < 0 ||
    parameters.upperPercentile > 100 ||
    parameters.lowerPercentile >= parameters.upperPercentile);

export const isTransformationStepSupportedForColumn = (
  kind: TransformationStepKind,
  column: SchemaColumn,
): boolean => {
  if (kind === "sql_select_transform") return false;
  if (column.inferred_type === "numeric") return numericTransformations.includes(kind as NumericTransformationKind);
  if (column.inferred_type === "categorical") {
    return categoricalTransformations.includes(kind as CategoricalTransformationKind);
  }
  if (column.inferred_type === "text") return textTransformations.includes(kind as TextTransformationKind);
  if (column.inferred_type === "date") return dateTransformations.includes(kind as DateTransformationKind);
  if (column.inferred_type === "boolean") {
    return booleanTransformations.includes(kind as BooleanTransformationKind);
  }
  return false;
};

export const getSupportedTransformationsForColumn = (
  column: SchemaColumn,
): TransformationStepKind[] => {
  if (column.inferred_type === "numeric") return [...numericTransformations];
  if (column.inferred_type === "categorical") return [...categoricalTransformations];
  if (column.inferred_type === "text") return [...textTransformations];
  if (column.inferred_type === "date") return [...dateTransformations];
  if (column.inferred_type === "boolean") return [...booleanTransformations];
  return [];
};

export const summarizeTransformationStep = (step: TransformationStep): string => {
  const target = step.targetColumn || "the selected column";
  const output = step.outputColumn || target;
  const base = `Prepare ${target}: ${labels[step.kind]}. Output field: ${output}.`;
  if (step.status === "blocked") return `${base} This step is blocked.`;
  if (step.status === "needs_review") return `${base} This step needs review.`;
  return base;
};

export const createTransformationStep = (
  input: CreateTransformationStepInput,
): TransformationStep => {
  const parameters = parametersFor(input.kind, input.parameters);
  const blockers: TransformationBlocker[] = [];

  if (!input.targetColumn) blockers.push(blocker("no_target_column"));
  if (input.kind === "sql_select_transform") blockers.push(blocker("sql_execution_disabled"));
  if (input.targetColumn && !isTransformationStepSupportedForColumn(input.kind, input.targetColumn)) {
    blockers.push(blocker("unsupported_kind_for_type"));
  }
  if (missingParametersFor(parameters)) blockers.push(blocker("missing_parameter"));
  if (hasInvalidPercentiles(parameters)) blockers.push(blocker("invalid_percentile_range"));

  const stepWithoutSummary: Omit<TransformationStep, "summary"> = {
    id: createStepId(input.pipelineId, input.sequenceIndex),
    order: input.sequenceIndex,
    kind: input.kind,
    targetColumn: input.targetColumn?.name || "",
    outputColumn: input.outputColumn || input.targetColumn?.name || "",
    parameters,
    status: blockers.length > 0 ? "blocked" : "valid",
    warnings: input.warnings ? [...input.warnings] : [],
    blockers,
    executionDisabled: true,
  };

  const step: TransformationStep = {
    ...stepWithoutSummary,
    summary: "",
  };
  return {
    ...step,
    summary: summarizeTransformationStep(step),
  };
};

export const createBlockedTransformationStep = (
  input: CreateBlockedTransformationStepInput,
): TransformationStep => {
  const step = createTransformationStep(input);
  const blockers = [...step.blockers, { ...input.blocker }];
  const blockedStep: TransformationStep = {
    ...step,
    blockers,
    status: "blocked",
  };
  return {
    ...blockedStep,
    summary: summarizeTransformationStep(blockedStep),
  };
};

export const getTransformationPipelineReadiness = (
  pipeline: TransformationPipeline,
): TransformationPipelineReadiness => {
  if (pipeline.steps.length === 0) {
    return {
      previewReady: false,
      applyReady: false,
      reasons: ["empty_pipeline"],
    };
  }
  if (pipeline.steps.some((step) => step.status === "blocked")) {
    return {
      previewReady: false,
      applyReady: false,
      reasons: ["pipeline_has_blocked_step"],
    };
  }
  return {
    previewReady: true,
    applyReady: false,
    reasons: [],
  };
};

export const summarizeTransformationPipeline = (
  pipeline: TransformationPipeline,
): string => {
  if (pipeline.steps.length === 0) {
    return "No transformation steps have been added. Preview and Apply remain unavailable.";
  }
  const stepCount = pipeline.steps.length;
  const previewCopy = pipeline.readiness.previewReady
    ? "Preview can be prepared from the draft plan."
    : "Preview is not ready yet.";
  return `${stepCount} transformation step${stepCount === 1 ? "" : "s"} planned for ${pipeline.sourceTableName}. ${previewCopy} Apply remains unavailable in this slice.`;
};

const pipelineBlockersFor = (
  readiness: TransformationPipelineReadiness,
): TransformationBlocker[] => readiness.reasons.map(blocker);

export const createEmptyTransformationPipeline = (
  input: CreateEmptyTransformationPipelineInput,
): TransformationPipeline => {
  const basePipeline: TransformationPipeline = {
    id: createPipelineId(input.seed),
    worksheetId: input.worksheetId,
    sourceTableName: input.sourceTableName,
    sourceType: input.sourceType,
    steps: input.steps
      ? input.steps.map((step) => ({
          ...step,
          warnings: step.warnings.map((warning) => ({ ...warning })),
          blockers: step.blockers.map((item) => ({ ...item })),
        }))
      : [],
    status: "empty",
    readiness: {
      previewReady: false,
      applyReady: false,
      reasons: ["empty_pipeline"],
    },
    warnings: input.warnings ? [...input.warnings] : [],
    blockers: [],
    summary: "",
    safety: { ...safety },
  };
  const readiness = getTransformationPipelineReadiness(basePipeline);
  const status: TransformationPipelineStatus =
    basePipeline.steps.length === 0
      ? "empty"
      : readiness.reasons.includes("pipeline_has_blocked_step")
        ? "blocked"
        : "draft";
  const pipeline: TransformationPipeline = {
    ...basePipeline,
    readiness,
    status,
    blockers: pipelineBlockersFor(readiness),
  };
  return {
    ...pipeline,
    summary: summarizeTransformationPipeline(pipeline),
  };
};
