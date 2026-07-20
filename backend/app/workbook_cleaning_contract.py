from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field


StructuralDecisionValue = Literal["use_recommendation", "keep_original", "decide_later"]
StructuralEvidenceType = Literal[
    "repeated_header",
    "date_title_row",
    "section_banner",
    "sparse_layout_gap",
    "serial_only_placeholder_rows",
    "side_note_region_candidate",
    "repeated_missing_pattern",
    "automatic_blank_row",
]
NonNegativeIndex = Annotated[int, Field(ge=0)]
SUPPORTED_MISSING_VALUE_WORKSHEET_STRATEGIES = {
    "leave_unchanged",
    "layout_space",
    "remove_mostly_blank_rows",
    "decide_per_column",
}
SUPPORTED_MISSING_VALUE_COLUMN_STRATEGIES = {
    "fill_zero",
    "fill_mean",
    "fill_median",
    "fill_custom",
    "mark_unknown",
    "fill_mode",
    "custom_date",
}


class WorkbookStructuralDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recommendation_id: str = Field(..., min_length=1)
    evidence_type: StructuralEvidenceType
    decision: StructuralDecisionValue
    evidence_signal_id: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)
    affected_rows: list[NonNegativeIndex] = Field(default_factory=list)
    affected_column_indexes: list[NonNegativeIndex] = Field(default_factory=list)
    affected_columns: list[str] = Field(default_factory=list)


class WorkbookStructuralDecisionPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worksheet_id: str | None = None
    worksheet_name: str | None = None
    decisions: list[WorkbookStructuralDecision] = Field(default_factory=list)


class WorkbookMissingValueColumnDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column_name: str = Field(..., min_length=1)
    strategy: str = Field(..., min_length=1)
    custom_value: Any | None = None


class WorkbookMissingValuePlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worksheet_id: str = Field(..., min_length=1)
    worksheet_strategy: str = Field(..., min_length=1)
    column_decisions: list[WorkbookMissingValueColumnDecision] = Field(default_factory=list)


class WorkbookCleaningApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row_limit_preview: int = Field(25, ge=1, le=200)
    confirm_preview_version: str | None = None
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None
    missing_value_plan: WorkbookMissingValuePlan | None = None


class WorkbookCleaningPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row_limit_preview: int = Field(10, ge=1, le=200)
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None
    missing_value_plan: WorkbookMissingValuePlan | None = None


def validate_structural_decision_plan_scope(
    plan: WorkbookStructuralDecisionPlan | None,
    worksheet_id: str,
) -> None:
    if plan is None:
        return

    if plan.worksheet_id is None:
        if plan.decisions:
            raise HTTPException(
                status_code=400,
                detail="Structural decision plan must include worksheet_id when decisions are provided",
            )
        return

    if plan.worksheet_id != worksheet_id:
        raise HTTPException(
            status_code=400,
            detail="Structural decision plan worksheet_id must match the selected worksheet",
        )

    seen_recommendation_ids: set[str] = set()
    for decision in plan.decisions:
        if decision.recommendation_id in seen_recommendation_ids:
            raise HTTPException(
                status_code=400,
                detail="Structural decision plan contains duplicate recommendation_id values",
            )
        seen_recommendation_ids.add(decision.recommendation_id)

        if not decision.recommendation_id.startswith(f"{worksheet_id}:"):
            raise HTTPException(
                status_code=400,
                detail="Structural decision recommendation_id must be scoped to the selected worksheet",
            )
        if decision.evidence_signal_id and not decision.evidence_signal_id.startswith(f"{worksheet_id}:"):
            raise HTTPException(
                status_code=400,
                detail="Structural decision evidence_signal_id must be scoped to the selected worksheet",
            )
        for evidence_id in decision.evidence_ids:
            if not evidence_id.startswith(f"{worksheet_id}:"):
                raise HTTPException(
                    status_code=400,
                    detail="Structural decision evidence_ids must be scoped to the selected worksheet",
                )


def validate_missing_value_plan_scope(
    plan: WorkbookMissingValuePlan | None,
    worksheet_id: str,
) -> None:
    if plan is None:
        return

    if plan.worksheet_id != worksheet_id:
        raise HTTPException(
            status_code=400,
            detail="Missing-value plan worksheet_id must match the selected worksheet",
        )
    if plan.worksheet_strategy not in SUPPORTED_MISSING_VALUE_WORKSHEET_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported worksheet missing-value strategy",
        )
    if plan.worksheet_strategy in SUPPORTED_MISSING_VALUE_COLUMN_STRATEGIES:
        raise HTTPException(
            status_code=400,
            detail="Column missing-value strategy cannot be used as worksheet_strategy",
        )

    seen_columns: set[str] = set()
    for decision in plan.column_decisions:
        if decision.column_name in seen_columns:
            raise HTTPException(
                status_code=400,
                detail="Missing-value plan contains duplicate column_name values",
            )
        seen_columns.add(decision.column_name)
        if decision.strategy not in SUPPORTED_MISSING_VALUE_COLUMN_STRATEGIES:
            raise HTTPException(
                status_code=400,
                detail="Unsupported column missing-value strategy",
            )
        if decision.strategy in SUPPORTED_MISSING_VALUE_WORKSHEET_STRATEGIES:
            raise HTTPException(
                status_code=400,
                detail="Worksheet missing-value strategy cannot be used as a column strategy",
            )
