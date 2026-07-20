from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isfinite, log, sqrt
from typing import Any

from fastapi import HTTPException

from .workbook_cleaning_contract import (
    WorkbookTransformationPlan,
    WorkbookTransformationStep,
)
from .workbook_cleaning_missing_value_plan import is_blank_value

TEXT_TYPES = {"text", "categorical"}
NUMERIC_TYPES = {"numeric"}
DATE_TYPES = {"date"}
BOOLEAN_TYPES = {"boolean"}


@dataclass(frozen=True)
class TransformationResult:
    rows: list[dict[str, Any]]
    columns: list[str]
    schema: dict[str, str]
    transformation_summary: dict[str, Any]
    has_changes: bool


def empty_transformation_summary() -> dict[str, Any]:
    return {
        "status": "no_changes",
        "step_count": 0,
        "changed_columns": [],
        "added_columns": [],
        "cells_changed": 0,
        "operations": [],
        "warnings": [],
    }


def _http(detail: str) -> None:
    raise HTTPException(status_code=400, detail=detail)


def _parse_float(value: Any, column: str) -> float | None:
    if is_blank_value(value):
        return None
    try:
        parsed = float(str(value))
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=400, detail=f"Column {column} contains non-numeric values"
        ) from error
    if not isfinite(parsed):
        _http(f"Column {column} contains non-finite numeric values")
    return parsed


def _parse_date(value: Any, column: str) -> date | None:
    if is_blank_value(value):
        return None
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        _http(f"Column {column} contains non-date values")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(
            status_code=400, detail=f"Column {column} must use strict yyyy-mm-dd dates"
        ) from error


def _assert_type(
    schema: dict[str, str], column: str, allowed: set[str], kind: str
) -> None:
    inferred = schema.get(column, "text")
    if inferred not in allowed:
        _http(f"Transformation {kind} is invalid for target datatype")


def _assert_output(columns: list[str], step: WorkbookTransformationStep) -> str:
    output = step.output_column
    if not output:
        _http("Transformation output_column is required")
    if output in columns:
        _http("Transformation output_column collides with an existing column")
    return output


def _quantile(sorted_values: list[float], percentile: float) -> float:
    # Hyndman/Fan type 7 linear interpolation, used by NumPy/Pandas default quantile.
    if not sorted_values:
        _http("Percentile capping requires at least one numeric value")
    if len(sorted_values) == 1:
        return sorted_values[0]
    rank = (len(sorted_values) - 1) * (percentile / 100.0)
    lower = int(rank)
    upper = min(lower + 1, len(sorted_values) - 1)
    fraction = rank - lower
    return (
        sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * fraction
    )


def _changed(before: Any, after: Any) -> bool:
    return before != after


