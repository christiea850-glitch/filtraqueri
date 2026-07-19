import type { SchemaColumn } from "../dataset/datasetTypes";
import type {
  TransformationPipeline,
  TransformationStep,
  TransformationStepKind,
} from "./transformationPipeline";

export type PreviewRow = Record<string, unknown>;

export type TransformationPreviewChange = {
  rowIndex: number;
  columnName: string;
  beforeValue: unknown;
  afterValue: unknown;
  changeType: "replaced" | "derived" | "unchanged" | "blocked";
};

export type TransformationPreviewStepResult = {
  stepId: string;
  order: number;
  kind: TransformationStepKind;
  status: "applied" | "blocked" | "unsupported";
  affectedRowCount: number;
  outputColumns: string[];
  blockers: string[];
};

export type TransformationPipelinePreview = {
  status: "ready" | "blocked" | "empty";
  sourceRowCount: number;
  previewRowCount: number;
  originalRows: PreviewRow[];
  transformedRows: PreviewRow[];
  changes: TransformationPreviewChange[];
  stepResults: TransformationPreviewStepResult[];
  warnings: string[];
};

export type PreviewTransformationPipelineInput = {
  rows: PreviewRow[];
  pipeline: TransformationPipeline;
  schema: SchemaColumn[];
};

type StepApplyResult = {
  rows: PreviewRow[];
  changes: TransformationPreviewChange[];
  affectedRowCount: number;
  outputColumns: string[];
  blockers: string[];
  warnings: string[];
};

const supportedPreviewKinds = new Set<TransformationStepKind>([
  "fill_missing_zero",
  "fill_missing_custom",
  "fill_missing_mean",
  "fill_missing_median",
  "fill_missing_mode",
  "fill_missing_unknown",
  "fill_missing_true",
  "fill_missing_false",
  "trim_whitespace",
  "lowercase",
  "uppercase",
  "boolean_to_integer",
  "extract_year",
  "extract_month",
  "extract_quarter",
  "extract_day_of_week",
  "days_since",
  "log_transform",
  "z_score_scale",
  "min_max_scale",
  "ordinal_encode",
  "frequency_encode",
  "cap_outliers_percentile",
]);

const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const isTransformationPreviewStepSupported = (kind: TransformationStepKind): boolean =>
  supportedPreviewKinds.has(kind);

const cloneRows = (rows: PreviewRow[]): PreviewRow[] => rows.map((row) => ({ ...row }));

const isMissing = (value: unknown): boolean => value === null || value === undefined;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const numericValues = (rows: PreviewRow[], columnName: string): number[] =>
  rows.map((row) => row[columnName]).filter(isFiniteNumber);

const mean = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0) / values.length;

const median = (values: number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
};

const mode = (values: unknown[]): unknown => {
  const counts = new Map<unknown, number>();
  let bestValue: unknown = null;
  let bestCount = 0;
  values.forEach((value) => {
    const nextCount = (counts.get(value) || 0) + 1;
    counts.set(value, nextCount);
    if (nextCount > bestCount) {
      bestValue = value;
      bestCount = nextCount;
    }
  });
  return bestValue;
};

