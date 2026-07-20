from __future__ import annotations

from datetime import date
import re
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
SUPPORTED_TRANSFORMATION_KINDS = {
    "trim_whitespace",
    "lowercase",
    "uppercase",
    "cap_outliers_percentile",
    "log_transform",
    "z_score_scale",
    "min_max_scale",
    "ordinal_encode",
    "frequency_encode",
    "extract_year",
    "extract_month",
    "extract_quarter",
    "extract_day_of_week",
    "days_since",
    "boolean_to_integer",
}
BLOCKED_TRANSFORMATION_KINDS = {
    "fill_missing_mean",
    "fill_missing_median",
    "fill_missing_mode",
    "fill_missing_zero",
    "fill_missing_custom",
    "fill_missing_unknown",
    "fill_missing_true",
    "fill_missing_false",
    "one_hot_encode",
    "sql_select_transform",
}
TRANSFORMATION_KINDS_BY_TYPE = {
    "text": {"trim_whitespace", "lowercase", "uppercase"},
    "numeric": {
        "cap_outliers_percentile",
        "log_transform",
        "z_score_scale",
        "min_max_scale",
    },
    "categorical": {"ordinal_encode", "frequency_encode"},
    "date": {
        "extract_year",
        "extract_month",
        "extract_quarter",
        "extract_day_of_week",
        "days_since",
    },
    "boolean": {"boolean_to_integer"},
}
TRANSFORMATION_KINDS_REQUIRING_NEW_OUTPUT = {
    "log_transform",
    "z_score_scale",
    "min_max_scale",
    "ordinal_encode",
    "frequency_encode",
    "extract_year",
    "extract_month",
    "extract_quarter",
    "extract_day_of_week",
    "days_since",
}
TRANSFORMATION_REPLACEMENT_KINDS = {
    "trim_whitespace",
    "lowercase",
    "uppercase",
    "cap_outliers_percentile",
    "boolean_to_integer",
}
OUTPUT_COLUMN_NAME_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


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
    column_decisions: list[WorkbookMissingValueColumnDecision] = Field(
        default_factory=list
    )


class WorkbookTransformationStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step_id: str = Field(..., min_length=1)
    order: int = Field(..., ge=0)
    kind: str = Field(..., min_length=1)
    target_column: str = Field(..., min_length=1)
    output_column: str | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class WorkbookTransformationPlan(BaseModel):
    model_config = ConfigDict(extra="forbid")

    worksheet_id: str = Field(..., min_length=1)
    pipeline_id: str = Field(..., min_length=1)
    steps: list[WorkbookTransformationStep] = Field(default_factory=list)


class WorkbookCleaningApplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row_limit_preview: int = Field(25, ge=1, le=200)
    confirm_preview_version: str | None = None
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None
    missing_value_plan: WorkbookMissingValuePlan | None = None
    transformation_plan: WorkbookTransformationPlan | None = None


class WorkbookCleaningPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row_limit_preview: int = Field(10, ge=1, le=200)
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None
    missing_value_plan: WorkbookMissingValuePlan | None = None
    transformation_plan: WorkbookTransformationPlan | None = None


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
        if decision.evidence_signal_id and not decision.evidence_signal_id.startswith(
            f"{worksheet_id}:"
        ):
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


def _column_types_by_name(worksheet: dict[str, Any] | None) -> dict[str, str]:
    if worksheet is None:
        return {}
    schema = worksheet.get("schema")
    if not isinstance(schema, list):
        return {}
    return {
        str(column.get("name")): str(column.get("inferred_type") or "text")
        for column in schema
        if isinstance(column, dict) and column.get("name")
    }


def _is_valid_output_column_name(value: str | None) -> bool:
    return bool(
        value and value.strip() == value and OUTPUT_COLUMN_NAME_PATTERN.fullmatch(value)
    )


def _validate_transformation_parameters(step: WorkbookTransformationStep) -> None:
    parameters = step.parameters or {}
    if step.kind == "cap_outliers_percentile":
        lower = parameters.get("lower_percentile")
        upper = parameters.get("upper_percentile")
        if not isinstance(lower, (int, float)) or not isinstance(upper, (int, float)):
            raise HTTPException(
                status_code=400,
                detail="Percentile transformation requires numeric bounds",
            )
        if lower < 0 or upper > 100 or lower >= upper:
            raise HTTPException(status_code=400, detail="Percentile bounds are invalid")
    elif step.kind == "ordinal_encode":
        order = parameters.get("order")
        if (
            not isinstance(order, list)
            or len(order) < 2
            or not all(str(item).strip() for item in order)
        ):
            raise HTTPException(
                status_code=400, detail="Ordinal encoding requires a category order"
            )
    elif step.kind == "days_since":
        anchor_date = parameters.get("anchor_date")
        if not isinstance(anchor_date, str) or not anchor_date.strip():
            raise HTTPException(
                status_code=400, detail="days_since requires an anchor_date"
            )
        try:
            date.fromisoformat(anchor_date)
        except ValueError as error:
            raise HTTPException(
                status_code=400, detail="days_since anchor_date must use yyyy-mm-dd"
            ) from error
    elif parameters:
        raise HTTPException(
            status_code=400, detail=f"{step.kind} does not accept parameters"
        )