def apply_transformation_plan_to_rows(
    *,
    rows: list[dict[str, Any]],
    columns: list[str],
    schema: dict[str, str],
    transformation_plan: WorkbookTransformationPlan | None,
) -> TransformationResult:
    working_rows = [dict(row) for row in rows]
    working_columns = list(columns)
    working_schema = dict(schema)
    if transformation_plan is None or not transformation_plan.steps:
        return TransformationResult(
            working_rows,
            working_columns,
            working_schema,
            empty_transformation_summary(),
            False,
        )

    operations: list[dict[str, Any]] = []
    changed_columns: set[str] = set()
    added_columns: list[str] = []
    total_cells_changed = 0

    for step in sorted(transformation_plan.steps, key=lambda item: item.order):
        if step.target_column not in working_columns:
            _http(f"Unknown transformation target column: {step.target_column}")
        kind = step.kind
        affected = 0
        detail: str | None = None
        output_column: str | None = None

        if kind in {"trim_whitespace", "lowercase", "uppercase"}:
            _assert_type(working_schema, step.target_column, TEXT_TYPES, kind)
            for row in working_rows:
                value = row.get(step.target_column)
                if is_blank_value(value):
                    continue
                if not isinstance(value, str):
                    _http(
                        f"Column {step.target_column} contains non-string text values"
                    )
                new_value = (
                    value.strip()
                    if kind == "trim_whitespace"
                    else value.lower() if kind == "lowercase" else value.upper()
                )
                if _changed(value, new_value):
                    row[step.target_column] = new_value
                    affected += 1
            working_schema[step.target_column] = "text"
        elif kind == "cap_outliers_percentile":
            _assert_type(working_schema, step.target_column, NUMERIC_TYPES, kind)
            p = step.parameters or {}
            lower_p = float(p.get("lower_percentile"))
            upper_p = float(p.get("upper_percentile"))
            if lower_p < 0 or upper_p > 100 or lower_p >= upper_p:
                _http("Percentile bounds are invalid")
            values = sorted(
                v
                for v in (
                    _parse_float(row.get(step.target_column), step.target_column)
                    for row in working_rows
                )
                if v is not None
            )
            lower_cap = _quantile(values, lower_p)
            upper_cap = _quantile(values, upper_p)
            for row in working_rows:
                value = _parse_float(row.get(step.target_column), step.target_column)
                if value is None:
                    continue
                new_value = min(max(value, lower_cap), upper_cap)
                if _changed(value, new_value):
                    row[step.target_column] = new_value
                    affected += 1
            detail = f"type_7_quantile lower_cap={lower_cap} upper_cap={upper_cap}"
            working_schema[step.target_column] = "numeric"
        elif kind in {"log_transform", "z_score_scale", "min_max_scale"}:
            _assert_type(working_schema, step.target_column, NUMERIC_TYPES, kind)
            output_column = _assert_output(working_columns, step)
            values = [
                _parse_float(row.get(step.target_column), step.target_column)
                for row in working_rows
            ]
            numeric_values = [v for v in values if v is not None]
            if kind == "log_transform":
                if any(v < 0 for v in numeric_values):
                    _http(
                        "log_transform uses natural log1p and rejects values below zero"
                    )
                transformed = [None if v is None else log(1.0 + v) for v in values]
                detail = "natural log1p"
            elif kind == "z_score_scale":
                if not numeric_values:
                    _http("z_score_scale requires at least one numeric value")
                mean = sum(numeric_values) / len(numeric_values)
                std = sqrt(
                    sum((v - mean) ** 2 for v in numeric_values) / len(numeric_values)
                )
                transformed = [
                    None if v is None else 0.0 if std == 0 else (v - mean) / std
                    for v in values
                ]
                detail = "population_standard_deviation; constant columns become 0.0"
            else:
                if not numeric_values:
                    _http("min_max_scale requires at least one numeric value")
                min_v = min(numeric_values)
                max_v = max(numeric_values)
                span = max_v - min_v
                transformed = [
                    None if v is None else 0.0 if span == 0 else (v - min_v) / span
                    for v in values
                ]
                detail = "constant columns become 0.0"
            for row, new_value in zip(working_rows, transformed):
                row[output_column] = new_value
                if new_value is not None:
                    affected += 1
            working_columns.append(output_column)
            working_schema[output_column] = "numeric"
            added_columns.append(output_column)
        elif kind in {
            "extract_year",
            "extract_month",
            "extract_quarter",
            "extract_day_of_week",
            "days_since",
        }:
            _assert_type(working_schema, step.target_column, DATE_TYPES, kind)
            output_column = _assert_output(working_columns, step)
            anchor = None
            if kind == "days_since":
                anchor = _parse_date(
                    (step.parameters or {}).get("anchor_date"), "anchor_date"
                )
                detail = f"UTC-independent date arithmetic against anchor_date={anchor.isoformat()}"
            for row in working_rows:
                parsed = _parse_date(row.get(step.target_column), step.target_column)
                if parsed is None:
                    row[output_column] = None
                    continue
                if kind == "extract_year":
                    new_value = parsed.year
                elif kind == "extract_month":
                    new_value = parsed.month
                elif kind == "extract_quarter":
                    new_value = ((parsed.month - 1) // 3) + 1
                elif kind == "extract_day_of_week":
                    new_value = parsed.isoweekday()
                else:
                    new_value = (anchor - parsed).days  # type: ignore[operator]
                row[output_column] = new_value
                affected += 1
            working_columns.append(output_column)
            working_schema[output_column] = "numeric"
            added_columns.append(output_column)
        elif kind == "boolean_to_integer":
            _assert_type(working_schema, step.target_column, BOOLEAN_TYPES, kind)
            destination = step.output_column or step.target_column
            if destination != step.target_column:
                output_column = _assert_output(working_columns, step)
                working_columns.append(output_column)
                added_columns.append(output_column)
            for row in working_rows:
                value = row.get(step.target_column)
                if is_blank_value(value):
                    if destination != step.target_column:
                        row[destination] = None
                    continue
                if isinstance(value, bool):
                    new_value = 1 if value else 0
                elif isinstance(value, str) and value.lower() in {"true", "false"}:
                    new_value = 1 if value.lower() == "true" else 0
                else:
                    _http(f"Column {step.target_column} contains non-boolean values")
                if destination == step.target_column:
                    if _changed(value, new_value):
                        affected += 1
                    row[destination] = new_value
                else:
                    row[destination] = new_value
                    affected += 1
            working_schema[destination] = "numeric"
        elif kind == "ordinal_encode":
            _assert_type(working_schema, step.target_column, TEXT_TYPES, kind)
            output_column = _assert_output(working_columns, step)
            order = list((step.parameters or {}).get("order") or [])
            if len(order) != len(set(order)):
                _http("Ordinal encoding category order contains duplicates")
            mapping = {str(value): index for index, value in enumerate(order)}
            for row in working_rows:
                value = row.get(step.target_column)
                if is_blank_value(value):
                    row[output_column] = None
                    continue
                key = str(value)
                if key not in mapping:
                    _http(
                        "Ordinal encoding found value outside configured category order"
                    )
                row[output_column] = mapping[key]
                affected += 1
            working_columns.append(output_column)
            working_schema[output_column] = "numeric"
            added_columns.append(output_column)
        elif kind == "frequency_encode":
            _assert_type(working_schema, step.target_column, TEXT_TYPES, kind)
            output_column = _assert_output(working_columns, step)
            counts: dict[str, int] = {}
            for row in working_rows:
                value = row.get(step.target_column)
                if not is_blank_value(value):
                    counts[str(value)] = counts.get(str(value), 0) + 1
            for row in working_rows:
                value = row.get(step.target_column)
                row[output_column] = (
                    None if is_blank_value(value) else counts[str(value)]
                )
                if not is_blank_value(value):
                    affected += 1
            detail = "count frequency"
            working_columns.append(output_column)
            working_schema[output_column] = "numeric"
            added_columns.append(output_column)
        else:
            _http(f"Transformation kind is blocked or unsupported: {kind}")

        if affected:
            changed_columns.add(output_column or step.target_column)
            total_cells_changed += affected
        operations.append(
            {
                "step_id": step.step_id,
                "order": step.order,
                "kind": kind,
                "operation": kind,
                "target_column": step.target_column,
                **({"output_column": output_column} if output_column else {}),
                "affected_cells": affected,
                "status": "changed" if affected else "no_changes",
                **({"detail": detail} if detail else {}),
            }
        )

    for row in working_rows:
        if set(row.keys()) != set(working_columns):
            _http("Transformed row/schema consistency validation failed")
    summary = {
        "status": "changed" if total_cells_changed or added_columns else "no_changes",
        "step_count": len(operations),
        "changed_columns": sorted(changed_columns),
        "added_columns": added_columns,
        "cells_changed": total_cells_changed,
        "operations": operations,
        "warnings": [],
    }
    return TransformationResult(
        working_rows,
        working_columns,
        working_schema,
        summary,
        summary["status"] == "changed",
    )
