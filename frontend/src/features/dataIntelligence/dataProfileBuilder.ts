import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import { getWorkbookMetadata } from "../workbook";
import type {
  DataProfileColumnTypeSummary,
  DataProfileFieldSignal,
  DataProfileReport,
  DataProfileShape,
} from "./dataProfileTypes";

const normalizeName = (name: string) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

const isPossibleIdField = (column: SchemaColumn) => {
  const name = normalizeName(column.name);
  return (
    name === "id" ||
    name.endsWith("_id") ||
    name.includes("uuid") ||
    name.includes("identifier") ||
    name.includes("code")
  );
};

const isPossibleMetricField = (column: SchemaColumn) => {
  const name = normalizeName(column.name);
  const metricTerms = [
    "amount",
    "cost",
    "count",
    "margin",
    "metric",
    "price",
    "profit",
    "quantity",
    "rate",
    "revenue",
    "sales",
    "score",
    "total",
    "value",
  ];

  return column.inferred_type === "numeric" && metricTerms.some((term) => name.includes(term));
};

const isPossibleDimensionField = (column: SchemaColumn) =>
  column.inferred_type === "categorical" ||
  column.inferred_type === "text" ||
  column.inferred_type === "boolean";

const buildFieldSignal = (
  column: SchemaColumn,
  reasons: string[],
  confidence: DataProfileFieldSignal["confidence"] = "moderate",
): DataProfileFieldSignal => ({
  name: column.name,
  inferredType: column.inferred_type,
  confidence,
  reasons,
});

const countColumnTypes = (schema: SchemaColumn[]): DataProfileColumnTypeSummary =>
  schema.reduce<DataProfileColumnTypeSummary>(
    (summary, column) => {
      const type = column.inferred_type && column.inferred_type in summary ? column.inferred_type : "unknown";
      summary[type] += 1;
      return summary;
    },
    {
      text: 0,
      numeric: 0,
      date: 0,
      boolean: 0,
      categorical: 0,
      unknown: 0,
    },
  );

const buildShape = (dataset: DatasetMetadata): DataProfileShape => {
  const workbookMetadata = getWorkbookMetadata(dataset);
  const worksheetCount = Array.isArray(workbookMetadata?.worksheets) ? workbookMetadata.worksheets.length : 0;
  const rowCount = Number.isFinite(dataset.row_count) ? dataset.row_count : 0;
  const columnCount = Number.isFinite(dataset.column_count) ? dataset.column_count : 0;

  if (worksheetCount > 1) {
    return {
      rowCount,
      columnCount,
      worksheetCount,
      shapeLabel: "workbook",
    };
  }
  if (rowCount === 0 || columnCount === 0) {
    return {
      rowCount,
      columnCount,
      worksheetCount,
      shapeLabel: "empty",
    };
  }
  if (columnCount >= 40) {
    return {
      rowCount,
      columnCount,
      worksheetCount,
      shapeLabel: "wide_table",
    };
  }
  if (rowCount >= 100000) {
    return {
      rowCount,
      columnCount,
      worksheetCount,
      shapeLabel: "large_table",
    };
  }

  return {
    rowCount,
    columnCount,
    worksheetCount,
    shapeLabel: "small_table",
  };
};

const buildHumanSummary = (profile: Pick<DataProfileReport, "shape" | "workbookRelationshipContext">) => {
  if (profile.workbookRelationshipContext.hasWorkbookContext) {
    return "FiltraQueri detected this as a workbook with possible related sheets.";
  }
  if (profile.shape.shapeLabel === "large_table") {
    return "FiltraQueri detected this as a large tabular dataset suited to filtering and grouping.";
  }
  if (profile.shape.shapeLabel === "wide_table") {
    return "FiltraQueri detected this as a wide table with many fields to inspect.";
  }
  if (profile.shape.shapeLabel === "empty") {
    return "FiltraQueri needs more populated data before it can profile this dataset.";
  }
  return "FiltraQueri detected this as a tabular dataset for future filtering, grouping, and summaries.";
};

