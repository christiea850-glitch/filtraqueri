"""Apply user-confirmed missing-value decisions to one cleaned working table."""

from __future__ import annotations

from datetime import date
from math import ceil
from pathlib import Path
from typing import Any

import duckdb
from fastapi import HTTPException


SUPPORTED_COLUMN_STRATEGIES = {
    "leave_unchanged",
    "fill_mean",
    "fill_median",
    "fill_zero",
    "fill_mode",
    "fill_custom",
    "mark_unknown",
    "custom_date",
    "flag_for_review",
}


def _quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) * 2)}"'


def _blank_predicate(column_name: str) -> str:
    identifier = _quote_identifier(column_name)
    return f"({identifier} IS NULL OR TRIM(CAST({identifier} AS VARCHAR)) = '')"


def _safe_custom_value(strategy: str, custom_value: Any, inferred_type: str) -> str:
    value = str(custom_value or "").strip()
    if not value:
        raise ValueError("A custom value is required.")
    if inferred_type == "numeric":
        float(value)
    if strategy == "custom_date":
        date.fromisoformat(value)
    return value


def _fill_value_for_strategy(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    column_name: str,
    inferred_type: str,
    strategy: str,
    custom_value: Any,
) -> str | None:
    identifier = _quote_identifier(column_name)
    quoted_table = _quote_identifier(table_name)
    nonblank = f"NOT {_blank_predicate(column_name)}"

    if strategy == "mark_unknown":
        if inferred_type not in ("text", "categorical"):
            raise ValueError('Mark as "Unknown" is supported for text and categorical columns only.')
        return "Unknown"
    if strategy == "fill_zero":
        if inferred_type != "numeric":
            raise ValueError("Fill with zero is supported for numeric columns only.")
        return "0"
    if strategy in ("fill_custom", "custom_date"):
        if strategy == "custom_date" and inferred_type != "date":
            raise ValueError("Custom date is supported for date columns only.")
        return _safe_custom_value(strategy, custom_value, inferred_type)
    if strategy in ("fill_mean", "fill_median"):
        if inferred_type != "numeric":
            raise ValueError(f"{strategy.replace('_', ' ').title()} is supported for numeric columns only.")
        aggregate = "AVG" if strategy == "fill_mean" else "MEDIAN"
        row = connection.execute(
            f"""
            SELECT {aggregate}(TRY_CAST({identifier} AS DOUBLE))
            FROM {quoted_table}
            WHERE {nonblank} AND TRY_CAST({identifier} AS DOUBLE) IS NOT NULL
            """
        ).fetchone()
        if not row or row[0] is None:
            raise ValueError("No numeric values were available to compute a fill value.")
        return str(row[0])
    if strategy == "fill_mode":
        if inferred_type not in ("text", "categorical"):
            raise ValueError("Mode fill is supported for text and categorical columns only.")
        row = connection.execute(
            f"""
            SELECT CAST({identifier} AS VARCHAR), COUNT(*) AS value_count
            FROM {quoted_table}
            WHERE {nonblank}
            GROUP BY {identifier}
            ORDER BY value_count DESC, CAST({identifier} AS VARCHAR) ASC
            LIMIT 1
            """
        ).fetchone()
        if not row:
            raise ValueError("No populated values were available to compute a mode.")
        return str(row[0])
    return None


