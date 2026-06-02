from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .workbook_ingestion import (
    contiguous_header_width,
    is_blank_cell,
    looks_like_numeric_value,
    non_empty_values,
    normalize_cell_text,
    normalize_header,
    parse_xlsx_workbook,
    row_signature,
)


MAX_CLEANING_PREVIEW_ROWS = 25


def _evidence_rows(evidence: dict[str, Any]) -> list[int]:
    indexes: set[int] = set()
    row_index = evidence.get("row_index")
    if isinstance(row_index, int):
        indexes.add(row_index)

    row_indexes = evidence.get("row_indexes")
    if isinstance(row_indexes, list):
        indexes.update(index for index in row_indexes if isinstance(index, int))

    row_range = evidence.get("row_range")
    if (
        not indexes
        and isinstance(row_range, list)
        and len(row_range) == 2
        and all(isinstance(index, int) for index in row_range)
    ):
        start, end = sorted(row_range)
        indexes.update(range(start, end + 1))

    return sorted(indexes)


def _evidence_columns(evidence: dict[str, Any]) -> list[int]:
    column_range = evidence.get("column_range")
    if (
        isinstance(column_range, list)
        and len(column_range) == 2
        and all(isinstance(index, int) for index in column_range)
    ):
        start, end = sorted(column_range)
        return list(range(start, end + 1))
    return []


def _worksheet_evidence(worksheet: dict[str, Any]) -> list[dict[str, Any]]:
    normalization = worksheet.get("normalization")
    if not isinstance(normalization, dict):
        return []
    evidence = normalization.get("template_structure_evidence")
    return [item for item in evidence if isinstance(item, dict)] if isinstance(evidence, list) else []


def _rows_for_type(evidence: list[dict[str, Any]], evidence_type: str) -> list[int]:
    indexes = {
        index
        for item in evidence
        if item.get("type") == evidence_type
        for index in _evidence_rows(item)
    }
    return sorted(indexes)


def _columns_for_type(evidence: list[dict[str, Any]], evidence_type: str) -> list[int]:
    indexes = {
        index
        for item in evidence
        if item.get("type") == evidence_type
        for index in _evidence_columns(item)
    }
    return sorted(indexes)


def _first_display_value(row: list[Any]) -> str | None:
    for value in row:
        if not is_blank_cell(value):
            return str(value).strip()
    return None


def _empty_excluded_counts() -> dict[str, int]:
    return {
        "repeated_headers": 0,
        "section_banners": 0,
        "date_title_rows": 0,
        "layout_rows": 0,
        "placeholder_rows": 0,
        "side_note_columns": 0,
    }


def _empty_preview(
    *,
    worksheet: dict[str, Any],
    row_limit: int,
) -> dict[str, Any]:
    return {
        "status": "preview_only",
        "worksheet_id": worksheet.get("worksheet_id"),
        "worksheet_name": worksheet.get("sheet_name"),
        "before": {
            "row_count": int(worksheet.get("row_count") or 0),
            "column_count": int(worksheet.get("column_count") or 0),
        },
        "after_preview": {
            "row_count": 0,
            "column_count": 0,
            "columns": [],
            "rows": [],
            "row_provenance": [],
        },
        "recipe": [],
        "excluded": _empty_excluded_counts(),
        "preview_row_limit": row_limit,
        "message": "This worksheet is empty, so there is no cleaning recipe to preview.",
    }


def _recipe_step(
    step_type: str,
    indexes: list[int],
    explanation: str,
    **extra: Any,
) -> dict[str, Any]:
    return {
        "type": step_type,
        "original_row_indexes": indexes,
        "explanation": explanation,
        **extra,
    }


