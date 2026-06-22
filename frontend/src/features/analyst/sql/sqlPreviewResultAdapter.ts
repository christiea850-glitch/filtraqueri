import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { WorkspaceExecutionResult } from "../../execution/workspaceExecutionTypes";
import type { AnalysisScopeSelection } from "../../workbook";
import type { SqlDialectId } from "../../sqlIntelligence";
import { detectBusinessIntent } from "./businessIntentGrounding";
import { classifySqlBusinessQuestion } from "./sqlBusinessQuestionShape";
import { formatSqlExecutionError } from "./sqlErrorFormatter";
import type { SqlTabSourceContext } from "./resolveSqlTabSourceContext";
import type { ExecutedQuestionSnapshot, SqlPreviewResult } from "./sqlTypes";

const uniqueDefined = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.map((value) => value?.trim() || "").filter(Boolean)));

const getSchemaColumnNames = (schema: SchemaColumn[] | null | undefined) =>
  (schema || []).map((column) => column.name);

const getAppliedScopeSchemaColumns = (
  dataset: DatasetMetadata | null,
  appliedScopeSelections: AnalysisScopeSelection[],
) =>
  appliedScopeSelections.flatMap((selection) => {
    const worksheet = dataset?.workbook_metadata?.worksheets.find(
      (candidate) =>
        candidate.worksheetId === selection.worksheetId ||
        candidate.tableName === selection.originalTableName ||
        candidate.tableName === selection.tableName,
    );

    return getSchemaColumnNames(worksheet?.schema);
  });

const getAvailableTableNames = (
  dataset: DatasetMetadata | null,
  activeTabSourceContext: SqlTabSourceContext,
  appliedScopeSelections: AnalysisScopeSelection[],
) =>
  uniqueDefined([
    dataset?.table_name,
    activeTabSourceContext.tableName,
    activeTabSourceContext.sourceTableName,
    activeTabSourceContext.originalTableName,
    activeTabSourceContext.cleanedTableName,
    ...appliedScopeSelections.map((selection) => selection.tableName),
    ...appliedScopeSelections.map((selection) => selection.originalTableName),
    ...appliedScopeSelections.map((selection) => selection.cleanedTableName),
    ...(dataset?.workbook_metadata?.worksheets.map((worksheet) => worksheet.tableName) || []),
    ...(dataset?.workbook_metadata?.cleanedWorkingCopies.map((copy) => copy.cleanedTableName) || []),
  ]);

const getAvailableColumnNames = (
  dataset: DatasetMetadata | null,
  activeTabSourceContext: SqlTabSourceContext,
  appliedScopeSelections: AnalysisScopeSelection[],
) =>
  uniqueDefined([
    ...getSchemaColumnNames(dataset?.schema),
    ...getSchemaColumnNames(activeTabSourceContext.schema),
    ...getAppliedScopeSchemaColumns(dataset, appliedScopeSelections),
  ]);

export function createExecutedQuestionSnapshot({
  taskPrompt,
  sqlAtRun,
  ranAt,
  sourceLabel,
  sourceTableName,
  dataset,
}: {
  taskPrompt: string;
  sqlAtRun: string;
  ranAt: string;
  sourceLabel: string | null;
  sourceTableName: string | null;
  dataset: DatasetMetadata | null;
}): ExecutedQuestionSnapshot {
  const trimmedPrompt = taskPrompt.trim();

  return {
    taskPrompt,
    ...(trimmedPrompt ? { detectedIntent: detectBusinessIntent(trimmedPrompt) } : {}),
    ...(trimmedPrompt
      ? {
          questionShape: classifySqlBusinessQuestion({
            prompt: trimmedPrompt,
            dataset,
          }),
        }
      : {}),
    sqlAtRun,
    ranAt,
    sourceLabel,
    sourceTableName,
  };
}

export function createSqlSuccessPreviewResult(
  executionResult: WorkspaceExecutionResult,
  executedQuestion?: ExecutedQuestionSnapshot,
): SqlPreviewResult {
  return {
    columns: executionResult.outputVisibleColumns,
    rows: executionResult.outputRows,
    message: executionResult.sql?.message || "Query completed.",
    errorInsight: null,
    ...(executedQuestion ? { executedQuestion: { ...executedQuestion } } : {}),
  };
}

export function createSqlErrorPreviewResult({
  error,
  sqlText,
  selectedDialect,
  dataset,
  activeTabSourceContext,
  appliedScopeSelections,
  executedQuestion,
}: {
  error: unknown;
  sqlText: string;
  selectedDialect?: SqlDialectId;
  dataset: DatasetMetadata | null;
  activeTabSourceContext: SqlTabSourceContext;
  appliedScopeSelections: AnalysisScopeSelection[];
  executedQuestion?: ExecutedQuestionSnapshot;
}): SqlPreviewResult {
  const rawMessage = error instanceof Error ? error.message : "Query failed.";
  const errorInsight = formatSqlExecutionError({
    rawMessage,
    sqlText,
    selectedDialect,
    activeTable: activeTabSourceContext.tableName || dataset?.table_name,
    availableTables: getAvailableTableNames(dataset, activeTabSourceContext, appliedScopeSelections),
    availableColumns: getAvailableColumnNames(dataset, activeTabSourceContext, appliedScopeSelections),
    appliedScopeTables: uniqueDefined(
      appliedScopeSelections.map((selection) => selection.tableName),
    ),
  });

  return {
    columns: [],
    rows: [],
    message: errorInsight.title,
    errorInsight,
    ...(executedQuestion ? { executedQuestion: { ...executedQuestion } } : {}),
  };
}
