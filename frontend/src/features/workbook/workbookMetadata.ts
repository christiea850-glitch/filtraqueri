import type {
  WorkbookIngestionProfile,
  WorkbookMetadata,
  WorksheetMetadata,
  WorksheetRelationshipCandidate,
} from "./workbookTypes";

export const WORKBOOK_METADATA_NORMALIZATION_VERSION = 1;

export const DEFAULT_WORKBOOK_INGESTION_PROFILE: WorkbookIngestionProfile = {
  maxWorksheets: 30,
  maxRowsPerWorksheetProfile: 5000,
  maxColumnsPerWorksheet: 250,
  maxRelationshipSampleRows: 1000,
  maxPreviewRows: 100,
  profilingStrategy: "sampled",
};

const nowIso = () => new Date().toISOString();

export const generateSafeWorksheetTableName = (
  sheetName: string,
  index = 0,
): string => {
  const normalizedName = sheetName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const safeName = normalizedName || `worksheet_${index + 1}`;

  return `ws_${index + 1}_${safeName}`;
};

export const normalizeWorksheetMetadata = (
  worksheet: Partial<WorksheetMetadata>,
  workbookId: string,
  index = 0,
): WorksheetMetadata => {
  const sheetName = worksheet.sheetName?.trim() || `Worksheet ${index + 1}`;
  const schema = Array.isArray(worksheet.schema) ? worksheet.schema : [];
  const columnNames = schema.map((column) => column.name);
  const normalizedAt = worksheet.normalization?.normalizedAt || nowIso();

  return {
    worksheetId: worksheet.worksheetId || `${workbookId}:worksheet:${index + 1}`,
    workbookId,
    sheetName,
    displayName: worksheet.displayName?.trim() || sheetName,
    tableName: worksheet.tableName || generateSafeWorksheetTableName(sheetName, index),
    originalIndex: worksheet.originalIndex ?? index,
    status: worksheet.status || (schema.length > 0 ? "ready" : "empty"),
    schema,
    rowCount: Math.max(0, worksheet.rowCount || 0),
    columnCount: Math.max(0, worksheet.columnCount || schema.length),
    visibleColumns: worksheet.visibleColumns || columnNames,
    hiddenColumns: worksheet.hiddenColumns || [],
    normalization: {
      version: worksheet.normalization?.version || WORKBOOK_METADATA_NORMALIZATION_VERSION,
      normalizedAt,
      headerRowIndex: worksheet.normalization?.headerRowIndex ?? null,
      duplicateColumnCount: Math.max(0, worksheet.normalization?.duplicateColumnCount || 0),
      emptyColumnCount: Math.max(0, worksheet.normalization?.emptyColumnCount || 0),
      warnings: worksheet.normalization?.warnings || [],
    },
  };
};

export const normalizeWorkbookMetadata = (
  workbook: Partial<WorkbookMetadata>,
): WorkbookMetadata => {
  const workbookId = workbook.workbookId || "workbook-pending";
  const createdAt = workbook.createdAt || nowIso();
  const worksheets = (workbook.worksheets || []).map((worksheet, index) =>
    normalizeWorksheetMetadata(worksheet, workbookId, index),
  );
  const worksheetIds = worksheets.map((worksheet) => worksheet.worksheetId);
  const activeWorksheetId =
    workbook.activeWorksheetId && worksheetIds.includes(workbook.activeWorksheetId)
      ? workbook.activeWorksheetId
      : worksheetIds[0] || null;

  return {
    workbookId,
    workspaceId: workbook.workspaceId || null,
    name: workbook.name?.trim() || workbook.sourceFile?.originalFilename || "Untitled workbook",
    status: workbook.status || (worksheets.length > 0 ? "ready" : "pending"),
    sourceFile: {
      originalFilename: workbook.sourceFile?.originalFilename || "workbook.xlsx",
      storedPath: workbook.sourceFile?.storedPath || null,
      mimeType: workbook.sourceFile?.mimeType || null,
      byteSize: workbook.sourceFile?.byteSize ?? null,
      uploadedAt: workbook.sourceFile?.uploadedAt || createdAt,
    },
    worksheetIds,
    activeWorksheetId,
    worksheets,
    tableMappings: worksheets.map((worksheet) => ({
      sheetName: worksheet.sheetName,
      tableName: worksheet.tableName,
      originalIndex: worksheet.originalIndex,
    })),
    relationshipCandidates: workbook.relationshipCandidates || [],
    ingestionProfile: {
      ...DEFAULT_WORKBOOK_INGESTION_PROFILE,
      ...workbook.ingestionProfile,
    },
    normalization: {
      version: workbook.normalization?.version || WORKBOOK_METADATA_NORMALIZATION_VERSION,
      normalizedAt: workbook.normalization?.normalizedAt || nowIso(),
      status: workbook.normalization?.status || "normalized",
      warnings: workbook.normalization?.warnings || [],
    },
    createdAt,
    updatedAt: workbook.updatedAt || nowIso(),
  };
};

export const validateWorksheetMetadata = (worksheet: WorksheetMetadata) => {
  const messages: string[] = [];

  if (!worksheet.worksheetId) messages.push("Worksheet id is missing.");
  if (!worksheet.workbookId) messages.push("Workbook id is missing.");
  if (!worksheet.sheetName) messages.push("Worksheet name is missing.");
  if (!worksheet.tableName) messages.push("Worksheet table name is missing.");
  if (worksheet.columnCount !== worksheet.schema.length) {
    messages.push("Worksheet column count does not match schema length.");
  }

  return {
    isValid: messages.length === 0,
    messages,
  };
};

export const validateWorkbookMetadata = (workbook: WorkbookMetadata) => {
  const messages: string[] = [];
  const worksheetIds = new Set(workbook.worksheetIds);

  if (!workbook.workbookId) messages.push("Workbook id is missing.");
  if (workbook.activeWorksheetId && !worksheetIds.has(workbook.activeWorksheetId)) {
    messages.push("Active worksheet reference is stale.");
  }

  workbook.worksheets.forEach((worksheet) => {
    const validation = validateWorksheetMetadata(worksheet);
    messages.push(...validation.messages);
  });

  return {
    isValid: messages.length === 0,
    messages,
  };
};

export const getActiveWorksheet = (workbook: WorkbookMetadata) =>
  workbook.activeWorksheetId
    ? workbook.worksheets.find((worksheet) => worksheet.worksheetId === workbook.activeWorksheetId) || null
    : null;

export const setActiveWorksheetMetadata = (
  workbook: WorkbookMetadata,
  worksheetId: string,
): WorkbookMetadata => ({
  ...workbook,
  activeWorksheetId: workbook.worksheetIds.includes(worksheetId)
    ? worksheetId
    : workbook.activeWorksheetId,
  updatedAt: nowIso(),
});

export const listWorksheets = (workbook: WorkbookMetadata): WorksheetMetadata[] =>
  workbook.worksheets;

export const listRelationshipCandidates = (
  workbook: WorkbookMetadata,
): WorksheetRelationshipCandidate[] => workbook.relationshipCandidates;
