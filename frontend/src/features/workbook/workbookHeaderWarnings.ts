import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";

export const WORKBOOK_HEADER_WARNING_COPY =
  "Possible header issue detected. Some column names look like data types, so FiltraQueri may be using the wrong row as headers. Review the worksheet before trusting generated SQL or report recipes.";

const dataTypeHeaderPattern =
  /^(data\s*type|char\s*\(\s*\d+\s*\)|varchar\s*\(\s*\d+\s*\)|date|number|int|integer|decimal|float|double|boolean|text)(?:_\d+)?$/i;

const likelyBusinessFieldPattern =
  /(^|[_\s-])([a-z]+_)?id$|^(first|last)[_\s-]name$|^move[_\s-](in|out)[_\s-]date$|^(email|phone|name|date)$/i;

const countSuspiciousHeaders = (schema: SchemaColumn[]) =>
  schema.filter((column) => dataTypeHeaderPattern.test(column.name.trim())).length;

const countBusinessFieldSamples = (schema: SchemaColumn[]) =>
  schema.reduce((count, column) => {
    const matchingSamples = column.sample_values.filter((sampleValue) =>
      likelyBusinessFieldPattern.test(String(sampleValue ?? "").trim()),
    );
    return count + matchingSamples.length;
  }, 0);

export const hasSuspiciousWorkbookHeaders = (dataset: DatasetMetadata | null) => {
  if (!dataset?.workbook_metadata || dataset.schema.length < 3) return false;

  const suspiciousHeaderCount = countSuspiciousHeaders(dataset.schema);
  const likelyBusinessSampleCount = countBusinessFieldSamples(dataset.schema);
  const suspiciousHeaderThreshold = Math.max(2, Math.ceil(dataset.schema.length * 0.35));

  return (
    suspiciousHeaderCount >= suspiciousHeaderThreshold &&
    likelyBusinessSampleCount >= 2
  );
};