const parseDateUtc = (value: unknown): Date | null => {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const utcDayStart = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const quantile = (values: number[], percentile: number): number => {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 1) return sorted[0];
  const position = (percentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
};

const changeFor = (
  rowIndex: number,
  columnName: string,
  beforeValue: unknown,
  afterValue: unknown,
  changeType: TransformationPreviewChange["changeType"],
): TransformationPreviewChange => ({
  rowIndex,
  columnName,
  beforeValue,
  afterValue,
  changeType,
});

const applyReplacement = (
  rows: PreviewRow[],
  columnName: string,
  transformValue: (value: unknown, row: PreviewRow) => unknown,
  shouldWarn?: (value: unknown) => boolean,
): StepApplyResult => {
  const nextRows = cloneRows(rows);
  const changes: TransformationPreviewChange[] = [];
  let warningCount = 0;
  nextRows.forEach((row, rowIndex) => {
    const beforeValue = row[columnName];
    if (shouldWarn?.(beforeValue)) warningCount += 1;
    const afterValue = transformValue(beforeValue, row);
    row[columnName] = afterValue;
    if (!Object.is(beforeValue, afterValue)) {
      changes.push(changeFor(rowIndex, columnName, beforeValue, afterValue, "replaced"));
    }
  });
  return {
    rows: nextRows,
    changes,
    affectedRowCount: changes.length,
    outputColumns: [columnName],
    blockers: [],
    warnings: warningCount > 0 ? [`${warningCount} non-supported value${warningCount === 1 ? "" : "s"} preserved.`] : [],
  };
};

const applyDerived = (
  rows: PreviewRow[],
  sourceColumnName: string,
  outputColumnName: string,
  deriveValue: (value: unknown, row: PreviewRow) => unknown,
  warningMessage?: string | null,
): StepApplyResult => {
  const nextRows = cloneRows(rows);
  const changes: TransformationPreviewChange[] = [];
  nextRows.forEach((row, rowIndex) => {
    const beforeValue = row[outputColumnName];
    const afterValue = deriveValue(row[sourceColumnName], row);
    row[outputColumnName] = afterValue;
    changes.push(changeFor(rowIndex, outputColumnName, beforeValue, afterValue, "derived"));
  });
  return {
    rows: nextRows,
    changes,
    affectedRowCount: changes.length,
    outputColumns: [outputColumnName],
    blockers: [],
    warnings: warningMessage ? [warningMessage] : [],
  };
};

const applyStep = (rows: PreviewRow[], step: TransformationStep): StepApplyResult => {
  const targetColumn = step.targetColumn;
  const outputColumn = step.outputColumn || targetColumn;
  switch (step.kind) {
    case "fill_missing_zero":
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? 0 : value));
    case "fill_missing_custom":
      if (step.parameters.kind !== "fill_missing_custom") {
        return blockStep(rows, "Custom fill requires a configured replacement value.");
      }
      const customValue = step.parameters.customValue;
      return applyReplacement(rows, targetColumn, (value) =>
        isMissing(value) ? customValue : value,
      );
    case "fill_missing_mean": {
      const values = numericValues(rows, targetColumn);
      if (values.length === 0) return blockStep(rows, "Mean fill requires at least one finite numeric sample value.");
      const replacementValue = mean(values);
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? replacementValue : value));
    }
    case "fill_missing_median": {
      const values = numericValues(rows, targetColumn);
      if (values.length === 0) return blockStep(rows, "Median fill requires at least one finite numeric sample value.");
      const replacementValue = median(values);
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? replacementValue : value));
    }
    case "fill_missing_mode": {
      const values = rows.map((row) => row[targetColumn]).filter((value) => !isMissing(value));
      if (values.length === 0) return blockStep(rows, "Mode fill requires at least one non-missing sample value.");
      const replacementValue = mode(values);
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? replacementValue : value));
    }
    case "fill_missing_unknown":
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? "Unknown" : value));
    case "fill_missing_true":
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? true : value));
    case "fill_missing_false":
      return applyReplacement(rows, targetColumn, (value) => (isMissing(value) ? false : value));
    case "trim_whitespace":
      return applyReplacement(rows, targetColumn, (value) => (typeof value === "string" ? value.trim() : value));
    case "lowercase":
      return applyReplacement(rows, targetColumn, (value) => (typeof value === "string" ? value.toLowerCase() : value));
    case "uppercase":
      return applyReplacement(rows, targetColumn, (value) => (typeof value === "string" ? value.toUpperCase() : value));
    case "boolean_to_integer":
      return applyReplacement(
        rows,
        targetColumn,
        (value) => {
          if (value === true) return 1;
          if (value === false) return 0;
          return value;
        },
        (value) => !isMissing(value) && typeof value !== "boolean",
      );
    case "extract_year":
      return applyDerived(rows, targetColumn, outputColumn, (value) => parseDateUtc(value)?.getUTCFullYear() ?? null);
    case "extract_month":
      return applyDerived(rows, targetColumn, outputColumn, (value) => {
        const date = parseDateUtc(value);
        return date ? date.getUTCMonth() + 1 : null;
      });
    case "extract_quarter":
      return applyDerived(rows, targetColumn, outputColumn, (value) => {
        const date = parseDateUtc(value);
        return date ? Math.floor(date.getUTCMonth() / 3) + 1 : null;
      });
    case "extract_day_of_week":
      return applyDerived(rows, targetColumn, outputColumn, (value) => {
        const date = parseDateUtc(value);
        return date ? weekdayNames[date.getUTCDay()] : null;
      });
    case "days_since": {
      if (step.parameters.kind !== "days_since") return blockStep(rows, "Days-since preview requires an anchor date.");
      const anchorDate = parseDateUtc(step.parameters.anchorDate);
      if (!anchorDate) return blockStep(rows, "Days-since preview requires a valid anchor date.");
      const anchorDay = utcDayStart(anchorDate);
      return applyDerived(rows, targetColumn, outputColumn, (value) => {
        const sourceDate = parseDateUtc(value);
        if (!sourceDate) return null;
        return Math.round((anchorDay - utcDayStart(sourceDate)) / 86400000);
      });
    }
    case "log_transform": {
      let invalidCount = 0;
      const result = applyDerived(rows, targetColumn, outputColumn, (value) => {
        if (isFiniteNumber(value) && value > 0) return Math.log(value);
        if (!isMissing(value)) invalidCount += 1;
        return null;
      });
      return {
        ...result,
        warnings:
          invalidCount > 0
            ? [`${invalidCount} non-positive or non-numeric sample value${invalidCount === 1 ? "" : "s"} became null.`]
            : [],
      };
    }
    case "z_score_scale": {
      const values = numericValues(rows, targetColumn);
      const sampleMean = values.length > 0 ? mean(values) : 0;
      const variance = values.length > 0
        ? values.reduce((total, value) => total + (value - sampleMean) ** 2, 0) / values.length
        : 0;
      const standardDeviation = Math.sqrt(variance);
      if (standardDeviation === 0) {
        return blockStep(rows, "Z-score scaling requires at least two distinct numeric sample values.");
      }
      return applyDerived(rows, targetColumn, outputColumn, (value) =>
        isFiniteNumber(value) ? (value - sampleMean) / standardDeviation : null,
      );
    }
    case "min_max_scale": {
      const values = numericValues(rows, targetColumn);
      if (values.length === 0) return blockStep(rows, "Min-max scaling requires finite numeric sample values.");
      const minimum = Math.min(...values);
      const maximum = Math.max(...values);
      if (minimum === maximum) {
        return blockStep(rows, "Min-max scaling requires at least two distinct numeric sample values.");
      }
      return applyDerived(rows, targetColumn, outputColumn, (value) =>
        isFiniteNumber(value) ? (value - minimum) / (maximum - minimum) : null,
      );
    }
    case "ordinal_encode":
      if (step.parameters.kind !== "ordinal_encode" || step.parameters.order.length === 0) {
        return blockStep(rows, "Ordinal preview requires a configured category order.");
      }
      return applyDerived(rows, targetColumn, outputColumn, (value) => {
        if (isMissing(value)) return null;
        const matchIndex = step.parameters.kind === "ordinal_encode"
          ? step.parameters.order.findIndex((item) => item === String(value))
          : -1;
        return matchIndex >= 0 ? matchIndex : null;
      });
    case "frequency_encode": {
      const presentValues = rows.map((row) => row[targetColumn]).filter((value) => !isMissing(value));
      const counts = new Map<unknown, number>();
      presentValues.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
      return applyDerived(rows, targetColumn, outputColumn, (value) => {
        if (isMissing(value)) return null;
        const count = counts.get(value) || 0;
        return presentValues.length > 0 ? count / presentValues.length : null;
      });
    }
    case "cap_outliers_percentile": {
      if (step.parameters.kind !== "cap_outliers_percentile") {
        return blockStep(rows, "Percentile capping requires configured lower and upper percentiles.");
      }
      const { lowerPercentile, upperPercentile } = step.parameters;
      if (
        lowerPercentile < 0 ||
        upperPercentile > 100 ||
        lowerPercentile >= upperPercentile
      ) {
        return blockStep(rows, "Percentile capping requires a lower percentile below the upper percentile.");
      }
      const values = numericValues(rows, targetColumn);
      if (values.length === 0) return blockStep(rows, "Percentile capping requires finite numeric sample values.");
      const lowerValue = quantile(values, lowerPercentile);
      const upperValue = quantile(values, upperPercentile);
      return applyReplacement(rows, targetColumn, (value) => {
        if (!isFiniteNumber(value)) return value;
        return Math.min(Math.max(value, lowerValue), upperValue);
      });
    }
    case "one_hot_encode":
      return blockStep(
        rows,
        "One-hot preview requires deterministic category-column generation and is deferred to a later slice.",
      );
    case "sql_select_transform":
      return blockStep(rows, "SQL transformation preview is blocked for this read-only sample preview.");
  }
};

