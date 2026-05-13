import type {
  WorkbookIngestionProfile,
  WorkbookMetadata,
  AcceptedRelationshipContract,
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

const readString = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback;

const readNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readArray = <T = unknown>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const readObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

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
    acceptedRelationshipContracts: workbook.acceptedRelationshipContracts || [],
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

export const normalizeUnknownWorksheetMetadata = (
  value: unknown,
  workbookId: string,
  index = 0,
): WorksheetMetadata => {
  const worksheet = readObject(value);
  const normalization = readObject(worksheet.normalization);

  return normalizeWorksheetMetadata(
    {
      worksheetId: readString(worksheet.worksheetId ?? worksheet.worksheet_id, `${workbookId}:worksheet:${index + 1}`),
      workbookId,
      sheetName: readString(worksheet.sheetName ?? worksheet.sheet_name, `Worksheet ${index + 1}`),
      displayName: readString(worksheet.displayName ?? worksheet.display_name, readString(worksheet.sheetName ?? worksheet.sheet_name, `Worksheet ${index + 1}`)),
      tableName: readString(worksheet.tableName ?? worksheet.table_name, generateSafeWorksheetTableName(readString(worksheet.sheetName ?? worksheet.sheet_name, `Worksheet ${index + 1}`), index)),
      originalIndex: readNumber(worksheet.originalIndex ?? worksheet.original_index, index),
      status:
        worksheet.status === "ready" ||
        worksheet.status === "empty" ||
        worksheet.status === "error" ||
        worksheet.status === "skipped"
          ? worksheet.status
          : "error",
      schema: readArray(worksheet.schema),
      rowCount: readNumber(worksheet.rowCount ?? worksheet.row_count, 0),
      columnCount: readNumber(worksheet.columnCount ?? worksheet.column_count, readArray(worksheet.schema).length),
      visibleColumns: readArray<string>(worksheet.visibleColumns ?? worksheet.visible_columns),
      hiddenColumns: readArray<string>(worksheet.hiddenColumns ?? worksheet.hidden_columns),
      normalization: {
        version: readNumber(normalization.version, WORKBOOK_METADATA_NORMALIZATION_VERSION),
        normalizedAt: readString(normalization.normalizedAt ?? normalization.normalized_at, nowIso()),
        headerRowIndex:
          typeof (normalization.headerRowIndex ?? normalization.header_row_index) === "number"
            ? (normalization.headerRowIndex ?? normalization.header_row_index) as number
            : null,
        duplicateColumnCount: readNumber(normalization.duplicateColumnCount ?? normalization.duplicate_column_count, 0),
        emptyColumnCount: readNumber(normalization.emptyColumnCount ?? normalization.empty_column_count, 0),
        warnings: readArray<string>(normalization.warnings),
      },
    },
    workbookId,
    index,
  );
};

const normalizeRelationshipType = (value: unknown): WorksheetRelationshipCandidate["relationshipType"] => {
  if (
    value === "one_to_one_candidate" ||
    value === "one_to_many_candidate" ||
    value === "many_to_one_candidate" ||
    value === "unknown_candidate"
  ) {
    return value;
  }

  if (value === "one-to-one") return "one_to_one_candidate";
  if (value === "one-to-many") return "one_to_many_candidate";
  if (value === "many-to-one") return "many_to_one_candidate";
  return "unknown_candidate";
};

const normalizeRelationshipCandidate = (
  value: unknown,
  workbookId: string,
  index = 0,
): WorksheetRelationshipCandidate => {
  const candidate = readObject(value);
  const evidence = readObject(candidate.evidence);
  const confidence = Math.min(1, Math.max(0, readNumber(candidate.confidence, 0)));
  const confidenceLabel =
    candidate.confidenceLabel === "high" ||
    candidate.confidence_label === "high" ||
    candidate.confidenceLabel === "medium" ||
    candidate.confidence_label === "medium" ||
    candidate.confidenceLabel === "low" ||
    candidate.confidence_label === "low"
      ? ((candidate.confidenceLabel ?? candidate.confidence_label) as "low" | "medium" | "high")
      : confidence >= 0.75
        ? "high"
        : confidence >= 0.52
          ? "medium"
          : "low";
  const direction = candidate.direction;

  return {
    relationshipId: readString(
      candidate.relationshipId ?? candidate.relationship_id,
      `${workbookId}:relationship:${index + 1}`,
    ),
    workbookId,
    sourceWorksheetId: readString(candidate.sourceWorksheetId ?? candidate.source_worksheet_id, ""),
    sourceWorksheetName: readString(
      candidate.sourceWorksheetName ?? candidate.source_worksheet_name,
      "Source worksheet",
    ),
    sourceTable: readString(candidate.sourceTable ?? candidate.source_table, ""),
    sourceColumn: readString(candidate.sourceColumn ?? candidate.source_column, ""),
    targetWorksheetId: readString(candidate.targetWorksheetId ?? candidate.target_worksheet_id, ""),
    targetWorksheetName: readString(
      candidate.targetWorksheetName ?? candidate.target_worksheet_name,
      "Target worksheet",
    ),
    targetTable: readString(candidate.targetTable ?? candidate.target_table, ""),
    targetColumn: readString(candidate.targetColumn ?? candidate.target_column, ""),
    confidence,
    confidenceLabel,
    relationshipType: normalizeRelationshipType(
      candidate.relationshipType ?? candidate.relationship_type,
    ),
    direction:
      direction === "source_to_target" ||
      direction === "target_to_source" ||
      direction === "bidirectional" ||
      direction === "unknown"
        ? direction
        : "unknown",
    evidence: {
      nameSimilarity: readNumber(evidence.nameSimilarity ?? evidence.name_similarity, 0),
      typeCompatible: Boolean(evidence.typeCompatible ?? evidence.type_compatible),
      sourceUniqueRatio: readNumber(evidence.sourceUniqueRatio ?? evidence.source_unique_ratio, 0),
      targetUniqueRatio: readNumber(evidence.targetUniqueRatio ?? evidence.target_unique_ratio, 0),
      sampledOverlapRatio: readNumber(
        evidence.sampledOverlapRatio ?? evidence.sampled_overlap_ratio,
        0,
      ),
      sampledRowCount: readNumber(evidence.sampledRowCount ?? evidence.sampled_row_count, 0),
      summaries: readArray<string>(evidence.summaries),
    },
    status:
      candidate.status === "candidate" ||
      candidate.status === "confirmed" ||
      candidate.status === "dismissed"
        ? candidate.status
        : "candidate",
    reviewStatus:
      candidate.reviewStatus === "accepted" ||
      candidate.review_status === "accepted" ||
      candidate.reviewStatus === "dismissed" ||
      candidate.review_status === "dismissed" ||
      candidate.reviewStatus === "pending" ||
      candidate.review_status === "pending"
        ? ((candidate.reviewStatus ?? candidate.review_status) as "pending" | "accepted" | "dismissed")
        : "pending",
    reviewedAt:
      typeof (candidate.reviewedAt ?? candidate.reviewed_at) === "string"
        ? ((candidate.reviewedAt ?? candidate.reviewed_at) as string)
        : null,
    reviewedBy:
      typeof (candidate.reviewedBy ?? candidate.reviewed_by) === "string"
        ? ((candidate.reviewedBy ?? candidate.reviewed_by) as string)
        : null,
    reviewNotes:
      typeof (candidate.reviewNotes ?? candidate.review_notes) === "string"
        ? ((candidate.reviewNotes ?? candidate.review_notes) as string)
        : null,
  };
};

const normalizeAcceptedRelationshipContract = (
  value: unknown,
  index = 0,
): AcceptedRelationshipContract => {
  const contract = readObject(value);
  const confidence = Math.min(1, Math.max(0, readNumber(contract.confidence, 0)));
  const status =
    contract.status === "active" || contract.status === "invalid" || contract.status === "stale"
      ? contract.status
      : "stale";
  const validationState =
    contract.validationState === "valid" ||
    contract.validation_state === "valid" ||
    contract.validationState === "warning" ||
    contract.validation_state === "warning" ||
    contract.validationState === "broken" ||
    contract.validation_state === "broken"
      ? ((contract.validationState ?? contract.validation_state) as "valid" | "warning" | "broken")
      : "warning";

  return {
    contractId: readString(contract.contractId ?? contract.contract_id, `contract:${index + 1}`),
    sourceWorksheetId: readString(contract.sourceWorksheetId ?? contract.source_worksheet_id, ""),
    sourceTableName: readString(contract.sourceTableName ?? contract.source_table_name, ""),
    sourceColumnName: readString(contract.sourceColumnName ?? contract.source_column_name, ""),
    targetWorksheetId: readString(contract.targetWorksheetId ?? contract.target_worksheet_id, ""),
    targetTableName: readString(contract.targetTableName ?? contract.target_table_name, ""),
    targetColumnName: readString(contract.targetColumnName ?? contract.target_column_name, ""),
    relationshipType: normalizeRelationshipType(
      contract.relationshipType ?? contract.relationship_type,
    ),
    confidence,
    acceptedFromCandidateId: readString(
      contract.acceptedFromCandidateId ?? contract.accepted_from_candidate_id,
      "",
    ),
    acceptedAt: readString(contract.acceptedAt ?? contract.accepted_at, ""),
    acceptedBy:
      typeof (contract.acceptedBy ?? contract.accepted_by) === "string"
        ? ((contract.acceptedBy ?? contract.accepted_by) as string)
        : null,
    status,
    validationState,
    validationSummary: readArray<string>(contract.validationSummary ?? contract.validation_summary),
    overlapRatio: readNumber(contract.overlapRatio ?? contract.overlap_ratio, 0),
    sourceUniqueRatio: readNumber(contract.sourceUniqueRatio ?? contract.source_unique_ratio, 0),
    targetUniqueRatio: readNumber(contract.targetUniqueRatio ?? contract.target_unique_ratio, 0),
    inferredTypeCompatible: Boolean(
      contract.inferredTypeCompatible ?? contract.inferred_type_compatible,
    ),
    lastValidatedAt:
      typeof (contract.lastValidatedAt ?? contract.last_validated_at) === "string"
        ? ((contract.lastValidatedAt ?? contract.last_validated_at) as string)
        : null,
  };
};

export const normalizeUnknownWorkbookMetadata = (value: unknown): WorkbookMetadata | null => {
  if (!value || typeof value !== "object") return null;

  const workbook = readObject(value);
  const sourceFile = readObject(workbook.sourceFile ?? workbook.source_file);
  const normalization = readObject(workbook.normalization);
  const workbookId = readString(workbook.workbookId ?? workbook.workbook_id, "");
  if (!workbookId) return null;

  const worksheets = readArray(workbook.worksheets).map((worksheet, index) =>
    normalizeUnknownWorksheetMetadata(worksheet, workbookId, index),
  );
  const worksheetIds = worksheets.map((worksheet) => worksheet.worksheetId);
  const activeWorksheetId = readString(
    workbook.activeWorksheetId ?? workbook.active_worksheet_id,
    worksheetIds[0] || "",
  );

  return normalizeWorkbookMetadata({
    workbookId,
    workspaceId:
      typeof (workbook.workspaceId ?? workbook.workspace_id) === "string"
        ? ((workbook.workspaceId ?? workbook.workspace_id) as string)
        : null,
    name: readString(workbook.name, readString(sourceFile.originalFilename ?? sourceFile.original_filename, "Workbook")),
    status:
      workbook.status === "pending" ||
      workbook.status === "profiling" ||
      workbook.status === "ready" ||
      workbook.status === "partial" ||
      workbook.status === "error"
        ? workbook.status
        : "partial",
    sourceFile: {
      originalFilename: readString(sourceFile.originalFilename ?? sourceFile.original_filename, "workbook.xlsx"),
      storedPath:
        typeof (sourceFile.storedPath ?? sourceFile.stored_path) === "string"
          ? ((sourceFile.storedPath ?? sourceFile.stored_path) as string)
          : null,
      mimeType:
        typeof (sourceFile.mimeType ?? sourceFile.mime_type) === "string"
          ? ((sourceFile.mimeType ?? sourceFile.mime_type) as string)
          : null,
      byteSize:
        typeof (sourceFile.byteSize ?? sourceFile.byte_size) === "number"
          ? ((sourceFile.byteSize ?? sourceFile.byte_size) as number)
          : null,
      uploadedAt: readString(sourceFile.uploadedAt ?? sourceFile.uploaded_at, nowIso()),
    },
    worksheetIds,
    activeWorksheetId: worksheetIds.includes(activeWorksheetId) ? activeWorksheetId : worksheetIds[0] || null,
    worksheets,
    tableMappings: worksheets.map((worksheet) => ({
      sheetName: worksheet.sheetName,
      tableName: worksheet.tableName,
      originalIndex: worksheet.originalIndex,
    })),
    relationshipCandidates: readArray(workbook.relationshipCandidates ?? workbook.relationship_candidates)
      .map((candidate, index) => normalizeRelationshipCandidate(candidate, workbookId, index))
      .filter(
        (candidate) =>
          candidate.sourceWorksheetId &&
          candidate.targetWorksheetId &&
          candidate.sourceColumn &&
          candidate.targetColumn,
      ),
    acceptedRelationshipContracts: readArray(
      workbook.acceptedRelationshipContracts ?? workbook.accepted_relationship_contracts,
    )
      .map((contract, index) => normalizeAcceptedRelationshipContract(contract, index))
      .filter(
        (contract) =>
          contract.sourceWorksheetId &&
          contract.targetWorksheetId &&
          contract.sourceColumnName &&
          contract.targetColumnName,
      ),
    ingestionProfile: DEFAULT_WORKBOOK_INGESTION_PROFILE,
    normalization: {
      version: readNumber(normalization.version, WORKBOOK_METADATA_NORMALIZATION_VERSION),
      normalizedAt: readString(normalization.normalizedAt ?? normalization.normalized_at, nowIso()),
      status:
        normalization.status === "normalized" ||
        normalization.status === "needs-review" ||
        normalization.status === "failed"
          ? normalization.status
          : "normalized",
      warnings: readArray<string>(normalization.warnings),
    },
    createdAt: readString(workbook.createdAt ?? workbook.created_at, nowIso()),
    updatedAt: readString(workbook.updatedAt ?? workbook.updated_at, nowIso()),
  });
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

export const getWorkbookMetadata = (dataset: { workbook_metadata?: unknown } | null) =>
  normalizeUnknownWorkbookMetadata(dataset?.workbook_metadata);

export const hasWorkbookMetadata = (dataset: { workbook_metadata?: unknown } | null) =>
  Boolean(getWorkbookMetadata(dataset));

export const getDatasetActiveWorksheet = (dataset: { workbook_metadata?: unknown } | null) => {
  const workbook = getWorkbookMetadata(dataset);
  return workbook ? getActiveWorksheet(workbook) : null;
};

export const listWorkbookWorksheets = (dataset: { workbook_metadata?: unknown } | null) => {
  const workbook = getWorkbookMetadata(dataset);
  return workbook ? listWorksheets(workbook) : [];
};

export const getWorksheetTableName = (
  dataset: { workbook_metadata?: unknown } | null,
  worksheetId: string,
) => {
  const workbook = getWorkbookMetadata(dataset);
  return (
    workbook?.worksheets.find((worksheet) => worksheet.worksheetId === worksheetId)?.tableName ||
    null
  );
};