export const buildDataProfile = (dataset: DatasetMetadata | null): DataProfileReport | null => {
  if (!dataset) return null;

  const schema = Array.isArray(dataset.schema) ? dataset.schema : [];
  const workbookMetadata = getWorkbookMetadata(dataset);
  const shape = buildShape(dataset);
  const detectedColumnTypes = countColumnTypes(schema);
  const numericFields = schema
    .filter((column) => column.inferred_type === "numeric")
    .map((column) => buildFieldSignal(column, ["Column is inferred as numeric."], "high"));
  const categoricalFields = schema
    .filter((column) => column.inferred_type === "categorical" || column.inferred_type === "boolean")
    .map((column) => buildFieldSignal(column, ["Column has categorical or boolean profile."], "high"));
  const dateTimeFields = schema
    .filter((column) => column.inferred_type === "date")
    .map((column) => buildFieldSignal(column, ["Column is inferred as date/time."], "high"));
  const possibleIdFields = schema
    .filter(isPossibleIdField)
    .map((column) =>
      buildFieldSignal(
        column,
        ["Column name looks like an identifier.", "Identifier fields may help relationship planning."],
        (column.unique_count || 0) > (dataset.row_count || 0) * 0.75 ? "high" : "moderate",
      ),
    );
  const possibleMetrics = schema
    .filter((column) => column.inferred_type === "numeric")
    .map((column) =>
      buildFieldSignal(
        column,
        isPossibleMetricField(column)
          ? ["Numeric column name matches common metric language."]
          : ["Numeric columns can be candidate metrics."],
        isPossibleMetricField(column) ? "high" : "moderate",
      ),
    );
  const possibleDimensions = schema
    .filter(isPossibleDimensionField)
    .map((column) =>
      buildFieldSignal(
        column,
        ["Categorical, text, or boolean columns can segment future results."],
        (column.unique_count || 0) <= Math.max(50, (dataset.row_count || 0) * 0.25) ? "high" : "moderate",
      ),
    );
  const workbookRelationshipContext = {
    hasWorkbookContext: Boolean(workbookMetadata && (workbookMetadata.worksheets || []).length > 1),
    worksheetCount: workbookMetadata?.worksheets?.length || 0,
    relationshipCandidateCount: workbookMetadata?.relationshipCandidates?.length || 0,
    acceptedRelationshipCount: workbookMetadata?.acceptedRelationshipContracts?.length || 0,
    summary: workbookMetadata
      ? `${workbookMetadata.worksheets?.length || 0} worksheet${(workbookMetadata.worksheets?.length || 0) === 1 ? "" : "s"} with ${workbookMetadata.relationshipCandidates?.length || 0} relationship candidate${(workbookMetadata.relationshipCandidates?.length || 0) === 1 ? "" : "s"}.`
      : "Single-table context; no workbook relationship metadata is present.",
  };
  const timeSeriesReadiness = {
    ready: dateTimeFields.length > 0 && possibleMetrics.length > 0,
    dateFieldCount: dateTimeFields.length,
    metricFieldCount: possibleMetrics.length,
    candidateDateFields: dateTimeFields.map((field) => field.name),
    summary:
      dateTimeFields.length > 0 && possibleMetrics.length > 0
        ? "Dataset has date/time and numeric fields for future trend or forecasting workflows."
        : "Future trend or forecasting workflows need at least one date/time field and one metric.",
  };
  const statisticalReadiness = {
    ready: possibleMetrics.length >= 2 || (possibleMetrics.length >= 1 && possibleDimensions.length >= 1),
    numericFieldCount: possibleMetrics.length,
    categoricalFieldCount: possibleDimensions.length,
    candidateMetricFields: possibleMetrics.map((field) => field.name),
    summary:
      possibleMetrics.length >= 2
        ? "Dataset has multiple numeric fields for future correlation or statistical workflows."
        : "Future statistical workflows may need more numeric metrics.",
  };
  const profileBase = {
    datasetId: dataset.dataset_id,
    datasetName: dataset.original_filename,
    shape,
    detectedColumnTypes,
    numericFields,
    categoricalFields,
    dateTimeFields,
    possibleIdFields,
    possibleMetrics,
    possibleDimensions,
    workbookRelationshipContext,
    timeSeriesReadiness,
    statisticalReadiness,
    analystSummary: `${shape.shapeLabel.replace(/_/g, " ")}; ${possibleMetrics.length} metric candidate${possibleMetrics.length === 1 ? "" : "s"}, ${possibleDimensions.length} dimension candidate${possibleDimensions.length === 1 ? "" : "s"}, ${dateTimeFields.length} date/time field${dateTimeFields.length === 1 ? "" : "s"}.`,
  };

  return {
    ...profileBase,
    humanSummary: buildHumanSummary(profileBase),
  };
};