const blockStep = (rows: PreviewRow[], message: string): StepApplyResult => ({
  rows: cloneRows(rows),
  changes: [],
  affectedRowCount: 0,
  outputColumns: [],
  blockers: [message],
  warnings: [],
});

const unsupportedStepResult = (step: TransformationStep): TransformationPreviewStepResult => ({
  stepId: step.id,
  order: step.order,
  kind: step.kind,
  status: "unsupported",
  affectedRowCount: 0,
  outputColumns: [],
  blockers: [
    step.kind === "one_hot_encode"
      ? "One-hot preview requires deterministic category-column generation and is deferred to a later slice."
      : `Sample preview does not support ${step.kind}.`,
  ],
});

export const previewTransformationPipeline = ({
  rows,
  pipeline,
}: PreviewTransformationPipelineInput): TransformationPipelinePreview => {
  const originalRows = cloneRows(rows);
  let transformedRows = cloneRows(rows);
  const changes: TransformationPreviewChange[] = [];
  const stepResults: TransformationPreviewStepResult[] = [];
  const warnings: string[] = [];

  if (pipeline.steps.length === 0) {
    return {
      status: "empty",
      sourceRowCount: rows.length,
      previewRowCount: rows.length,
      originalRows,
      transformedRows,
      changes,
      stepResults,
      warnings,
    };
  }

  for (const step of pipeline.steps) {
    if (step.status === "blocked") {
      stepResults.push({
        stepId: step.id,
        order: step.order,
        kind: step.kind,
        status: "blocked",
        affectedRowCount: 0,
        outputColumns: [],
        blockers: step.blockers.map((blocker) => blocker.message),
      });
      return {
        status: "blocked",
        sourceRowCount: rows.length,
        previewRowCount: rows.length,
        originalRows,
        transformedRows: cloneRows(originalRows),
        changes: [],
        stepResults,
        warnings,
      };
    }

    if (!isTransformationPreviewStepSupported(step.kind)) {
      stepResults.push(unsupportedStepResult(step));
      return {
        status: "blocked",
        sourceRowCount: rows.length,
        previewRowCount: rows.length,
        originalRows,
        transformedRows: cloneRows(originalRows),
        changes: [],
        stepResults,
        warnings,
      };
    }

    const appliedStep = applyStep(transformedRows, step);
    const hasBlockers = appliedStep.blockers.length > 0;
    stepResults.push({
      stepId: step.id,
      order: step.order,
      kind: step.kind,
      status: hasBlockers ? "blocked" : "applied",
      affectedRowCount: appliedStep.affectedRowCount,
      outputColumns: appliedStep.outputColumns,
      blockers: appliedStep.blockers,
    });

    if (hasBlockers) {
      return {
        status: "blocked",
        sourceRowCount: rows.length,
        previewRowCount: rows.length,
        originalRows,
        transformedRows: cloneRows(originalRows),
        changes: [],
        stepResults,
        warnings,
      };
    }

    transformedRows = appliedStep.rows;
    changes.push(...appliedStep.changes);
    warnings.push(...appliedStep.warnings);
  }

  return {
    status: "ready",
    sourceRowCount: rows.length,
    previewRowCount: transformedRows.length,
    originalRows,
    transformedRows,
    changes,
    stepResults,
    warnings,
  };
};
