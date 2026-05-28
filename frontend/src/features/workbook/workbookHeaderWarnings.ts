import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import { getDatasetActiveWorksheet } from "./workbookMetadata";

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

const formatCandidateList = (candidates: string[]) =>
  candidates.length <= 2
    ? candidates.join(", ")
    : `${candidates.slice(0, 2).join(", ")} +${candidates.length - 2}`;

export const getStructuralColumnNotice = (dataset: DatasetMetadata | null) => {
  const candidates = getDatasetActiveWorksheet(dataset)?.normalization.structuralColumnCandidates || [];
  const uniqueCandidates = Array.from(
    new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)),
  );

  if (uniqueCandidates.length === 0) return null;

  const candidateList = formatCandidateList(uniqueCandidates);
  if (uniqueCandidates.length === 1) {
    return `Possible structural column detected: ${candidateList}. This column may come from a data dictionary row and may not be part of the business data. Review before using it in filters, joins, SQL, or report recipes.`;
  }

  return `Possible structural columns detected: ${candidateList}. These columns may come from a data dictionary row and may not be part of the business data. Review before using them in filters, joins, SQL, or report recipes.`;
};
