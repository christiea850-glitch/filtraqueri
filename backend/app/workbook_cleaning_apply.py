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
) -> dict[str, Any]:
    """Apply the cleaning recipe to a new DuckDB table without mutating sources.

    The original uploaded workbook file, the original analysis VIEW (`data`),
    and the per-worksheet source tables are all left untouched. If the
    recipe is empty (clean table, nothing to remove), no DuckDB write
    happens and a `no_recipe_needed` response is returned.
    """
    if not duckdb_path.exists():
        raise HTTPException(status_code=404, detail="Dataset session storage is missing")

    plan = compute_cleaning_recipe_plan(workbook_path=workbook_path, worksheet=worksheet)
    clamped_preview_limit = min(max(row_limit_preview, 1), MAX_CLEANING_PREVIEW_ROWS)

    if plan.get("is_empty") or not plan.get("recipe"):
        return _no_op_response(
            dataset_id=dataset_id,
            plan=plan,
            row_limit_preview=clamped_preview_limit,
        )

    output_columns: list[str] = plan["output_columns"]
    cleaned_rows: list[dict[str, Any]] = plan["rows"]
    if not output_columns:
        return _no_op_response(
            dataset_id=dataset_id,
            plan=plan,
            row_limit_preview=clamped_preview_limit,
        )

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
        "preview_rows": preview_rows,
        "preview_row_limit": clamped_preview_limit,
        "message": (
            "Cleanup was applied to a working copy. The original workbook was not changed."
        ),
    }
