import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { AnalysisScopeSelection, WorksheetMetadata } from "../../workbook";
import type { BusinessIntent } from "./businessIntentGrounding";
import type { BusinessSqlMeasureKind } from "./businessSqlQueryPlan";
import { evaluateBusinessSqlMeasureCompatibility } from "./businessSqlMeasureCompatibility";

export type BusinessSqlMeasureAmbiguityOption = {
  optionId: string;
  measureKind: BusinessSqlMeasureKind;
  tableName: string;
  fieldName: string | null;
  fieldInferredType: SchemaColumn["inferred_type"] | null;
  label: string;
  evidence: string;
};

export type BusinessSqlMeasureAmbiguity = {
  ambiguityId: string;
  questionExcerpt: string;
  prompt: string;
  groupingTableName: string;
  groupingFieldName: string;
  requestedDirection: "asc" | "desc";
  rowLimit: number | null;
  options: BusinessSqlMeasureAmbiguityOption[];
};

export type BusinessSqlMeasureClarificationDecision = {
  ambiguityId: string;
  chosenOptionId: string;
  presentedOptionIds: string[];
};

export type ResolveBusinessSqlMeasureAmbiguityInput = {
  ambiguity: BusinessSqlMeasureAmbiguity;
  chosenOptionId: string;
  originalIntent: BusinessIntent;
};

export type ResolveBusinessSqlMeasureAmbiguityResult =
  | {
      resolved: true;
      intent: BusinessIntent;
      decision: BusinessSqlMeasureClarificationDecision;
      option: BusinessSqlMeasureAmbiguityOption;
    }
  | {
      resolved: false;
      intent: BusinessIntent;
      decision: null;
      option: null;
    };

type WorksheetInput = Pick<
  WorksheetMetadata,
  "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"
>;

