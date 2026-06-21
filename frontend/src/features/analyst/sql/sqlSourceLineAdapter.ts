import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlWorkspaceTabSource } from "./sqlTabsTypes";

export type SqlSourceLineOption = {
  id: string;
  worksheetLabel: string;
  sourceKindLabel: "Original" | "Cleaned";
  tableName: string;
  isCurrent: boolean;
  source: SqlWorkspaceTabSource;
};

export type SqlSourceLineModel = {
  text: string;
  emptyScopeCopy: string;
  scopeChipLabel: string;
  options: SqlSourceLineOption[];
  noCleanedCopyHelper: string | null;
  noToggleContext: true;
  noEditorMutation: true;
  noRunQuery: true;
  noBackendCall: true;
};

export type CreateSqlSourceLineModelInput = {
  dataset: DatasetMetadata | null;
  workbookLabel?: string | null;
  activeSourceLabel?: string | null;
  activeSourceTableLabel?: string | null;
  activeSourceKindLabel?: string | null;
  appliedScopeSummary?: string | null;
  appliedScopeCount: number;
};

const sourceKind = (value?: string | null): "Original" | "Cleaned" =>
  value === "Cleaned" ? "Cleaned" : "Original";

const worksheetLabel = (value?: string | null, fallback?: string | null): string =>
  value?.trim() || fallback?.trim() || "Active source";

const optionId = (worksheetId: string, sourceType: SqlWorkspaceTabSource["sourceType"]) =>
  `${worksheetId}:${sourceType}`;

export const createSqlSourceLineModel = ({
  dataset,
  workbookLabel,
  activeSourceLabel,
  activeSourceTableLabel,
  activeSourceKindLabel,
  appliedScopeSummary,
  appliedScopeCount,
}: CreateSqlSourceLineModelInput): SqlSourceLineModel => {
  const activeLabel = worksheetLabel(activeSourceLabel, activeSourceTableLabel);
  const activeKind = sourceKind(activeSourceKindLabel);
  const workbookPrefix = workbookLabel?.trim()
    ? `${workbookLabel.trim()} › ${activeLabel}`
    : activeSourceTableLabel?.trim() || activeLabel;
  const text = `Source for this tab: ${workbookPrefix} · ${activeKind}`;
  const workbook = dataset?.workbook_metadata;
  const activeTable = activeSourceTableLabel || "";

  const options: SqlSourceLineOption[] =
    workbook?.worksheets.flatMap((worksheet) => {
      const label = worksheet.displayName || worksheet.sheetName || worksheet.tableName;
      const cleanedCopy = workbook.cleanedWorkingCopies.find(
        (copy) => copy.sourceWorksheetId === worksheet.worksheetId,
      );
      const originalOption: SqlSourceLineOption = {
        id: optionId(worksheet.worksheetId, "original"),
        worksheetLabel: label,
        sourceKindLabel: "Original",
        tableName: worksheet.tableName,
        isCurrent: activeKind === "Original" && activeTable === worksheet.tableName,
        source: {
          title: label,
          worksheetId: worksheet.worksheetId,
          sourceType: "original",
          tableName: worksheet.tableName,
          originalTableName: worksheet.tableName,
          cleanedTableName: cleanedCopy?.cleanedTableName,
        },
      };
      const cleanedOption: SqlSourceLineOption | null = cleanedCopy?.cleanedTableName
        ? {
            id: optionId(worksheet.worksheetId, "cleaned_working_copy"),
            worksheetLabel: label,
            sourceKindLabel: "Cleaned",
            tableName: cleanedCopy.cleanedTableName,
            isCurrent: activeKind === "Cleaned" && activeTable === cleanedCopy.cleanedTableName,
            source: {
              title: label,
              worksheetId: worksheet.worksheetId,
              sourceType: "cleaned_working_copy",
              tableName: cleanedCopy.cleanedTableName,
              originalTableName: worksheet.tableName,
              cleanedTableName: cleanedCopy.cleanedTableName,
            },
          }
        : null;

      return cleanedOption ? [originalOption, cleanedOption] : [originalOption];
    }) || [];

  const currentWorksheet = workbook?.worksheets.find(
    (worksheet) => worksheet.tableName === activeTable,
  );
  const currentCleanedCopy = currentWorksheet
    ? workbook?.cleanedWorkingCopies.find((copy) => copy.sourceWorksheetId === currentWorksheet.worksheetId)
    : null;
  const emptyScopeCopy = `Using workbook default: ${activeLabel}. Choose worksheets only when this tab should use a narrower or different planning scope.`;
  const scopeChipLabel =
    appliedScopeCount > 0 && appliedScopeSummary
      ? `Applied scope · ${appliedScopeSummary}`
      : `Using workbook default · ${activeLabel}`;

  return {
    text,
    emptyScopeCopy,
    scopeChipLabel,
    options,
    noCleanedCopyHelper:
      currentWorksheet && !currentCleanedCopy
        ? "No cleaned working copy available for this worksheet."
        : null,
    noToggleContext: true,
    noEditorMutation: true,
    noRunQuery: true,
    noBackendCall: true,
  };
};
