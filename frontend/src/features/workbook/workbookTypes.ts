import type { SchemaColumn } from "../dataset/datasetTypes";

export type WorkbookId = string;
export type WorksheetId = string;
export type WorksheetRelationshipId = string;

export type WorkbookStatus = "pending" | "profiling" | "ready" | "partial" | "error";

export type WorksheetStatus = "ready" | "empty" | "error" | "skipped";

export type WorkbookSourceFileMetadata = {
  originalFilename: string;
  storedPath: string | null;
  mimeType: string | null;
  byteSize: number | null;
  uploadedAt: string;
};

export type WorksheetTableMapping = {
  sheetName: string;
  tableName: string;
  originalIndex: number;
};

export type WorksheetMetadata = {
  worksheetId: WorksheetId;
  workbookId: WorkbookId;
  sheetName: string;
  displayName: string;
  tableName: string;
  originalIndex: number;
  status: WorksheetStatus;
  schema: SchemaColumn[];
  rowCount: number;
  columnCount: number;
  visibleColumns: string[];
  hiddenColumns: string[];
  normalization: {
    version: number;
    normalizedAt: string;
    headerRowIndex: number | null;
    duplicateColumnCount: number;
    emptyColumnCount: number;
    warnings: string[];
  };
};

export type WorksheetRelationshipEvidence = {
  nameSimilarity: number;
  typeCompatible: boolean;
  sourceUniqueRatio: number;
  targetUniqueRatio: number;
  sampledOverlapRatio: number;
  sampledRowCount: number;
};

export type WorksheetRelationshipCandidate = {
  relationshipId: WorksheetRelationshipId;
  workbookId: WorkbookId;
  sourceWorksheetId: WorksheetId;
  sourceColumn: string;
  targetWorksheetId: WorksheetId;
  targetColumn: string;
  confidence: number;
  relationshipType: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many" | "unknown";
  evidence: WorksheetRelationshipEvidence;
  status: "candidate" | "confirmed" | "dismissed";
};

export type WorkbookIngestionProfile = {
  maxWorksheets: number;
  maxRowsPerWorksheetProfile: number;
  maxColumnsPerWorksheet: number;
  maxRelationshipSampleRows: number;
  maxPreviewRows: number;
  profilingStrategy: "metadata-only" | "sampled" | "full";
};

export type WorkbookMetadata = {
  workbookId: WorkbookId;
  workspaceId: string | null;
  name: string;
  status: WorkbookStatus;
  sourceFile: WorkbookSourceFileMetadata;
  worksheetIds: WorksheetId[];
  activeWorksheetId: WorksheetId | null;
  worksheets: WorksheetMetadata[];
  tableMappings: WorksheetTableMapping[];
  relationshipCandidates: WorksheetRelationshipCandidate[];
  ingestionProfile: WorkbookIngestionProfile;
  normalization: {
    version: number;
    normalizedAt: string;
    status: "normalized" | "needs-review" | "failed";
    warnings: string[];
  };
  createdAt: string;
  updatedAt: string;
};