export type DetectBusinessSqlMeasureAmbiguityInput = {
  prompt: string;
  intent: BusinessIntent;
  worksheets: readonly WorksheetInput[];
  appliedScopeSelections: readonly AnalysisScopeSelection[];
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactId = (value: string): string =>
  normalize(value).replace(/\s+/g, "-") || "unknown";

const singularize = (value: string): string => {
  const normalized = normalize(value);
  if (normalized.endsWith("ies")) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("ses")) return normalized.slice(0, -2);
  if (normalized.endsWith("s") && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

const namesMatch = (left: string | null | undefined, right: string | null | undefined): boolean => {
  const a = normalize(left || "");
  const b = normalize(right || "");
  if (!a || !b) return false;
  return a === b || singularize(a) === singularize(b);
};

const scopedWorksheets = (
  worksheets: readonly WorksheetInput[],
  scope: readonly AnalysisScopeSelection[],
): WorksheetInput[] => {
  if (scope.length === 0) return [];
  const scopeIds = new Set(scope.map((selection) => selection.worksheetId));
  const tables = new Set(
    scope
      .map((selection) => selection.tableName || selection.originalTableName || "")
      .map(normalize)
      .filter(Boolean),
  );
  return worksheets.filter(
    (worksheet) =>
      scopeIds.has(worksheet.worksheetId) || tables.has(normalize(worksheet.tableName)),
  );
};

const hasOrderingWithoutMeasure = (prompt: string, intent: BusinessIntent): boolean => {
  const text = normalize(prompt);
  return (
    /\b(top|highest|bottom|lowest)\b/.test(text) &&
    intent.metrics.length === 0 &&
    !intent.analysisPath
  );
};

const requestedDirection = (prompt: string): "asc" | "desc" =>
  /\b(bottom|lowest)\b/i.test(prompt) && !/\b(top|highest)\b/i.test(prompt) ? "asc" : "desc";

const groupingColumnFor = (
  intent: BusinessIntent,
  worksheets: readonly WorksheetInput[],
): { worksheet: WorksheetInput; column: SchemaColumn } | null => {
  for (const grouping of intent.grouping) {
    for (const worksheet of worksheets) {
      const column = worksheet.schema.find((candidate) => namesMatch(grouping, candidate.name));
      if (column) return { worksheet, column };
    }
  }
  for (const entity of intent.entities) {
    for (const worksheet of worksheets) {
      const column = worksheet.schema.find((candidate) => namesMatch(entity, candidate.name));
      if (column) return { worksheet, column };
    }
  }
  return null;
};

const optionLabel = (
  kind: BusinessSqlMeasureKind,
  fieldName: string | null,
  tableName: string,
): string => {
  if (kind === "count_entities") {
    const entityLabel = singularize(tableName).replace(/_/g, " ");
    return `${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} count`;
  }
  const field = (fieldName || "value").replace(/_/g, " ");
  if (kind === "sum") return `Total ${field}`;
  if (kind === "average") return `Average ${field}`;
  if (kind === "minimum") return `Minimum ${field}`;
  if (kind === "maximum") return `Maximum ${field}`;
  return field;
};

const option = ({
  kind,
  tableName,
  fieldName,
  fieldInferredType,
  evidence,
}: {
  kind: BusinessSqlMeasureKind;
  tableName: string;
  fieldName: string | null;
  fieldInferredType: SchemaColumn["inferred_type"] | null;
  evidence: string;
}): BusinessSqlMeasureAmbiguityOption => ({
  optionId: `measure-option:${compactId(tableName)}:${compactId(kind)}:${compactId(fieldName || "rows")}`,
  measureKind: kind,
  tableName,
  fieldName,
  fieldInferredType,
  label: optionLabel(kind, fieldName, tableName),
  evidence,
});

const measureCompatible = (
  kind: BusinessSqlMeasureKind,
  fieldName: string | null,
  fieldInferredType: SchemaColumn["inferred_type"] | null,
): boolean =>
  evaluateBusinessSqlMeasureCompatibility({
    measure: {
      kind,
      field: fieldName || undefined,
      fieldInferredType: fieldInferredType || undefined,
    },
    fieldInferredType,
  }).compatible;

const candidateOptionsFor = (
  worksheet: WorksheetInput,
): BusinessSqlMeasureAmbiguityOption[] => {
  const options: BusinessSqlMeasureAmbiguityOption[] = [
    option({
      kind: "count_entities",
      tableName: worksheet.tableName,
      fieldName: null,
      fieldInferredType: null,
      evidence: `Counts rows from grounded table ${worksheet.tableName}.`,
    }),
  ];

  const numericColumns = worksheet.schema
    .filter((column) => column.inferred_type === "numeric")
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const column of numericColumns) {
    for (const kind of ["sum", "average"] as const) {
      if (!measureCompatible(kind, column.name, column.inferred_type)) continue;
      options.push(
        option({
          kind,
          tableName: worksheet.tableName,
          fieldName: column.name,
          fieldInferredType: column.inferred_type,
          evidence: `${column.name} is a numeric column in ${worksheet.tableName}.`,
        }),
      );
    }
  }

  const seen = new Set<string>();
  return options.filter((candidate) => {
    if (seen.has(candidate.optionId)) return false;
    seen.add(candidate.optionId);
    return true;
  });
};

export function detectBusinessSqlMeasureAmbiguity({
  prompt,
  intent,
  worksheets,
  appliedScopeSelections,
}: DetectBusinessSqlMeasureAmbiguityInput): BusinessSqlMeasureAmbiguity | null {
  if (!hasOrderingWithoutMeasure(prompt, intent)) return null;
  const scoped = scopedWorksheets(worksheets, appliedScopeSelections);
  const grouping = groupingColumnFor(intent, scoped);
  if (!grouping) return null;

  const options = candidateOptionsFor(grouping.worksheet);
  if (options.length < 2) return null;

  const groupingId = `${grouping.worksheet.tableName}:${grouping.column.name}`;
  return {
    ambiguityId: `measure-ambiguity:${compactId(groupingId)}:${compactId(prompt)}`,
    questionExcerpt: prompt.trim().slice(0, 140),
    prompt: `What should "${grouping.column.name}" be ranked by?`,
    groupingTableName: grouping.worksheet.tableName,
    groupingFieldName: grouping.column.name,
    requestedDirection: requestedDirection(prompt),
    rowLimit: null,
    options,
  };
}

export function resolveBusinessSqlMeasureAmbiguity({
  ambiguity,
  chosenOptionId,
  originalIntent,
}: ResolveBusinessSqlMeasureAmbiguityInput): ResolveBusinessSqlMeasureAmbiguityResult {
  const option = ambiguity.options.find((candidate) => candidate.optionId === chosenOptionId) || null;
  if (!option) {
    return {
      resolved: false,
      intent: originalIntent,
      decision: null,
      option: null,
    };
  }

  const measureName = option.fieldName || option.tableName;
  const metricName = `${option.measureKind}_${measureName.replace(/\s+/g, "_")}`;
  const intent: BusinessIntent = {
    ...originalIntent,
    metrics: [metricName],
    grouping: [ambiguity.groupingFieldName],
    analysisPath: {
      aggregation:
        option.measureKind === "average"
          ? "average"
          : option.measureKind === "minimum"
            ? "minimum"
            : option.measureKind === "maximum"
              ? "maximum"
              : "sum",
      measureField: measureName,
      groupingField: ambiguity.groupingFieldName,
      orderDirection: ambiguity.requestedDirection === "asc" ? "ascending" : "descending",
      rowLimit: ambiguity.rowLimit,
    },
  };

  return {
    resolved: true,
    intent,
    decision: {
      ambiguityId: ambiguity.ambiguityId,
      chosenOptionId: option.optionId,
      presentedOptionIds: ambiguity.options.map((candidate) => candidate.optionId),
    },
    option,
  };
}
