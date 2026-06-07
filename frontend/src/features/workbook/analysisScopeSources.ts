import type {
  CleanedWorkingCopy,
  WorkbookMetadata,
  WorksheetMetadata,
} from "./workbookTypes";

export type AnalysisScopeSourceType = "original" | "cleaned_working_copy";

export type AnalysisScopeSelection = {
  worksheetId: string;
  sourceType: AnalysisScopeSourceType;
  tableName: string;
  originalTableName?: string;
  cleanedTableName?: string;
};

export type AnalysisScopeSourceOption = {
  sourceType: AnalysisScopeSourceType;
  tableName: string;
  label: "Original" | "Cleaned copy";
  isAvailable: boolean;
};

export const getCleanedCopyForWorksheet = (
  workbook: WorkbookMetadata | null | undefined,
  worksheetId: string,
): CleanedWorkingCopy | null =>
  workbook?.cleanedWorkingCopies.find((copy) => copy.sourceWorksheetId === worksheetId) || null;

export const getAnalysisScopeSourceOptions = (
  workbook: WorkbookMetadata | null | undefined,
  worksheet: Pick<WorksheetMetadata, "worksheetId" | "tableName">,
): AnalysisScopeSourceOption[] => {
  const cleanedCopy = getCleanedCopyForWorksheet(workbook, worksheet.worksheetId);

  return [
    {
      sourceType: "original",
      tableName: worksheet.tableName,
      label: "Original",
      isAvailable: true,
    },
    {
      sourceType: "cleaned_working_copy",
      tableName: cleanedCopy?.cleanedTableName || "",
      label: "Cleaned copy",
      isAvailable: Boolean(cleanedCopy?.cleanedTableName),
    },
  ];
};

export const createAnalysisScopeSelection = (
  workbook: WorkbookMetadata | null | undefined,
  worksheet: Pick<WorksheetMetadata, "worksheetId" | "tableName">,
  preferredSourceType?: AnalysisScopeSourceType,
): AnalysisScopeSelection => {
  const cleanedCopy = getCleanedCopyForWorksheet(workbook, worksheet.worksheetId);
  const activeCleanedSource =
    workbook?.activeAnalysisSource?.type === "cleaned_working_copy" &&
    workbook.activeAnalysisSource.worksheetId === worksheet.worksheetId &&
    Boolean(cleanedCopy?.cleanedTableName);
  const sourceType: AnalysisScopeSourceType =
    preferredSourceType === "cleaned_working_copy" && cleanedCopy?.cleanedTableName
      ? "cleaned_working_copy"
      : preferredSourceType === "original"
        ? "original"
        : activeCleanedSource
          ? "cleaned_working_copy"
          : "original";

  return {
    worksheetId: worksheet.worksheetId,
    sourceType,
    tableName:
      sourceType === "cleaned_working_copy" && cleanedCopy?.cleanedTableName
        ? cleanedCopy.cleanedTableName
        : worksheet.tableName,
    originalTableName: worksheet.tableName,
    cleanedTableName: cleanedCopy?.cleanedTableName,
  };
};

export const getAnalysisScopeSourceBadge = (
  selection: Pick<AnalysisScopeSelection, "sourceType" | "cleanedTableName">,
) => {
  if (selection.sourceType === "cleaned_working_copy") return "Using cleaned copy";
  if (selection.cleanedTableName) return "Cleaned copy available";
  return "Original";
};