def validate_transformation_plan_scope(
    plan: WorkbookTransformationPlan | None,
    worksheet_id: str,
    worksheet: dict[str, Any] | None = None,
    shaped_columns: list[str] | None = None,
) -> None:
    """Validate the transformation wire contract without executing transformations.

    Later execution must process steps by contiguous `order` and update the
    current in-memory schema after each step. For example, `boolean_to_integer`
    changes its target column type to numeric/integer, so a later incompatible
    step must fail explicitly. If structural decisions remove columns before
    transformations run, callers must pass the shaped column set here rather
    than silently skipping removed-column targets.
    """
    if plan is None:
        return

    if plan.worksheet_id != worksheet_id:
        raise HTTPException(
            status_code=400,
            detail="Transformation plan worksheet_id must match the selected worksheet",
        )
    if not plan.pipeline_id.strip():
        raise HTTPException(
            status_code=400, detail="Transformation plan pipeline_id is required"
        )

    column_types = _column_types_by_name(worksheet)
    existing_columns = set(
        shaped_columns if shaped_columns is not None else column_types.keys()
    )
    seen_step_ids: set[str] = set()
    seen_orders: set[int] = set()
    generated_outputs: set[str] = set()

    for step in sorted(plan.steps, key=lambda item: item.order):
        if not step.step_id.strip():
            raise HTTPException(
                status_code=400, detail="Transformation step_id is required"
            )
        if step.step_id in seen_step_ids:
            raise HTTPException(
                status_code=400,
                detail="Transformation plan contains duplicate step_id values",
            )
        seen_step_ids.add(step.step_id)

        if step.order in seen_orders:
            raise HTTPException(
                status_code=400,
                detail="Transformation plan contains duplicate order values",
            )
        seen_orders.add(step.order)

        if step.kind in BLOCKED_TRANSFORMATION_KINDS:
            raise HTTPException(
                status_code=400, detail=f"Transformation kind is blocked: {step.kind}"
            )
        if step.kind not in SUPPORTED_TRANSFORMATION_KINDS:
            raise HTTPException(
                status_code=400, detail=f"Unsupported transformation kind: {step.kind}"
            )
        if step.target_column not in existing_columns:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown transformation target column: {step.target_column}",
            )

        inferred_type = column_types.get(step.target_column)
        if inferred_type and step.kind not in TRANSFORMATION_KINDS_BY_TYPE.get(
            inferred_type, set()
        ):
            raise HTTPException(
                status_code=400,
                detail="Transformation kind is invalid for target datatype",
            )

        _validate_transformation_parameters(step)

        if step.kind in TRANSFORMATION_KINDS_REQUIRING_NEW_OUTPUT:
            if not _is_valid_output_column_name(step.output_column):
                raise HTTPException(
                    status_code=400, detail="Transformation output_column is invalid"
                )
            if step.output_column == step.target_column:
                raise HTTPException(
                    status_code=400,
                    detail="Transformation requires a new output column",
                )
            if (
                step.output_column in existing_columns
                or step.output_column in generated_outputs
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Transformation output_column collides with an existing column",
                )
            generated_outputs.add(step.output_column)
            existing_columns.add(step.output_column)
            if step.kind in {
                "extract_year",
                "extract_month",
                "extract_quarter",
                "extract_day_of_week",
                "days_since",
                "ordinal_encode",
                "frequency_encode",
                "log_transform",
                "z_score_scale",
                "min_max_scale",
            }:
                column_types[step.output_column] = "numeric"
        elif step.kind in TRANSFORMATION_REPLACEMENT_KINDS:
            if (
                step.kind == "boolean_to_integer"
                and step.output_column
                and step.output_column != step.target_column
            ):
                if not _is_valid_output_column_name(step.output_column):
                    raise HTTPException(
                        status_code=400,
                        detail="Transformation output_column is invalid",
                    )
                if (
                    step.output_column in existing_columns
                    or step.output_column in generated_outputs
                ):
                    raise HTTPException(
                        status_code=400,
                        detail="Transformation output_column collides with an existing column",
                    )
                generated_outputs.add(step.output_column)
                existing_columns.add(step.output_column)
                column_types[step.output_column] = "numeric"
            elif (
                step.output_column is not None
                and step.output_column != step.target_column
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Replacement transformation cannot create a new output column",
                )
            if step.kind == "boolean_to_integer":
                column_types[step.target_column] = "numeric"
            elif step.kind in {"trim_whitespace", "lowercase", "uppercase"}:
                column_types[step.target_column] = "text"

    if seen_orders and seen_orders != set(range(len(seen_orders))):
        raise HTTPException(
            status_code=400,
            detail="Transformation step orders must be contiguous starting at zero",
        )
