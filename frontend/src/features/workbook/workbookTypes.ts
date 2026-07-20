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

export type WorkbookAnalysisSource = {
  type: "original" | "cleaned_working_copy";
  worksheetId: WorksheetId;
  tableName: string;
  originalTableName: string;
  activatedAt: string;
};

export type CleanedWorkingCopy = {
  cleanedCopyId: string;
  sourceWorksheetId: WorksheetId;
  sourceTableName: string;
  cleanedTableName: string;
  createdAt: string;
};

export type WorksheetTemplateStructureEvidenceType =
  | "repeated_header"
  | "date_title_row"
  | "section_banner"
  | "sparse_layout_gap"
  | "serial_only_placeholder_rows"
  | "side_note_region_candidate"
  | "repeated_missing_pattern"
  | "automatic_blank_row"
  | "clean_table_counter_signal";

export type StructuralDecisionChoice =
  | "use_recommendation"
  | "keep_original"
  | "decide_later";

export type WorksheetStructuralDecision = {
  recommendationId: string;
  evidenceType: WorksheetTemplateStructureEvidenceType;
  decision: StructuralDecisionChoice;
  evidenceIds?: string[];
  evidenceSignalId?: string;
  affectedRows?: number[];
  affectedColumnIndexes?: number[];
  affectedColumns?: string[];
};

export type WorksheetStructuralDecisionPlan = {
  worksheetId: WorksheetId;
  decisions: WorksheetStructuralDecision[];
};

export type MissingValueWorksheetStrategy =
  | "leave_unchanged"
  | "layout_space"
  | "remove_mostly_blank_rows"
  | "decide_per_column";

export type MissingValueColumnStrategy =
  | "fill_zero"
  | "fill_mean"
  | "fill_median"
  | "fill_custom"
  | "mark_unknown"
  | "fill_mode"
  | "custom_date";

export type MissingValueColumnDecision = {
  columnName: string;
  strategy: MissingValueColumnStrategy;
  customValue?: string | number | boolean | null;
};

export type WorksheetMissingValuePlan = {
  worksheetId: WorksheetId;
  worksheetStrategy: MissingValueWorksheetStrategy;
  columnDecisions: MissingValueColumnDecision[];
};

export type SupportedWorkbookTransformationKind =
  | "trim_whitespace"
  | "lowercase"
  | "uppercase"
  | "cap_outliers_percentile"
  | "log_transform"
  | "z_score_scale"
  | "min_max_scale"
  | "ordinal_encode"
  | "frequency_encode"
  | "extract_year"
  | "extract_month"
  | "extract_quarter"
  | "extract_day_of_week"
  | "days_since"
  | "boolean_to_integer";

export type WorkbookTransformationStepParameters =
  | { kind: "cap_outliers_percentile"; lowerPercentile: number; upperPercentile: number }
  | { kind: "ordinal_encode"; order: string[] }
  | { kind: "days_since"; anchorDate: string }
  | { kind: Exclude<SupportedWorkbookTransformationKind, "cap_outliers_percentile" | "ordinal_encode" | "days_since"> };

export type WorkbookTransformationStep = {
  stepId: string;
  order: number;
  kind: SupportedWorkbookTransformationKind;
  targetColumn: string;
  outputColumn?: string;
  parameters?: WorkbookTransformationStepParameters;
};

export type WorkbookTransformationPlan = {
  worksheetId: WorksheetId;
  pipelineId: string;
  steps: WorkbookTransformationStep[];
};

export type WorksheetTemplateStructureEvidence = {
  type: WorksheetTemplateStructureEvidenceType;
  rowIndex: number | null;
  rowRange: number[] | null;
  rowIndexes: number[];
  columnRange: number[] | null;
  label: string | null;
  previewValues: string[];
  confidence: "low" | "medium" | "high";
  explanation: string;
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
    skippedLeadingRows: number | null;
    headerDetectionStrategy: string | null;
    headerDetectionConfidence: string | null;
    headerDetectionWarning: string | null;
    originalFirstRowPreview: string[] | null;
    selectedHeaderRowPreview: string[] | null;
    structuralColumnCandidates: string[];
    structuralColumnDetectionWarning: string | null;
    structuralColumnDetectionConfidence: string | null;
    structuralColumnSampleSize: number | null;
    recommendedHiddenColumns: string[];
    duplicateColumnCount: number;
    emptyColumnCount: number;
    warnings: string[];
    templateStructureCandidate: boolean;
    templateStructureConfidence: "low" | "medium" | "high";
    templateStructureEvidence: WorksheetTemplateStructureEvidence[];
  };
};

export type WorksheetRelationshipEvidence = {
  nameSimilarity: number;
  typeCompatible: boolean;
  sourceUniqueRatio: number;
  targetUniqueRatio: number;
  sampledOverlapRatio: number;
  sampledRowCount: number;
  summaries: string[];
};

export type WorksheetRelationshipCandidate = {
  relationshipId: WorksheetRelationshipId;
  workbookId: WorkbookId;
  sourceWorksheetId: WorksheetId;
  sourceWorksheetName: string;
  sourceTable: string;
  sourceColumn: string;
  targetWorksheetId: WorksheetId;
  targetWorksheetName: string;
  targetTable: string;
  targetColumn: string;
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  relationshipType:
    | "one_to_one_candidate"
    | "one_to_many_candidate"
    | "many_to_one_candidate"
    | "unknown_candidate";
  direction: "source_to_target" | "target_to_source" | "bidirectional" | "unknown";
  evidence: WorksheetRelationshipEvidence;
  status: "candidate" | "confirmed" | "dismissed";
  reviewStatus: "pending" | "accepted" | "dismissed";
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
};

export type AcceptedRelationshipContract = {
  contractId: string;
  sourceWorksheetId: WorksheetId;
  sourceTableName: string;
  sourceColumnName: string;
  targetWorksheetId: WorksheetId;
  targetTableName: string;
  targetColumnName: string;
  relationshipType: WorksheetRelationshipCandidate["relationshipType"];
  confidence: number;
  acceptedFromCandidateId: string;
  acceptedAt: string;
  acceptedBy: string | null;
  status: "active" | "invalid" | "stale";
  validationState: "valid" | "warning" | "broken";
  validationSummary: string[];
  overlapRatio: number;
  sourceUniqueRatio: number;
  targetUniqueRatio: number;
  inferredTypeCompatible: boolean;
  lastValidatedAt: string | null;
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
  activeAnalysisSource: WorkbookAnalysisSource | null;
  cleanedWorkingCopies: CleanedWorkingCopy[];
  worksheets: WorksheetMetadata[];
  tableMappings: WorksheetTableMapping[];
  relationshipCandidates: WorksheetRelationshipCandidate[];
  acceptedRelationshipContracts: AcceptedRelationshipContract[];
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
