from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


WORKBOOK_METADATA_NORMALIZATION_VERSION = 1


class WorkbookSourceFileMetadata(BaseModel):
    original_filename: str
    stored_path: str | None = None
    mime_type: str | None = None
    byte_size: int | None = Field(default=None, ge=0)
    uploaded_at: str


class WorksheetTableMapping(BaseModel):
    sheet_name: str
    table_name: str
    original_index: int = Field(ge=0)


class WorksheetNormalizationMetadata(BaseModel):
    version: int = WORKBOOK_METADATA_NORMALIZATION_VERSION
    normalized_at: str
    header_row_index: int | None = Field(default=None, ge=0)
    skipped_leading_rows: int | None = Field(default=None, ge=0)
    header_detection_strategy: str | None = None
    header_detection_confidence: str | None = None
    header_detection_warning: str | None = None
    original_first_row_preview: list[str] | None = None
    selected_header_row_preview: list[str] | None = None
    duplicate_column_count: int = Field(default=0, ge=0)
    empty_column_count: int = Field(default=0, ge=0)
    warnings: list[str] = Field(default_factory=list)


class WorksheetMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    worksheet_id: str
    workbook_id: str
    sheet_name: str
    display_name: str
    table_name: str
    original_index: int = Field(ge=0)
    status: Literal["ready", "empty", "error", "skipped"] = "ready"
    schema_: list[dict[str, Any]] = Field(default_factory=list, alias="schema")
    row_count: int = Field(default=0, ge=0)
    column_count: int = Field(default=0, ge=0)
    visible_columns: list[str] = Field(default_factory=list)
    hidden_columns: list[str] = Field(default_factory=list)
    normalization: WorksheetNormalizationMetadata


class WorksheetRelationshipEvidence(BaseModel):
    name_similarity: float = Field(ge=0, le=1)
    type_compatible: bool
    source_unique_ratio: float = Field(ge=0, le=1)
    target_unique_ratio: float = Field(ge=0, le=1)
    sampled_overlap_ratio: float = Field(ge=0, le=1)
    sampled_row_count: int = Field(default=0, ge=0)
    summaries: list[str] = Field(default_factory=list)


class WorksheetRelationshipCandidate(BaseModel):
    relationship_id: str
    workbook_id: str
    source_worksheet_id: str
    source_worksheet_name: str
    source_table: str
    source_column: str
    target_worksheet_id: str
    target_worksheet_name: str
    target_table: str
    target_column: str
    confidence: float = Field(ge=0, le=1)
    confidence_label: Literal["low", "medium", "high"] = "low"
    relationship_type: Literal[
        "one_to_one_candidate",
        "one_to_many_candidate",
        "many_to_one_candidate",
        "unknown_candidate",
    ] = "unknown_candidate"
    direction: Literal["source_to_target", "target_to_source", "bidirectional", "unknown"] = "unknown"
    evidence: WorksheetRelationshipEvidence
    status: Literal["candidate", "confirmed", "dismissed"] = "candidate"
    review_status: Literal["pending", "accepted", "dismissed"] = "pending"
    reviewed_at: str | None = None
    reviewed_by: str | None = None
    review_notes: str | None = None


class AcceptedRelationshipContract(BaseModel):
    contract_id: str
    source_worksheet_id: str
    source_table_name: str
    source_column_name: str
    target_worksheet_id: str
    target_table_name: str
    target_column_name: str
    relationship_type: Literal[
        "one_to_one_candidate",
        "one_to_many_candidate",
        "many_to_one_candidate",
        "unknown_candidate",
    ] = "unknown_candidate"
    confidence: float = Field(ge=0, le=1)
    accepted_from_candidate_id: str
    accepted_at: str
    accepted_by: str | None = None
    status: Literal["active", "invalid", "stale"] = "active"
    validation_state: Literal["valid", "warning", "broken"] = "warning"
    validation_summary: list[str] = Field(default_factory=list)
    overlap_ratio: float = Field(default=0, ge=0, le=1)
    source_unique_ratio: float = Field(default=0, ge=0, le=1)
    target_unique_ratio: float = Field(default=0, ge=0, le=1)
    inferred_type_compatible: bool = False
    last_validated_at: str | None = None


class WorkbookIngestionProfile(BaseModel):
    max_worksheets: int = Field(default=30, ge=1)
    max_rows_per_worksheet_profile: int = Field(default=5000, ge=1)
    max_columns_per_worksheet: int = Field(default=250, ge=1)
    max_relationship_sample_rows: int = Field(default=1000, ge=1)
    max_preview_rows: int = Field(default=100, ge=1)
    profiling_strategy: Literal["metadata-only", "sampled", "full"] = "sampled"


class WorkbookNormalizationMetadata(BaseModel):
    version: int = WORKBOOK_METADATA_NORMALIZATION_VERSION
    normalized_at: str
    status: Literal["normalized", "needs-review", "failed"] = "normalized"
    warnings: list[str] = Field(default_factory=list)


class WorkbookMetadata(BaseModel):
    workbook_id: str
    workspace_id: str | None = None
    name: str
    status: Literal["pending", "profiling", "ready", "partial", "error"] = "pending"
    source_file: WorkbookSourceFileMetadata
    worksheet_ids: list[str] = Field(default_factory=list)
    active_worksheet_id: str | None = None
    worksheets: list[WorksheetMetadata] = Field(default_factory=list)
    table_mappings: list[WorksheetTableMapping] = Field(default_factory=list)
    relationship_candidates: list[WorksheetRelationshipCandidate] = Field(default_factory=list)
    accepted_relationship_contracts: list[AcceptedRelationshipContract] = Field(default_factory=list)
    ingestion_profile: WorkbookIngestionProfile = Field(default_factory=WorkbookIngestionProfile)
    normalization: WorkbookNormalizationMetadata
    created_at: str
    updated_at: str
