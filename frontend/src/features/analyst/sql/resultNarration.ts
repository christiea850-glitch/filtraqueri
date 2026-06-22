import type { LabeledResultColumn } from "./resultLabeling";
import { frameResultValue, humanizeResultColumnName, labelResultColumns } from "./resultLabeling";
import type { BusinessIntent } from "./businessIntentGrounding";
import type { SqlBusinessQuestionShape } from "./sqlBusinessQuestionShape";

export type ResultNarration = {
  text: string;
  confidence: "high" | "medium";
  reason: string;
};

type CreateResultNarrationArgs = {
  columns: readonly string[];
  rows: readonly Record<string, unknown>[];
  taskPrompt?: string;
  detectedIntent?: BusinessIntent;
  questionShape?: SqlBusinessQuestionShape;
  labeledColumns?: readonly LabeledResultColumn[];
};

const MAX_ROWS_TO_CONSIDER = 25;
const MAX_COLUMNS_TO_CONSIDER = 3;
const MAX_LISTED_BREAKDOWN_ROWS = 3;
const MAX_TEXT_VALUE_LENGTH = 32;
const METRIC_COLUMN_PATTERN = /(^|_)(count|total|sum|avg|average|min|max|median|revenue|amount|value|quantity|qty|rate)($|_)/i;
const COUNT_COLUMN_PATTERN = /(^|_)(count|record_count|row_count|total_count|number)($|_)/i;
const CATEGORY_COLUMN_PATTERN = /(^|_)(status|state|type|category|kind)($|_)/i;

const normalizeWords = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const lowerFirst = (value: string) => (value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value);

const formatNumber = (value: number | bigint) =>
  typeof value === "bigint" ? value.toLocaleString("en-US") : value.toLocaleString("en-US");

const pluralize = (value: string, count: number) => {
  const normalized = normalizeWords(value);
  if (count === 1 || !normalized) return normalized;
  if (normalized.endsWith("s")) return normalized;
  if (normalized.endsWith("y") && normalized.length > 1 && !/[aeiou]y$/.test(normalized)) {
    return `${normalized.slice(0, -1)}ies`;
  }
  return `${normalized}s`;
};

const singularize = (value: string) => {
  const normalized = normalizeWords(value);
  if (normalized.endsWith("ies") && normalized.length > 4) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("ses") && normalized.length > 4) return normalized.slice(0, -2);
  if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

const metricEntityFromLabel = (label: string) => {
  const normalized = normalizeWords(label);
  const countMatch = normalized.match(/^(.+) count$/);
  if (countMatch?.[1]) return countMatch[1];
  return null;
};

const promptEntity = (prompt?: string) => {
  const normalized = normalizeWords(prompt ?? "");
  const howMany = normalized.match(/\bhow many\s+([a-z0-9]+(?:\s+[a-z0-9]+){0,2}?)(?:\s+are\b|\s+is\b|\s+was\b|\s+were\b|\s+by\b|\s+in\b|\s+per\b|\s+for\b|\s+with\b|$)/);
  if (howMany?.[1]) return singularize(howMany[1].split(/\s+/).pop() ?? howMany[1]);
  return null;
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const isSafeShortText = (value: unknown) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return Boolean(trimmed) && trimmed.length <= MAX_TEXT_VALUE_LENGTH && normalizeWords(trimmed).split(/\s+/).length <= 4;
};

const joinParts = (parts: string[]) => {
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
};

const findColumn = (labeledColumns: readonly LabeledResultColumn[], predicate: (column: LabeledResultColumn) => boolean) =>
  labeledColumns.find(predicate) ?? null;

export function createResultNarration(args: CreateResultNarrationArgs): ResultNarration | null {
  if (args.columns.length === 0 || args.rows.length === 0) return null;
  if (args.columns.length > MAX_COLUMNS_TO_CONSIDER || args.rows.length > MAX_ROWS_TO_CONSIDER) return null;

  const labeledColumns = args.labeledColumns ?? labelResultColumns({
    columns: args.columns,
    taskPrompt: args.taskPrompt,
    detectedIntent: args.detectedIntent,
    questionShape: args.questionShape,
  });
  const metricColumn = findColumn(labeledColumns, (column) =>
    METRIC_COLUMN_PATTERN.test(column.key) || METRIC_COLUMN_PATTERN.test(column.label),
  );
  if (!metricColumn) return null;

  if (args.rows.some((row) => toFiniteNumber(row[metricColumn.key]) === null)) return null;

  const dimensionColumn = findColumn(labeledColumns, (column) => column.key !== metricColumn.key);

  if (!dimensionColumn) {
    if (args.rows.length !== 1) return null;
    const numericMetrics = labeledColumns.filter((column) => toFiniteNumber(args.rows[0][column.key]) !== null);
    if (numericMetrics.length === 0 || numericMetrics.length !== labeledColumns.length) return null;
    const parts = numericMetrics.map((column) => {
      const value = toFiniteNumber(args.rows[0][column.key]);
      return `${lowerFirst(column.label)} of ${formatNumber(value ?? 0)}`;
    });
    return { text: `This result shows ${joinParts(parts)}.`, confidence: "high", reason: "single-row numeric metric result" };
  }

  if (!args.rows.every((row) => isSafeShortText(row[dimensionColumn.key]))) return null;

  const isCountMetric = COUNT_COLUMN_PATTERN.test(metricColumn.key) || COUNT_COLUMN_PATTERN.test(metricColumn.label);
  const entity = metricEntityFromLabel(metricColumn.label) ?? promptEntity(args.taskPrompt);
  const isStatusBreakdown = CATEGORY_COLUMN_PATTERN.test(dimensionColumn.key) || CATEGORY_COLUMN_PATTERN.test(dimensionColumn.label);

  if (isStatusBreakdown && isCountMetric && entity && args.rows.length <= MAX_LISTED_BREAKDOWN_ROWS) {
    const parts = args.rows.map((row) => {
      const metric = toFiniteNumber(row[metricColumn.key]);
      const framed = frameResultValue({
        value: row[dimensionColumn.key],
        columnKey: dimensionColumn.key,
        columnLabel: dimensionColumn.label,
        taskPrompt: args.taskPrompt,
        detectedIntent: args.detectedIntent,
        questionShape: args.questionShape,
      });
      return `${formatNumber(metric ?? 0)} ${lowerFirst(framed.display)}`;
    });
    return { text: `This result shows ${joinParts(parts)}.`, confidence: "high", reason: "small status count breakdown" };
  }

  if (args.rows.length === 1) {
    const numericMetrics = labeledColumns.filter((column) => toFiniteNumber(args.rows[0][column.key]) !== null);
    if (numericMetrics.length === 0 || numericMetrics.length !== labeledColumns.length) return null;
    const parts = numericMetrics.map((column) => {
      const value = toFiniteNumber(args.rows[0][column.key]);
      return `${lowerFirst(column.label)} of ${formatNumber(value ?? 0)}`;
    });
    return { text: `This result shows ${joinParts(parts)}.`, confidence: "high", reason: "single-row numeric metric result" };
  }

  if (isCountMetric && args.columns.length === 2) {
    const metricLabel = lowerFirst(metricColumn.label);
    const dimensionLabel = lowerFirst(dimensionColumn.label || humanizeResultColumnName(dimensionColumn.key));
    const dimensionPlural = pluralize(dimensionLabel, args.rows.length);
    return {
      text: `This result shows ${metricLabel}s by ${dimensionLabel} for ${args.rows.length.toLocaleString("en-US")} ${dimensionPlural}.`,
      confidence: "medium",
      reason: "grouped count result",
    };
  }

  return null;
}
