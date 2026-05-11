import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";

const quoteIdentifier = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

export const formatSqlColumn = (columnName: string) => quoteIdentifier(columnName);

export const formatSqlTable = (tableName: string) => quoteIdentifier(tableName);

export const getNumericColumns = (columns: SchemaColumn[]) =>
  columns.filter((column) => column.inferred_type === "numeric");

export const getCategoricalColumns = (columns: SchemaColumn[]) =>
  columns.filter((column) => column.inferred_type === "categorical" || column.inferred_type === "text");

export const getDateColumns = (columns: SchemaColumn[]) =>
  columns.filter((column) => column.inferred_type === "date");

export const getSortableColumns = (columns: SchemaColumn[]) =>
  columns.filter((column) => ["numeric", "date", "boolean", "categorical", "text"].includes(column.inferred_type));

export const getPrimaryDisplayColumns = (dataset: DatasetMetadata, count = 5) =>
  dataset.schema.slice(0, count).map((column) => column.name);

export const buildSelectList = (columnNames: string[]) =>
  columnNames.length > 0 ? columnNames.map(formatSqlColumn).join(",\n  ") : "*";

export const buildSampleValueHint = (column: SchemaColumn) => {
  const value = column.sample_values.find((sampleValue) => sampleValue !== null && sampleValue !== undefined);
  return value === undefined ? "'value'" : `'${String(value).replace(/'/g, "''")}'`;
};
