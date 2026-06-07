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
  | "forward_fill"
  | "decide_later"
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
  forward_fill: "Fill with previous value",
  decide_later: "Decide later",
  flag_for_review: "Flag for review",
};

/**
 * C-7 user-facing short labels for the radio-card UI. These match the
 * product spec verbiage exactly and stay shorter than the longer descriptive
 * labels above (which other consumers may still rely on for verbose
 * display). Only strategies the radio UI surfaces are included here; falls
 * back to the long label when missing.
 */
export const missingValueStrategyShortLabels: Partial<Record<MissingValueStrategy, string>> = {
  leave_unchanged: "Keep blanks",
  fill_zero: "Replace with 0",
  fill_mean: "Replace with mean",
  fill_median: "Replace with median",
  fill_mode: "Replace with most common value",
  fill_custom: "Custom value",
  mark_unknown: 'Replace with "Unknown"',
  custom_date: "Custom date",
  forward_fill: "Use previous value",
  decide_later: "Decide later",
  layout_space: "Treat as layout space",
  remove_mostly_blank_rows: "Remove mostly-blank rows",
  decide_per_column: "Customize per column",
};

/**
 * C-7 short helper text shown under each radio choice — gives the user a
 * one-line explanation of what the strategy means without re-using the
 * verbose phrasing above.
 */
export const missingValueStrategyHelpers: Partial<Record<MissingValueStrategy, string>> = {
  leave_unchanged: "Blanks stay blank.",
  fill_zero: "Treats blanks as zero.",
  fill_mean: "Uses the column average.",
  fill_median: "Uses the column midpoint.",
  fill_mode: "Uses the value that appears most often.",
  fill_custom: "You provide the value at Apply.",
  mark_unknown: 'Inserts the text "Unknown".',
  custom_date: "You pick a date at Apply.",
  forward_fill: "Reuses the previous non-blank value.",
  decide_later: "Skip for now; revisit before Apply.",
  layout_space: "Marks blanks as deliberate layout gaps.",
  remove_mostly_blank_rows: "Drops rows where most cells are blank.",
  decide_per_column: "Override the worksheet choice column-by-column.",
};

export const worksheetMissingValueStrategies: MissingValueStrategy[] = [
  "leave_unchanged",
  "layout_space",
  "remove_mostly_blank_rows",
  "decide_per_column",
];

/**
 * C-7 type-aware per-column strategy sets. The order is the visual order in
 * the radio-card UI; "Keep blanks" is always first (safe default), the most
 * common fill choices follow, and "Custom value" closes the list. Date
 * columns offer "Use previous value" (forward_fill) instead of the
 * statistical fills that don't apply. Unknown / non-inferred columns get
 * the safe-generic set with "Decide later" so the user can defer.
 */
export const getColumnMissingValueStrategies = (
  column: SchemaColumn,
): MissingValueStrategy[] => {
  if (column.inferred_type === "numeric") {
    return ["leave_unchanged", "fill_zero", "fill_mean", "fill_median", "fill_custom"];
  }
  if (column.inferred_type === "date") {
    return ["leave_unchanged", "forward_fill", "custom_date"];
  }
  if (column.inferred_type === "text" || column.inferred_type === "categorical") {
    return ["leave_unchanged", "mark_unknown", "fill_mode", "fill_custom"];
  }
  // Safe generic fallback when the column type is unknown / not inferred.
  return ["leave_unchanged", "fill_custom", "decide_later"];
};

export const decisionNeedsCustomValue = (strategy?: MissingValueStrategy) =>
  strategy === "fill_custom" || strategy === "custom_date";

