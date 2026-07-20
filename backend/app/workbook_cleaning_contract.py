from __future__ import annotations

from typing import Annotated, Literal

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


class WorkbookCleaningApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row_limit_preview: int = Field(25, ge=1, le=200)
    confirm_preview_version: str | None = None
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None


class WorkbookCleaningPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row_limit_preview: int = Field(10, ge=1, le=200)
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None


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
