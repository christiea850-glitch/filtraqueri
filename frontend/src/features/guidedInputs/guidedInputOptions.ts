import type { BusinessIntentInputType } from "../businessIntent";
import type { SchemaColumn } from "../dataset/datasetTypes";
import type { AnalyticsTaskInput } from "../tasks";
import type { GuidedInputOption } from "./guidedInputTypes";

export const guidedInputPrompts: Record<BusinessIntentInputType, string> = {
  metric: "Choose the number you want to measure.",
  dimension: "Choose the business category you want to inspect.",
  dateField: "Choose a date field if time matters.",
  timeRange: "Choose the time period for the question.",
  groupingField: "Choose what you want to group by.",
  comparisonField: "Choose what you want to compare.",
  entityField: "Choose the business entity this task is about.",
  threshold: "Choose the cutoff that should flag important records.",
  filterCondition: "Choose a future filter condition for narrowing the workflow.",
};

const staticOptions: Partial<Record<BusinessIntentInputType, string[]>> = {
  timeRange: ["last 30 days", "this quarter", "this year", "next month"],
  threshold: ["top 10", "above average", "below target", "30 days inactive"],
  filterCondition: ["active records only", "exclude blanks", "current year only"],
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

const columnMatchesInput = (column: SchemaColumn, inputType: BusinessIntentInputType) => {
  if (inputType === "metric") return column.inferred_type === "numeric";
  if (inputType === "dateField") return column.inferred_type === "date";
  if (inputType === "threshold" || inputType === "timeRange" || inputType === "filterCondition") {
    return false;
  }
  if (inputType === "comparisonField") {
    return column.inferred_type === "numeric" || column.inferred_type === "categorical";
  }
  return (
    column.inferred_type === "categorical" ||
    column.inferred_type === "text" ||
    column.inferred_type === "boolean"
  );
};

const optionFromColumn = (
  input: AnalyticsTaskInput,
  column: SchemaColumn,
): GuidedInputOption => ({
  id: `${input.id}:column:${normalize(column.name)}`,
  inputId: input.id,
  label: column.name,
  value: column.name,
  source: "dataset_schema",
  inputType: input.type,
  column,
  helperText: `${column.inferred_type} field from the active dataset schema.`,
});

const optionFromExample = (
  input: AnalyticsTaskInput,
  value: string,
): GuidedInputOption => ({
  id: `${input.id}:example:${normalize(value)}`,
  inputId: input.id,
  label: value,
  value,
  source: "task_example",
  inputType: input.type,
  helperText: "Example value from task metadata.",
});

const optionFromStaticChoice = (
  input: AnalyticsTaskInput,
  value: string,
): GuidedInputOption => ({
  id: `${input.id}:static:${normalize(value)}`,
  inputId: input.id,
  label: value,
  value,
  source: "static_choice",
  inputType: input.type,
  helperText: "Safe planning-only choice.",
});

export const listGuidedInputOptions = (
  input: AnalyticsTaskInput,
  datasetSchema: SchemaColumn[],
): GuidedInputOption[] => {
  const schemaOptions = datasetSchema
    .filter((column) => columnMatchesInput(column, input.type))
    .map((column) => optionFromColumn(input, column));
  const staticChoiceOptions = (staticOptions[input.type] || []).map((value) =>
    optionFromStaticChoice(input, value),
  );
  const exampleOptions = (input.exampleValues || []).map((value) => optionFromExample(input, value));
  const byValue = new Map<string, GuidedInputOption>();

  [...schemaOptions, ...staticChoiceOptions, ...exampleOptions].forEach((option) => {
    if (!byValue.has(option.value)) byValue.set(option.value, option);
  });

  return Array.from(byValue.values());
};
