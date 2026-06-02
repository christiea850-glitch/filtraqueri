import type { SchemaColumn } from "../dataset/datasetTypes";

export type MissingValueStrategy =
  | "leave_unchanged"
  | "layout_space"
  | "remove_mostly_blank_rows"
  | "decide_per_column"
  | "fill_mean"
  | "fill_median"
  | "fill_zero"
  | "fill_mode"
  | "fill_custom"
  | "mark_unknown"
  | "custom_date"
  | "flag_for_review";

export type MissingValueDecision = {
  strategy: MissingValueStrategy;
  customValue?: string;
  updatedAt: string;
};

export type MissingValueDecisionMap = Record<string, MissingValueDecision>;

export const MISSING_VALUE_DECISION_STORAGE_KEY = "filtraqueri:missing-value-decisions";
export const WORKSHEET_DECISION_COLUMN = "__worksheet__";

export const createMissingValueDecisionKey = (
  datasetId: string,
  worksheetId: string,
  columnName: string,
) => `${datasetId}:${worksheetId}:${columnName}`;

export const readMissingValueDecisions = (): MissingValueDecisionMap => {
  try {
    const storedValue = window.localStorage.getItem(MISSING_VALUE_DECISION_STORAGE_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : {};
    return parsedValue && typeof parsedValue === "object"
      ? (parsedValue as MissingValueDecisionMap)
      : {};
  } catch {
    return {};
  }
};

export const writeMissingValueDecisions = (decisions: MissingValueDecisionMap) => {
  try {
    window.localStorage.setItem(MISSING_VALUE_DECISION_STORAGE_KEY, JSON.stringify(decisions));
  } catch {
    // Draft decisions remain usable for the current session if storage is unavailable.
  }
};

export const createMissingValueDecision = (
  strategy: MissingValueStrategy,
  customValue?: string,
): MissingValueDecision => ({
  strategy,
  customValue,
  updatedAt: new Date().toISOString(),
});

export const missingValueStrategyLabels: Record<MissingValueStrategy, string> = {
  leave_unchanged: "Leave blanks unchanged",
  layout_space: "Treat as layout/template space",
  remove_mostly_blank_rows: "Remove rows that are mostly blank",
  decide_per_column: "Decide per column",
  fill_mean: "Fill numeric blanks with mean",
  fill_median: "Fill numeric blanks with median",
  fill_zero: "Fill numeric blanks with zero",
  fill_mode: "Fill blanks with mode",
  fill_custom: "Fill with custom value",
  mark_unknown: 'Mark as "Unknown"',
  custom_date: "Fill with custom date",
  flag_for_review: "Flag for review",
};

export const worksheetMissingValueStrategies: MissingValueStrategy[] = [
  "leave_unchanged",
  "layout_space",
  "remove_mostly_blank_rows",
  "decide_per_column",
];

export const getColumnMissingValueStrategies = (
  column: SchemaColumn,
): MissingValueStrategy[] => {
  if (column.inferred_type === "numeric") {
    return ["leave_unchanged", "fill_mean", "fill_median", "fill_zero", "fill_custom"];
  }
  if (column.inferred_type === "date") {
    return ["leave_unchanged", "custom_date", "flag_for_review"];
  }
  return ["leave_unchanged", "fill_mode", "mark_unknown", "fill_custom"];
};

export const decisionNeedsCustomValue = (strategy?: MissingValueStrategy) =>
  strategy === "fill_custom" || strategy === "custom_date";

