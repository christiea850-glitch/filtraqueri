import type { DatasetMetadata } from "../../dataset/datasetTypes";
import {
  createAnalysisScopeSelection,
  type AnalysisScopeSelection,
  type AnalysisScopeSourceType,
} from "../../workbook";

export type SqlWorksheetScopeOption = {
  worksheetId: string;
  label: string;
  originalTableName: string;
  cleanedTableName: string | null;
  isSelected: boolean;
  selectedSourceType: AnalysisScopeSourceType;
  sourceLabel: "Original worksheet" | "Cleaned working copy";
  tableName: string;
  cleanedCopyAvailable: boolean;
};

export type SqlWorksheetScopeModel = {
  title: "Manage worksheet scope";
  helperCopy: string;
  options: SqlWorksheetScopeOption[];
  emptyCopy: string;
  appliedLabel: string;
  pendingLabel: string | null;
  applyLabel: "Apply worksheet scope";
  cancelLabel: "Cancel";
  noToggleContext: true;
  noActiveSourceChange: true;
  noEditorMutation: true;
  noRunQuery: true;
  noBackendCall: true;
};

export type CreateSqlWorksheetScopeModelInput = {
  dataset: DatasetMetadata | null;
  selectedScopeSelections: readonly AnalysisScopeSelection[];
  appliedScopeSummary?: string | null;
  appliedScopeCount: number;
  activeSourceLabel?: string | null;
};

const normalize = (value: string) => value.trim().toLowerCase();

const selectionMatchesWorksheet = (
  selection: AnalysisScopeSelection,
  worksheetId: string,
) => selection.worksheetId === worksheetId;

const worksheetLabel = (
  worksheet: NonNullable<DatasetMetadata["workbook_metadata"]>["worksheets"][number],
) => worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const createSelection = (
  dataset: DatasetMetadata | null,
  worksheetId: string,
  sourceType?: AnalysisScopeSourceType,
): AnalysisScopeSelection | null => {
  const workbook = dataset?.workbook_metadata;
  const worksheet = workbook?.worksheets.find((item) => item.worksheetId === worksheetId);
  if (!worksheet) return null;
  return createAnalysisScopeSelection(workbook, worksheet, sourceType);
};

export const createSqlWorksheetScopeModel = ({
  dataset,
  selectedScopeSelections,
  appliedScopeSummary,
  appliedScopeCount,
  activeSourceLabel,
}: CreateSqlWorksheetScopeModelInput): SqlWorksheetScopeModel => {
  const workbook = dataset?.workbook_metadata;
  const activeLabel = activeSourceLabel?.trim() || dataset?.table_name || "active source";
  const options: SqlWorksheetScopeOption[] =
    workbook?.worksheets.map((worksheet) => {
      const selected = selectedScopeSelections.find((selection) =>
        selectionMatchesWorksheet(selection, worksheet.worksheetId),
      );
      const cleanedTableName =
        workbook.cleanedWorkingCopies.find(
          (copy) => copy.sourceWorksheetId === worksheet.worksheetId,
        )?.cleanedTableName || null;
      const selectedSourceType = selected?.sourceType || "original";
      const selectedCleaned =
        selectedSourceType === "cleaned_working_copy" && Boolean(cleanedTableName);

      return {
        worksheetId: worksheet.worksheetId,
        label: worksheetLabel(worksheet),
        originalTableName: worksheet.tableName,
        cleanedTableName,
        isSelected: Boolean(selected),
        selectedSourceType: selectedCleaned ? "cleaned_working_copy" : "original",
        sourceLabel: selectedCleaned ? "Cleaned working copy" : "Original worksheet",
        tableName: selectedCleaned ? cleanedTableName || worksheet.tableName : worksheet.tableName,
        cleanedCopyAvailable: Boolean(cleanedTableName),
      };
    }) || [];

  return {
    title: "Manage worksheet scope",
    helperCopy:
      "Choose the worksheets FiltraQueri should use as planning context for this SQL tab. This does not change the executable source.",
    options,
    emptyCopy: `Using workbook default: ${activeLabel}. Choose worksheets only when this tab should use a narrower or different planning scope.`,
    appliedLabel:
      appliedScopeCount > 0 && appliedScopeSummary
        ? `Applied scope · ${appliedScopeSummary}`
        : `Using workbook default · ${activeLabel}`,
    pendingLabel:
      selectedScopeSelections.length > 0 &&
      !(appliedScopeCount > 0 && appliedScopeSummary)
        ? `${selectedScopeSelections.length} selected, not applied`
        : null,
    applyLabel: "Apply worksheet scope",
    cancelLabel: "Cancel",
    noToggleContext: true,
    noActiveSourceChange: true,
    noEditorMutation: true,
    noRunQuery: true,
    noBackendCall: true,
  };
};

export const toggleSqlWorksheetScopeSelection = ({
  dataset,
  selectedScopeSelections,
  worksheetId,
}: {
  dataset: DatasetMetadata | null;
  selectedScopeSelections: readonly AnalysisScopeSelection[];
  worksheetId: string;
}): AnalysisScopeSelection[] => {
  const isSelected = selectedScopeSelections.some((selection) =>
    selectionMatchesWorksheet(selection, worksheetId),
  );
  if (isSelected) {
    return selectedScopeSelections.filter(
      (selection) => !selectionMatchesWorksheet(selection, worksheetId),
    );
  }

  const selection = createSelection(dataset, worksheetId);
  return selection ? [...selectedScopeSelections, selection] : [...selectedScopeSelections];
};

export const setSqlWorksheetScopeSourceType = ({
  dataset,
  selectedScopeSelections,
  worksheetId,
  sourceType,
}: {
  dataset: DatasetMetadata | null;
  selectedScopeSelections: readonly AnalysisScopeSelection[];
  worksheetId: string;
  sourceType: AnalysisScopeSourceType;
}): AnalysisScopeSelection[] => {
  const nextSelection = createSelection(dataset, worksheetId, sourceType);
  if (!nextSelection) return [...selectedScopeSelections];

  const existingIndex = selectedScopeSelections.findIndex((selection) =>
    selectionMatchesWorksheet(selection, worksheetId),
  );
  if (existingIndex === -1) return [...selectedScopeSelections, nextSelection];

  return selectedScopeSelections.map((selection, index) =>
    index === existingIndex ? nextSelection : selection,
  );
};

export const hasSameSqlWorksheetScopeSelections = (
  left: readonly AnalysisScopeSelection[],
  right: readonly AnalysisScopeSelection[],
) => {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(
    right.map((selection) =>
      [
        normalize(selection.worksheetId),
        selection.sourceType,
        normalize(selection.tableName),
      ].join(":"),
    ),
  );
  return left.every((selection) =>
    rightKeys.has(
      [
        normalize(selection.worksheetId),
        selection.sourceType,
        normalize(selection.tableName),
      ].join(":"),
    ),
  );
};
