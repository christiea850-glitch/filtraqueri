"""Apply a worksheet cleaning recipe to a new DuckDB working copy.

This module is the K1 / H3C-1 companion to `workbook_cleaning_preview.py`.
It shares the same row-level scoring and recipe logic via
`compute_cleaning_recipe_plan`, then writes the full cleaned row set into
a *new* DuckDB table named `cleaned_<safe_worksheet_id>`. The original
uploaded XLSX, the per-worksheet source tables, and the active analysis
VIEW (`data`) are all left untouched. The endpoint that wraps this helper
persists a `cleaned_working_copies` entry on the workbook metadata so the
operation is reversible (the working copy can be dropped later without
touching the source table).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import duckdb
from fastapi import HTTPException

from .workbook_cleaning_contract import (
    WorkbookMissingValuePlan,
    WorkbookStructuralDecisionPlan,
    validate_missing_value_plan_scope,
)
from .workbook_cleaning_preview import (
    MAX_CLEANING_PREVIEW_ROWS,
    compute_cleaning_recipe_plan,
)


MAX_CLEANED_TABLE_NAME_LENGTH = 120
CLEANED_TABLE_PREFIX = "cleaned_"


def _quote_identifier(identifier: str) -> str:
    escaped_identifier = identifier.replace('"', '""')
    return f'"{escaped_identifier}"'


def build_cleaned_table_name(worksheet_id: str) -> str:
    """Build a safe, deterministic DuckDB table name for a cleaned working copy.

    The same `worksheet_id` always maps to the same cleaned table name,
    which makes the apply operation idempotent: re-running it drops and
    recreates the same table rather than accumulating orphaned tables.
    """
    safe = re.sub(r"[^A-Za-z0-9_]", "_", worksheet_id).strip("_").lower()
    if not safe:
        safe = "worksheet"
    candidate = f"{CLEANED_TABLE_PREFIX}{safe}"
    return candidate[:MAX_CLEANED_TABLE_NAME_LENGTH]


def _to_varchar_value(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def _is_blank_value(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _column_types_by_name(worksheet: dict[str, Any]) -> dict[str, str]:
    schema = worksheet.get("schema")
    if not isinstance(schema, list):
        return {}
    return {
        str(column.get("name")): str(column.get("inferred_type") or "text")
        for column in schema
        if isinstance(column, dict) and column.get("name")
    }


def _validate_custom_value(strategy: str, custom_value: Any, inferred_type: str) -> str:
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
        from datetime import date

        try:
            date.fromisoformat(value)
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail="Custom date missing-value must use yyyy-mm-dd",
            ) from error
    return value


def _fill_value_for_missing_strategy(
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
            if _is_blank_value(value):
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
            if _is_blank_value(value):
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
        return _validate_custom_value(strategy, custom_value, inferred_type)
    if strategy == "custom_date":
        if inferred_type != "date":
            raise HTTPException(status_code=400, detail="custom_date is supported for date columns only")
        return _validate_custom_value(strategy, custom_value, inferred_type)
    raise HTTPException(status_code=400, detail="Unsupported column missing-value strategy")


def _apply_missing_value_plan_to_rows(
    *,
    rows: list[dict[str, Any]],
    output_columns: list[str],
    worksheet: dict[str, Any],
    missing_value_plan: WorkbookMissingValuePlan | None,
) -> tuple[list[dict[str, Any]], dict[str, Any], bool]:
    if missing_value_plan is None:
        return rows, {
            "worksheet_strategy": None,
            "decisions_applied": [],
            "columns_changed": [],
            "rows_removed": 0,
        }, False

    column_types = _column_types_by_name(worksheet)
    output_column_set = set(output_columns)
    decisions_applied: list[dict[str, Any]] = []
    changed_columns: set[str] = set()
    has_change = False
    working_rows = [dict(row) for row in rows]

    rows_removed = 0
    if missing_value_plan.worksheet_strategy == "remove_mostly_blank_rows":
        threshold = (len(output_columns) // 2) + 1
        kept_rows: list[dict[str, Any]] = []
        for row in working_rows:
            blank_count = sum(1 for column in output_columns if _is_blank_value(row.get(column)))
            if blank_count >= threshold:
                rows_removed += 1
            else:
                kept_rows.append(row)
        working_rows = kept_rows
        has_change = rows_removed > 0
        decisions_applied.append(
            {
                "strategy": "remove_mostly_blank_rows",
                "scope": "worksheet",
                "rows_changed": rows_removed,
                "explanation": "Rows with blanks in more than half of the cleaned working-copy fields were removed.",
            }
        )
    elif missing_value_plan.worksheet_strategy in ("leave_unchanged", "layout_space", "decide_per_column"):
        decisions_applied.append(
            {
                "strategy": missing_value_plan.worksheet_strategy,
                "scope": "worksheet",
                "rows_changed": 0,
                "explanation": "Worksheet-level missing-value strategy was recorded without changing values.",
            }
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported worksheet missing-value strategy")

    for decision in missing_value_plan.column_decisions:
        column_name = decision.column_name
        if column_name not in column_types or column_name not in output_column_set:
            raise HTTPException(status_code=400, detail=f"Unknown missing-value column: {column_name}")
        fill_value = _fill_value_for_missing_strategy(
            rows=working_rows,
            column_name=column_name,
            inferred_type=column_types[column_name],
            strategy=decision.strategy,
            custom_value=decision.custom_value,
        )
        rows_changed = 0
        for row in working_rows:
            if _is_blank_value(row.get(column_name)):
                row[column_name] = fill_value
                rows_changed += 1
        if rows_changed:
            has_change = True
            changed_columns.add(column_name)
        decisions_applied.append(
            {
                "column_name": column_name,
                "strategy": decision.strategy,
                "rows_changed": rows_changed,
                "explanation": "Blank values were updated in the cleaned working copy only.",
            }
        )

    return working_rows, {
        "worksheet_strategy": missing_value_plan.worksheet_strategy,
        "decisions_applied": decisions_applied,
        "columns_changed": sorted(changed_columns),
        "rows_removed": rows_removed,
    }, has_change


def _no_op_response(
    *,
    dataset_id: str,
    plan: dict[str, Any],
    row_limit_preview: int,
) -> dict[str, Any]:
    return {
        "status": "no_recipe_needed",
        "dataset_id": dataset_id,
        "worksheet_id": plan["worksheet_id"],
        "worksheet_name": plan["worksheet_name"],
        "cleaned_table_name": None,
        "before": plan["before"],
        "after": {
            "row_count": plan["before"]["row_count"],
            "column_count": plan["before"]["column_count"],
            "columns": plan.get("output_columns", []),
        },
        "recipe_applied": [],
        "excluded": plan.get("excluded", {}),
        "structural_decision_summary": plan.get(
            "structural_decision_summary",
            {"accepted": [], "preserved": [], "deferred": []},
        ),
        "missing_value_summary": {
            "worksheet_strategy": None,
            "decisions_applied": [],
            "columns_changed": [],
            "rows_removed": 0,
        },
        "preview_rows": [],
        "preview_row_limit": row_limit_preview,
        "message": (
            "This worksheet does not need any cleanup. "
            "No cleaned working copy was created. The original workbook was not changed."
        ),
    }


def apply_cleaning_recipe_to_working_copy(
    *,
    workbook_path: Path,
    worksheet: dict[str, Any],
    duckdb_path: Path,
    dataset_id: str,
    row_limit_preview: int = 25,
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None,
    missing_value_plan: WorkbookMissingValuePlan | None = None,
) -> dict[str, Any]:
    """Apply the cleaning recipe to a new DuckDB table without mutating sources.

    The original uploaded workbook file, the original analysis VIEW (`data`),
    and the per-worksheet source tables are all left untouched. If the
    recipe is empty (clean table, nothing to remove), no DuckDB write
    happens and a `no_recipe_needed` response is returned.
    """
    if not duckdb_path.exists():
        raise HTTPException(status_code=404, detail="Dataset session storage is missing")

    plan = compute_cleaning_recipe_plan(
        workbook_path=workbook_path,
        worksheet=worksheet,
        structural_decision_plan=structural_decision_plan,
    )
    validate_missing_value_plan_scope(missing_value_plan, str(plan["worksheet_id"]))
    clamped_preview_limit = min(max(row_limit_preview, 1), MAX_CLEANING_PREVIEW_ROWS)

    output_columns: list[str] = plan.get("output_columns", [])
    cleaned_rows: list[dict[str, Any]] = plan.get("rows", [])
    rows_after_missing_values, missing_value_summary, has_missing_value_changes = (
        _apply_missing_value_plan_to_rows(
            rows=cleaned_rows,
            output_columns=output_columns,
            worksheet=worksheet,
            missing_value_plan=missing_value_plan,
        )
    )
    has_structural_changes = bool(plan.get("recipe"))

    if plan.get("is_empty") or (not has_structural_changes and not has_missing_value_changes):
        return _no_op_response(
            dataset_id=dataset_id,
            plan=plan,
            row_limit_preview=clamped_preview_limit,
        )

    if not output_columns:
        return _no_op_response(
            dataset_id=dataset_id,
            plan=plan,
            row_limit_preview=clamped_preview_limit,
        )
    cleaned_rows = rows_after_missing_values

    cleaned_table_name = build_cleaned_table_name(str(plan["worksheet_id"] or ""))
    quoted_table_name = _quote_identifier(cleaned_table_name)
    column_definitions = ", ".join(
        f"{_quote_identifier(column)} VARCHAR" for column in output_columns
    )

    try:
        with duckdb.connect(str(duckdb_path)) as connection:
            # Idempotent: re-running the apply for the same worksheet drops
            # the previously written cleaned table and recreates it from
            # the latest recipe. Source tables and the active VIEW are not
            # referenced here at all.
            connection.execute(f"DROP TABLE IF EXISTS {quoted_table_name}")
            connection.execute(f"CREATE TABLE {quoted_table_name} ({column_definitions})")
            if cleaned_rows:
                placeholders = ", ".join(["?"] * len(output_columns))
                connection.executemany(
                    f"INSERT INTO {quoted_table_name} VALUES ({placeholders})",
                    [
                        tuple(_to_varchar_value(row.get(column)) for column in output_columns)
                        for row in cleaned_rows
                    ],
                )
    except duckdb.Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"Cleaned working copy could not be created: {error}",
        ) from error

    preview_rows = cleaned_rows[:clamped_preview_limit]

    return {
        "status": "applied_to_working_copy",
        "dataset_id": dataset_id,
        "worksheet_id": plan["worksheet_id"],
        "worksheet_name": plan["worksheet_name"],
        "cleaned_table_name": cleaned_table_name,
        "before": plan["before"],
        "after": {
            "row_count": len(cleaned_rows),
            "column_count": len(output_columns),
            "columns": output_columns,
        },
        "recipe_applied": plan["recipe"],
        "excluded": plan["excluded"],
        "structural_decision_summary": plan.get(
            "structural_decision_summary",
            {"accepted": [], "preserved": [], "deferred": []},
        ),
        "missing_value_summary": missing_value_summary,
        "preview_rows": preview_rows,
        "preview_row_limit": clamped_preview_limit,
        "message": (
            "Cleanup was applied to a working copy. The original workbook was not changed."
        ),
    }
