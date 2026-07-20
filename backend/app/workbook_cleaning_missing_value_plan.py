from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException

from .workbook_cleaning_contract import WorkbookMissingValuePlan


def is_blank_value(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def column_types_by_name(worksheet: dict[str, Any]) -> dict[str, str]:
    schema = worksheet.get("schema")
    if not isinstance(schema, list):
        return {}
    return {
        str(column.get("name")): str(column.get("inferred_type") or "text")
        for column in schema
        if isinstance(column, dict) and column.get("name")
    }


def validate_custom_value(strategy: str, custom_value: Any, inferred_type: str) -> str:
    if custom_value is None or str(custom_value).strip() == "":
        raise HTTPException(status_code=400, detail="Missing-value custom value is required")
    value = str(custom_value).strip()
    if inferred_type == "numeric":
        try:
            parsed = float(value)
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail="Numeric custom missing-value must be a finite number",
            ) from error
        if parsed != parsed or parsed in (float("inf"), float("-inf")):
            raise HTTPException(
                status_code=400,
                detail="Numeric custom missing-value must be a finite number",
            )
    if strategy == "custom_date":
        try:
            date.fromisoformat(value)
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail="Custom date missing-value must use yyyy-mm-dd",
            ) from error
    return value


def fill_value_for_missing_strategy(
    *,
    rows: list[dict[str, Any]],
    column_name: str,
    inferred_type: str,
    strategy: str,
    custom_value: Any,
) -> str:
    if strategy == "fill_zero":
        if inferred_type != "numeric":
            raise HTTPException(status_code=400, detail="fill_zero is supported for numeric columns only")
        return "0"
    if strategy in ("fill_mean", "fill_median"):
        if inferred_type != "numeric":
            raise HTTPException(
                status_code=400,
                detail=f"{strategy} is supported for numeric columns only",
            )
        values: list[float] = []
        for row in rows:
            value = row.get(column_name)
            if is_blank_value(value):
                continue
            try:
                values.append(float(str(value)))
            except ValueError:
                continue
        if not values:
            raise HTTPException(
                status_code=400,
                detail=f"{strategy} requires at least one usable numeric value",
            )
        values.sort()
        if strategy == "fill_mean":
            return str(sum(values) / len(values))
        midpoint = len(values) // 2
        if len(values) % 2:
            return str(values[midpoint])
        return str((values[midpoint - 1] + values[midpoint]) / 2)
    if strategy == "mark_unknown":
        if inferred_type not in ("text", "categorical"):
            raise HTTPException(
                status_code=400,
                detail='mark_unknown is supported for text and categorical columns only',
            )
        return "Unknown"
    if strategy == "fill_mode":
        if inferred_type not in ("text", "categorical"):
            raise HTTPException(
                status_code=400,
                detail="fill_mode is supported for text and categorical columns only",
            )
        counts: dict[str, int] = {}
        for row in rows:
            value = row.get(column_name)
            if is_blank_value(value):
                continue
            text = str(value)
            counts[text] = counts.get(text, 0) + 1
        if not counts:
            raise HTTPException(
                status_code=400,
                detail="fill_mode requires at least one populated text or categorical value",
            )
        return sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    if strategy == "fill_custom":
        if inferred_type == "date":
            raise HTTPException(
                status_code=400,
                detail="fill_custom is not supported for date columns; use custom_date",
            )
        return validate_custom_value(strategy, custom_value, inferred_type)
    if strategy == "custom_date":
        if inferred_type != "date":
            raise HTTPException(status_code=400, detail="custom_date is supported for date columns only")
        return validate_custom_value(strategy, custom_value, inferred_type)
    raise HTTPException(status_code=400, detail="Unsupported column missing-value strategy")


