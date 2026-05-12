from typing import Any, Literal

from pydantic import BaseModel, Field


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
    duplicate_column_count: int = Field(default=0, ge=0)
    empty_column_count: int = Field(default=0, ge=0)
    warnings: list[str] = Field(default_factory=list)


class WorksheetMetadata(BaseModel):
    worksheet_id: str
    workbook_id: str
    sheet_name: str
    display_name: str
    table_name: str
    original_index: int = Field(ge=0)
    status: Literal["ready", "empty", "error", "skipped"] = "ready"
    schema: list[dict[str, Any]] = Field(default_factory=list)
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


class WorksheetRelationshipCandidate(BaseModel):
    relationship_id: str
    workbook_id: str
    source_worksheet_id: str
    source_column: str
    target_worksheet_id: str
    target_column: str
    confidence: float = Field(ge=0, le=1)
    relationship_type: Literal[
        "one-to-one",
        "one-to-many",
        "many-to-one",
        "many-to-many",
        "unknown",
    ] = "unknown"
    evidence: WorksheetRelationshipEvidence
    status: Literal["candidate", "confirmed", "dismissed"] = "candidate"


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
    ingestion_profile: WorkbookIngestionProfile = Field(default_factory=WorkbookIngestionProfile)
    normalization: WorkbookNormalizationMetadata
    created_at: str
    updated_at: str