def apply_missing_value_decisions_to_cleaned_copy(
    *,
    duckdb_path: Path,
    cleaned_table_name: str,
    worksheet_schema: list[dict[str, Any]],
    worksheet_name: str,
    worksheet_strategy: str,
    column_decisions: list[dict[str, Any]],
) -> dict[str, Any]:
    if not duckdb_path.exists():
        raise HTTPException(status_code=404, detail="Dataset session storage is missing")

    trusted_columns = {
        str(column.get("name")): str(column.get("inferred_type") or "text")
        for column in worksheet_schema
        if isinstance(column, dict) and column.get("name")
    }
    applied: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    changed_columns: set[str] = set()
    rows_removed = 0

    try:
        with duckdb.connect(str(duckdb_path)) as connection:
            table_columns = {
                row[0]
                for row in connection.execute(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'main' AND table_name = ?
                    """,
                    [cleaned_table_name],
                ).fetchall()
            }
            if not table_columns:
                raise HTTPException(status_code=404, detail="Cleaned working copy table was not found")

            connection.execute("BEGIN TRANSACTION")
            try:
                if worksheet_strategy in ("leave_unchanged", "layout_space"):
                    applied.append(
                        {
                            "strategy": worksheet_strategy,
                            "scope": "worksheet",
                            "explanation": (
                                "Blank values were intentionally left unchanged in the cleaned working copy."
                                if worksheet_strategy == "leave_unchanged"
                                else "Blank values were recorded as template/layout space and left unchanged."
                            ),
                        }
                    )
                if worksheet_strategy == "remove_mostly_blank_rows":
                    usable_columns = sorted(table_columns)
                    if usable_columns:
                        blank_count = " + ".join(
                            f"CASE WHEN {_blank_predicate(column)} THEN 1 ELSE 0 END"
                            for column in usable_columns
                        )
                        threshold = ceil(len(usable_columns) / 2)
                        rows_removed = connection.execute(
                            f"""
                            DELETE FROM {_quote_identifier(cleaned_table_name)}
                            WHERE ({blank_count}) >= ?
                            RETURNING 1
                            """,
                            [threshold],
                        ).fetchall()
                        rows_removed = len(rows_removed)
                        applied.append(
                            {
                                "strategy": worksheet_strategy,
                                "scope": "worksheet",
                                "explanation": "Rows with blanks in at least half of the cleaned working-copy fields were removed.",
                            }
                        )

                for decision in column_decisions:
                    column_name = str(decision.get("column_name") or "")
                    strategy = str(decision.get("strategy") or "")
                    if column_name not in trusted_columns or column_name not in table_columns:
                        skipped.append(
                            {
                                "column_name": column_name,
                                "strategy": strategy,
                                "explanation": "Column was not present in the trusted cleaned working-copy schema.",
                            }
                        )
                        continue
                    if strategy not in SUPPORTED_COLUMN_STRATEGIES:
                        skipped.append(
                            {
                                "column_name": column_name,
                                "strategy": strategy,
                                "explanation": "Strategy is not supported for cleaned working-copy apply.",
                            }
                        )
                        continue
                    if strategy in ("leave_unchanged", "flag_for_review"):
                        applied.append(
                            {
                                "column_name": column_name,
                                "strategy": strategy,
                                "rows_changed": 0,
                                "explanation": "Blank values were intentionally left unchanged.",
                            }
                        )
                        continue

                    try:
                        fill_value = _fill_value_for_strategy(
                            connection,
                            cleaned_table_name,
                            column_name,
                            trusted_columns[column_name],
                            strategy,
                            decision.get("custom_value"),
                        )
                    except ValueError as error:
                        skipped.append(
                            {
                                "column_name": column_name,
                                "strategy": strategy,
                                "explanation": str(error),
                            }
                        )
                        continue

                    if fill_value is None:
                        skipped.append(
                            {
                                "column_name": column_name,
                                "strategy": strategy,
                                "explanation": "Strategy did not produce a safe fill value.",
                            }
                        )
                        continue
                    rows_changed = connection.execute(
                        f"""
                        UPDATE {_quote_identifier(cleaned_table_name)}
                        SET {_quote_identifier(column_name)} = ?
                        WHERE {_blank_predicate(column_name)}
                        RETURNING 1
                        """,
                        [fill_value],
                    ).fetchall()
                    changed_columns.add(column_name)
                    applied.append(
                        {
                            "column_name": column_name,
                            "strategy": strategy,
                            "rows_changed": len(rows_changed),
                            "explanation": "Blank values were updated in the cleaned working copy only.",
                        }
                    )

                row_count = connection.execute(
                    f"SELECT COUNT(*) FROM {_quote_identifier(cleaned_table_name)}"
                ).fetchone()[0]
                preview_result = connection.execute(
                    f"SELECT * FROM {_quote_identifier(cleaned_table_name)} LIMIT 10"
                )
                preview_columns = [description[0] for description in preview_result.description]
                preview_rows = [
                    dict(zip(preview_columns, row))
                    for row in preview_result.fetchall()
                ]
                connection.execute("COMMIT")
            except Exception:
                connection.execute("ROLLBACK")
                raise
    except HTTPException:
        raise
    except duckdb.Error as error:
        raise HTTPException(
            status_code=500,
            detail=f"Missing-value decisions could not be applied: {error}",
        ) from error

    return {
        "status": "applied_to_cleaned_working_copy",
        "worksheet_name": worksheet_name,
        "cleaned_table_name": cleaned_table_name,
        "decisions_applied": applied,
        "columns_changed": sorted(changed_columns),
        "rows_removed": rows_removed,
        "skipped_decisions": skipped,
        "row_count": row_count,
        "preview_rows": preview_rows,
        "message": "Missing-value decisions were applied to the cleaned working copy. Original workbook unchanged.",
    }