def apply_missing_value_plan_to_rows(
    *,
    rows: list[dict[str, Any]],
    output_columns: list[str],
    worksheet: dict[str, Any],
    missing_value_plan: WorkbookMissingValuePlan | None,
) -> tuple[list[dict[str, Any]], dict[str, Any], bool]:
    if missing_value_plan is None:
        return rows, empty_missing_value_summary(), False

    column_types = column_types_by_name(worksheet)
    output_column_set = set(output_columns)
    decisions_applied: list[dict[str, Any]] = []
    operations: list[dict[str, Any]] = []
    changed_columns: set[str] = set()
    has_change = False
    working_rows = [dict(row) for row in rows]
    kept_row_indexes = list(range(len(working_rows)))

    rows_removed = 0
    if missing_value_plan.worksheet_strategy == "remove_mostly_blank_rows":
        threshold = (len(output_columns) // 2) + 1
        kept_rows: list[dict[str, Any]] = []
        next_kept_indexes: list[int] = []
        for row_index, row in enumerate(working_rows):
            blank_count = sum(1 for column in output_columns if is_blank_value(row.get(column)))
            if blank_count >= threshold:
                rows_removed += 1
            else:
                kept_rows.append(row)
                next_kept_indexes.append(kept_row_indexes[row_index])
        working_rows = kept_rows
        kept_row_indexes = next_kept_indexes
        has_change = rows_removed > 0
        operation = {
            "strategy": "remove_mostly_blank_rows",
            "scope": "worksheet",
            "rows_changed": rows_removed,
            "affected_rows": rows_removed,
            "explanation": "Rows with blanks in more than half of the cleaned working-copy fields were removed.",
        }
        decisions_applied.append(operation)
        operations.append(operation)
    elif missing_value_plan.worksheet_strategy in ("leave_unchanged", "layout_space", "decide_per_column"):
        operation = {
            "strategy": missing_value_plan.worksheet_strategy,
            "scope": "worksheet",
            "rows_changed": 0,
            "affected_rows": 0,
            "explanation": "Worksheet-level missing-value strategy was recorded without changing values.",
        }
        decisions_applied.append(operation)
        operations.append(operation)
    else:
        raise HTTPException(status_code=400, detail="Unsupported worksheet missing-value strategy")

    cells_filled = 0
    for decision in missing_value_plan.column_decisions:
        column_name = decision.column_name
        if column_name not in column_types or column_name not in output_column_set:
            raise HTTPException(status_code=400, detail=f"Unknown missing-value column: {column_name}")
        fill_value = fill_value_for_missing_strategy(
            rows=working_rows,
            column_name=column_name,
            inferred_type=column_types[column_name],
            strategy=decision.strategy,
            custom_value=decision.custom_value,
        )
        rows_changed = 0
        for row in working_rows:
            if is_blank_value(row.get(column_name)):
                row[column_name] = fill_value
                rows_changed += 1
        if rows_changed:
            has_change = True
            changed_columns.add(column_name)
            cells_filled += rows_changed
        operation = {
            "column_name": column_name,
            "strategy": decision.strategy,
            "rows_changed": rows_changed,
            "affected_cells": rows_changed,
            "preview_value": fill_value,
            "explanation": "Blank values were updated in the cleaned working copy only.",
        }
        decisions_applied.append(operation)
        operations.append(operation)

    summary = {
        "worksheet_strategy": missing_value_plan.worksheet_strategy,
        "decisions_applied": decisions_applied,
        "columns_changed": sorted(changed_columns),
        "columns_changed_count": len(changed_columns),
        "cells_filled": cells_filled,
        "rows_removed": rows_removed,
        "operations": operations,
        "has_changes": has_change,
        "kept_row_indexes": kept_row_indexes,
    }
    return working_rows, summary, has_change


def empty_missing_value_summary() -> dict[str, Any]:
    return {
        "worksheet_strategy": None,
        "decisions_applied": [],
        "columns_changed": [],
        "columns_changed_count": 0,
        "cells_filled": 0,
        "rows_removed": 0,
        "operations": [],
        "has_changes": False,
        "kept_row_indexes": [],
    }