def build_cleaning_recipe_preview(
    *,
    workbook_path: Path,
    worksheet: dict[str, Any],
    row_limit: int,
) -> dict[str, Any]:
    if workbook_path.suffix.lower() != ".xlsx":
        raise HTTPException(
            status_code=400,
            detail="Cleaning recipe preview currently supports XLSX workbooks only",
        )
    if not workbook_path.exists():
        raise HTTPException(status_code=404, detail="Original workbook file mapping is missing")

    clamped_row_limit = min(max(row_limit, 1), MAX_CLEANING_PREVIEW_ROWS)
    if worksheet.get("status") == "empty":
        return _empty_preview(worksheet=worksheet, row_limit=clamped_row_limit)
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail="Worksheet is not available for cleaning recipe preview",
        )

    sheets = parse_xlsx_workbook(workbook_path)
    worksheet_index = int(worksheet.get("original_index") or 0)
    if worksheet_index < 0 or worksheet_index >= len(sheets):
        raise HTTPException(status_code=404, detail="Original workbook worksheet is missing")

    raw_rows = sheets[worksheet_index].get("rows")
    if not isinstance(raw_rows, list):
        raw_rows = []
    normalization = worksheet.get("normalization")
    normalization = normalization if isinstance(normalization, dict) else {}
    header_row_index = normalization.get("header_row_index")
    if not isinstance(header_row_index, int) or header_row_index >= len(raw_rows):
        return _empty_preview(worksheet=worksheet, row_limit=clamped_row_limit)

    header_row = raw_rows[header_row_index]
    business_width = contiguous_header_width(header_row)
    if business_width <= 0:
        return _empty_preview(worksheet=worksheet, row_limit=clamped_row_limit)

    existing_headers: set[str] = set()
    business_columns = [
        normalize_header(value, index, existing_headers)[0]
        for index, value in enumerate(header_row[:business_width])
    ]
    header_signature = row_signature(header_row, business_width)
    evidence = _worksheet_evidence(worksheet)
    repeated_header_rows = _rows_for_type(evidence, "repeated_header")
    date_title_rows = _rows_for_type(evidence, "date_title_row")
    section_banner_rows = _rows_for_type(evidence, "section_banner")
    sparse_layout_rows = _rows_for_type(evidence, "sparse_layout_gap")
    placeholder_rows = _rows_for_type(evidence, "serial_only_placeholder_rows")
    side_note_columns = _columns_for_type(evidence, "side_note_region_candidate")
    repeated_missing_rows = _rows_for_type(evidence, "repeated_missing_pattern")

    repeated_header_set = set(repeated_header_rows)
    date_title_set = set(date_title_rows)
    section_banner_set = set(section_banner_rows)
    sparse_layout_set = set(sparse_layout_rows)
    placeholder_set = set(placeholder_rows)
    has_section_context = bool(date_title_rows or section_banner_rows)
    output_columns = [*business_columns]
    if has_section_context:
        output_columns.extend(["_section_date", "_section_label"])

    preview_rows: list[dict[str, Any]] = []
    row_provenance: list[dict[str, int]] = []
    cleaned_row_count = 0
    current_section_date: str | None = None
    current_section_label: str | None = None
    excluded = _empty_excluded_counts()
    excluded["side_note_columns"] = len(side_note_columns)
    counted_layout_rows: set[int] = set()
    counted_placeholder_rows: set[int] = set()
    counted_repeated_header_rows: set[int] = set()

    for original_row_index, raw_row in enumerate(raw_rows):
        row = raw_row if isinstance(raw_row, list) else []
        if original_row_index in date_title_set:
            current_section_date = _first_display_value(row) or current_section_date
            continue
        if original_row_index in section_banner_set:
            current_section_label = _first_display_value(row) or current_section_label
            continue
        if original_row_index <= header_row_index:
            continue

        populated_values = non_empty_values(row)
        if original_row_index in repeated_header_set or (
            populated_values and row_signature(row, business_width) == header_signature
        ):
            counted_repeated_header_rows.add(original_row_index)
            continue
        if not populated_values:
            counted_layout_rows.add(original_row_index)
            continue

        business_values = row[:business_width]
        first_business_value = normalize_cell_text(business_values[0]) if business_values else ""
        has_business_value_after_serial = any(
            not is_blank_cell(value) for value in business_values[1:]
        )
        has_only_header_shaped_serial = (
            first_business_value
            and first_business_value == header_signature[0]
            and not has_business_value_after_serial
        )
        if original_row_index in placeholder_set or (
            first_business_value
            and looks_like_numeric_value(first_business_value)
            and not has_business_value_after_serial
        ):
            counted_placeholder_rows.add(original_row_index)
            continue
        if has_only_header_shaped_serial:
            counted_layout_rows.add(original_row_index)
            continue
        if original_row_index in sparse_layout_set and not has_business_value_after_serial:
            counted_layout_rows.add(original_row_index)
            continue
        if not any(not is_blank_cell(value) for value in business_values):
            counted_layout_rows.add(original_row_index)
            continue

        values = {
            column: None if index >= len(row) or is_blank_cell(row[index]) else row[index]
            for index, column in enumerate(business_columns)
        }
        if has_section_context:
            values["_section_date"] = current_section_date
            values["_section_label"] = current_section_label

        if len(preview_rows) < clamped_row_limit:
            preview_rows.append(values)
            row_provenance.append(
                {
                    "preview_row_index": len(preview_rows) - 1,
                    "original_row_index": original_row_index,
                }
            )
        cleaned_row_count += 1

    excluded["repeated_headers"] = len(counted_repeated_header_rows)
    excluded["section_banners"] = len(section_banner_rows)
    excluded["date_title_rows"] = len(date_title_rows)
    excluded["layout_rows"] = len(counted_layout_rows)
    excluded["placeholder_rows"] = len(counted_placeholder_rows)

    recipe = []
    if repeated_header_rows:
        recipe.append(
            _recipe_step(
                "remove_repeated_header_rows",
                repeated_header_rows,
                "Repeated table headers are excluded from the cleaned analysis preview.",
            )
        )
    if section_banner_rows:
        recipe.append(
            _recipe_step(
                "remove_section_banner_rows",
                section_banner_rows,
                "Section banners are retained as context rather than ordinary data rows.",
            )
        )
    if has_section_context:
        recipe.append(
            _recipe_step(
                "carry_forward_section_context",
                sorted(set(date_title_rows + section_banner_rows)),
                "Detected section dates and labels are carried forward as context columns.",
                added_columns=["_section_date", "_section_label"],
            )
        )
    if sparse_layout_rows:
        recipe.append(
            _recipe_step(
                "ignore_layout_rows",
                sparse_layout_rows,
                "Blank and sparse layout separator rows are omitted from the cleaned analysis preview.",
            )
        )
    if placeholder_rows:
        recipe.append(
            _recipe_step(
                "remove_serial_only_placeholder_rows",
                placeholder_rows,
                "Serial-only template slots are omitted because business fields are blank.",
            )
        )
    if side_note_columns:
        recipe.append(
            {
                "type": "exclude_side_note_columns",
                "original_column_indexes": side_note_columns,
                "explanation": "Side-note region columns are excluded from the proposed business table.",
            }
        )
    if repeated_missing_rows:
        recipe.append(
            _recipe_step(
                "review_blank_cells",
                repeated_missing_rows,
                "Repeated blank-value patterns should be reviewed before any future fill strategy is applied.",
            )
        )

    return {
        "status": "preview_only",
        "worksheet_id": worksheet.get("worksheet_id"),
        "worksheet_name": worksheet.get("sheet_name"),
        "before": {
            "row_count": int(worksheet.get("row_count") or 0),
            "column_count": int(worksheet.get("column_count") or 0),
        },
        "after_preview": {
            "row_count": cleaned_row_count,
            "column_count": len(output_columns),
            "columns": output_columns,
            "rows": preview_rows,
            "row_provenance": row_provenance,
        },
        "recipe": recipe,
        "excluded": excluded,
        "preview_row_limit": clamped_row_limit,
        "message": "Preview only - no changes have been applied.",
    }
