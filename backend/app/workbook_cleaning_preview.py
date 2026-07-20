from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .workbook_cleaning_contract import (
    WorkbookMissingValuePlan,
    WorkbookStructuralDecisionPlan,
    WorkbookTransformationPlan,
    validate_missing_value_plan_scope,
    validate_transformation_plan_scope,
)
from .workbook_cleaning_missing_value_plan import (
    apply_missing_value_plan_to_rows,
    column_types_by_name,
    empty_missing_value_summary,
)
from .workbook_cleaning_transformations import (
    apply_transformation_plan_to_rows,
    empty_transformation_summary,
)
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
STRUCTURAL_DECISION_EVIDENCE_TYPES = {
    "repeated_header",
    "date_title_row",
    "section_banner",
    "sparse_layout_gap",
    "serial_only_placeholder_rows",
    "side_note_region_candidate",
    "repeated_missing_pattern",
    "automatic_blank_row",
}


def _decision_evidence_key(
    evidence_type: str, indexes: list[int]
) -> tuple[str, tuple[int, ...]]:
    return evidence_type, tuple(sorted(indexes))


def _decision_evidence_id(worksheet_id: str, evidence_type: str, index: int) -> str:
    return f"{worksheet_id}:{evidence_type}:{index}"


def _schema_column_names(worksheet: dict[str, Any]) -> set[str]:
    schema = worksheet.get("schema")
    if not isinstance(schema, list):
        return set()
    names: set[str] = set()
    for column in schema:
        if isinstance(column, dict) and isinstance(column.get("name"), str):
            names.add(column["name"])
    return names


def _automatic_blank_row_indexes(
    raw_rows: list[Any], header_row_index: int
) -> list[int]:
    indexes: list[int] = []
    for row_index, raw_row in enumerate(raw_rows):
        if row_index <= header_row_index:
            continue
        row = raw_row if isinstance(raw_row, list) else []
        if not non_empty_values(row):
            indexes.append(row_index)
    return indexes


def _expected_structural_decision_evidence(
    *,
    worksheet: dict[str, Any],
    raw_rows: list[Any],
    header_row_index: int,
) -> dict[str, dict[str, Any]]:
    worksheet_id = str(worksheet.get("worksheet_id") or "")
    expected: dict[str, dict[str, Any]] = {}
    evidence = _worksheet_evidence(worksheet)
    for index, item in enumerate(evidence):
        evidence_type = item.get("type")
        if evidence_type not in STRUCTURAL_DECISION_EVIDENCE_TYPES:
            continue
        evidence_id = _decision_evidence_id(worksheet_id, str(evidence_type), index)
        rows = _evidence_rows(item)
        columns = _evidence_columns(item)
        expected[evidence_id] = {
            "recommendation_id": evidence_id,
            "evidence_type": evidence_type,
            "evidence_ids": {evidence_id},
            "affected_rows": set(rows),
            "affected_column_indexes": set(columns),
            "evidence_key": _decision_evidence_key(str(evidence_type), rows or columns),
        }

    automatic_blank_rows = _automatic_blank_row_indexes(raw_rows, header_row_index)
    if automatic_blank_rows:
        evidence_id = _decision_evidence_id(worksheet_id, "automatic_blank_row", 0)
        expected[evidence_id] = {
            "recommendation_id": evidence_id,
            "evidence_type": "automatic_blank_row",
            "evidence_ids": {evidence_id},
            "affected_rows": set(automatic_blank_rows),
            "affected_column_indexes": set(),
            "evidence_key": _decision_evidence_key(
                "automatic_blank_row", automatic_blank_rows
            ),
        }

    return expected


def _validate_structural_decision_plan_against_evidence(
    *,
    plan: WorkbookStructuralDecisionPlan | None,
    worksheet: dict[str, Any],
    raw_rows: list[Any],
    header_row_index: int,
) -> dict[str, Any] | None:
    if plan is None:
        return None
    if not plan.decisions:
        return {
            "supplied": True,
            "accepted_rows_by_type": {},
            "accepted_columns_by_type": {},
            "accepted_evidence_keys": set(),
            "accepted": [],
            "preserved": [],
            "deferred": [],
        }

    worksheet_id = str(worksheet.get("worksheet_id") or "")
    max_row_count = len(raw_rows)
    max_column_count = max(
        (len(row) for row in raw_rows if isinstance(row, list)), default=0
    )
    column_names = _schema_column_names(worksheet)
    expected = _expected_structural_decision_evidence(
        worksheet=worksheet,
        raw_rows=raw_rows,
        header_row_index=header_row_index,
    )
    accepted_rows_by_type: dict[str, set[int]] = {}
    accepted_columns_by_type: dict[str, set[int]] = {}
    accepted_evidence_keys: set[tuple[str, tuple[int, ...]]] = set()
    accepted: list[dict[str, str]] = []
    preserved: list[dict[str, str]] = []
    deferred: list[dict[str, str]] = []

    for decision in plan.decisions:
        expected_entry = expected.get(decision.recommendation_id)
        if not expected_entry:
            raise HTTPException(
                status_code=400,
                detail="Structural decision recommendation_id is stale or unsupported for this worksheet",
            )
        if expected_entry["evidence_type"] != decision.evidence_type:
            raise HTTPException(
                status_code=400,
                detail="Structural decision evidence_type does not match backend evidence",
            )

        evidence_ids = set(decision.evidence_ids)
        if decision.evidence_signal_id:
            evidence_ids.add(decision.evidence_signal_id)
        if evidence_ids and not evidence_ids.issubset(expected_entry["evidence_ids"]):
            raise HTTPException(
                status_code=400,
                detail="Structural decision evidence_ids are stale or unsupported for this worksheet",
            )

        supplied_rows = set(decision.affected_rows)
        supplied_columns = set(decision.affected_column_indexes)
        if any(row_index >= max_row_count for row_index in supplied_rows):
            raise HTTPException(
                status_code=400, detail="Structural decision row index is out of bounds"
            )
        if any(column_index >= max_column_count for column_index in supplied_columns):
            raise HTTPException(
                status_code=400,
                detail="Structural decision column index is out of bounds",
            )
        if supplied_rows and not supplied_rows.issubset(
            expected_entry["affected_rows"]
        ):
            raise HTTPException(
                status_code=400,
                detail="Structural decision affected_rows do not match backend evidence",
            )
        if supplied_columns and not supplied_columns.issubset(
            expected_entry["affected_column_indexes"]
        ):
            raise HTTPException(
                status_code=400,
                detail="Structural decision affected_column_indexes do not match backend evidence",
            )
        if decision.affected_columns and not set(decision.affected_columns).issubset(
            column_names
        ):
            raise HTTPException(
                status_code=400,
                detail="Structural decision affected_columns do not match worksheet columns",
            )

        summary = {
            "recommendation_id": decision.recommendation_id,
            "evidence_type": decision.evidence_type,
            "decision": decision.decision,
        }
        if decision.decision == "use_recommendation":
            accepted.append(summary)
            accepted_evidence_keys.add(expected_entry["evidence_key"])
            accepted_rows_by_type.setdefault(decision.evidence_type, set()).update(
                expected_entry["affected_rows"]
            )
            accepted_columns_by_type.setdefault(decision.evidence_type, set()).update(
                expected_entry["affected_column_indexes"]
            )
        elif decision.decision == "keep_original":
            preserved.append(summary)
        else:
            deferred.append(summary)

    return {
        "supplied": True,
        "accepted_rows_by_type": accepted_rows_by_type,
        "accepted_columns_by_type": accepted_columns_by_type,
        "accepted_evidence_keys": accepted_evidence_keys,
        "accepted": accepted,
        "preserved": preserved,
        "deferred": deferred,
    }


def _accepted_rows(
    decision_context: dict[str, Any] | None,
    evidence_type: str,
    fallback_rows: list[int],
) -> list[int]:
    if decision_context is None:
        return fallback_rows
    rows = decision_context["accepted_rows_by_type"].get(evidence_type, set())
    return sorted(rows)


def _accepted_columns(
    decision_context: dict[str, Any] | None,
    evidence_type: str,
    fallback_columns: list[int],
) -> list[int]:
    if decision_context is None:
        return fallback_columns
    columns = decision_context["accepted_columns_by_type"].get(evidence_type, set())
    return sorted(columns)


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
    return (
        [item for item in evidence if isinstance(item, dict)]
        if isinstance(evidence, list)
        else []
    )


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


def _empty_excluded_details() -> dict[str, Any]:
    return {
        "layout_rows": {
            "count": 0,
            "row_indexes": [],
            "reasons": [],
        }
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
        "excluded_details": _empty_excluded_details(),
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


def compute_cleaning_recipe_plan(
    *,
    workbook_path: Path,
    worksheet: dict[str, Any],
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None,
) -> dict[str, Any]:
    """Compute the full cleaning recipe plan for a worksheet.

    Returns the complete cleaned-row set (not row-limited) plus the recipe,
    excluded counts, and provenance. This is the shared core used by both
    the read-only preview (clamped to a small row limit) and the
    apply-to-working-copy flow (writes a DuckDB table). It performs no I/O
    other than reading the original workbook.
    """
    if workbook_path.suffix.lower() != ".xlsx":
        raise HTTPException(
            status_code=400,
            detail="Cleaning recipe currently supports XLSX workbooks only",
        )
    if not workbook_path.exists():
        raise HTTPException(
            status_code=404, detail="Original workbook file mapping is missing"
        )

    if worksheet.get("status") == "empty":
        return _empty_plan(worksheet=worksheet)
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail="Worksheet is not available for cleaning recipe",
        )

    sheets = parse_xlsx_workbook(workbook_path)
    worksheet_index = int(worksheet.get("original_index") or 0)
    if worksheet_index < 0 or worksheet_index >= len(sheets):
        raise HTTPException(
            status_code=404, detail="Original workbook worksheet is missing"
        )

    raw_rows = sheets[worksheet_index].get("rows")
    if not isinstance(raw_rows, list):
        raw_rows = []
    normalization = worksheet.get("normalization")
    normalization = normalization if isinstance(normalization, dict) else {}
    header_row_index = normalization.get("header_row_index")
    if not isinstance(header_row_index, int) or header_row_index >= len(raw_rows):
        return _empty_plan(worksheet=worksheet)

    header_row = raw_rows[header_row_index]
    business_width = contiguous_header_width(header_row)
    if business_width <= 0:
        return _empty_plan(worksheet=worksheet)

    header_signature = row_signature(header_row, business_width)
    evidence = _worksheet_evidence(worksheet)
    repeated_header_rows = _rows_for_type(evidence, "repeated_header")
    date_title_rows = _rows_for_type(evidence, "date_title_row")
    section_banner_rows = _rows_for_type(evidence, "section_banner")
    sparse_layout_rows = _rows_for_type(evidence, "sparse_layout_gap")
    placeholder_rows = _rows_for_type(evidence, "serial_only_placeholder_rows")
    metadata_side_note_columns = _columns_for_type(
        evidence, "side_note_region_candidate"
    )
    side_note_columns = metadata_side_note_columns
    repeated_missing_rows = _rows_for_type(evidence, "repeated_missing_pattern")
    decision_context = _validate_structural_decision_plan_against_evidence(
        plan=structural_decision_plan,
        worksheet=worksheet,
        raw_rows=raw_rows,
        header_row_index=header_row_index,
    )
    automatic_blank_rows = _accepted_rows(
        decision_context,
        "automatic_blank_row",
        _automatic_blank_row_indexes(raw_rows, header_row_index),
    )
    repeated_header_rows = _accepted_rows(
        decision_context, "repeated_header", repeated_header_rows
    )
    date_title_rows = _accepted_rows(
        decision_context, "date_title_row", date_title_rows
    )
    section_banner_rows = _accepted_rows(
        decision_context, "section_banner", section_banner_rows
    )
    sparse_layout_rows = _accepted_rows(
        decision_context, "sparse_layout_gap", sparse_layout_rows
    )
    placeholder_rows = _accepted_rows(
        decision_context,
        "serial_only_placeholder_rows",
        placeholder_rows,
    )
    side_note_columns = _accepted_columns(
        decision_context,
        "side_note_region_candidate",
        side_note_columns,
    )
    repeated_missing_rows = _accepted_rows(
        decision_context,
        "repeated_missing_pattern",
        repeated_missing_rows,
    )

    repeated_header_set = set(repeated_header_rows)
    date_title_set = set(date_title_rows)
    section_banner_set = set(section_banner_rows)
    sparse_layout_set = set(sparse_layout_rows)
    placeholder_set = set(placeholder_rows)
    has_section_context = bool(date_title_rows or section_banner_rows)
    preserved_side_note_columns = (
        [
            column_index
            for column_index in metadata_side_note_columns
            if column_index not in set(side_note_columns)
        ]
        if decision_context is not None
        else []
    )
    output_column_indexes = [*range(business_width), *preserved_side_note_columns]
    existing_headers: set[str] = set()
    output_columns = [
        normalize_header(
            header_row[index] if index < len(header_row) else None,
            index,
            existing_headers,
        )[0]
        for index in output_column_indexes
    ]
    if has_section_context:
        output_columns.extend(["_section_date", "_section_label"])

    cleaned_rows: list[dict[str, Any]] = []
    row_provenance: list[dict[str, int]] = []
    current_section_date: str | None = None
    current_section_label: str | None = None
    excluded = _empty_excluded_counts()
    layout_row_reasons: dict[int, str] = {}
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
            decision_context is None
            and populated_values
            and row_signature(row, business_width) == header_signature
        ):
            counted_repeated_header_rows.add(original_row_index)
            continue
        if original_row_index in automatic_blank_rows:
            counted_layout_rows.add(original_row_index)
            layout_row_reasons[original_row_index] = "automatic_blank_row"
            continue

        business_values = row[:business_width]
        first_business_value = (
            normalize_cell_text(business_values[0]) if business_values else ""
        )
        has_business_value_after_serial = any(
            not is_blank_cell(value) for value in business_values[1:]
        )
        has_only_header_shaped_serial = (
            first_business_value
            and first_business_value == header_signature[0]
            and not has_business_value_after_serial
        )
        if original_row_index in placeholder_set or (
            decision_context is None
            and first_business_value
            and looks_like_numeric_value(first_business_value)
            and not has_business_value_after_serial
        ):
            counted_placeholder_rows.add(original_row_index)
            continue
        # These remain non-decision safety exclusions: they are inferred from
        # header shape or empty business values, not surfaced as analyst cards.
        if has_only_header_shaped_serial:
            counted_layout_rows.add(original_row_index)
            layout_row_reasons[original_row_index] = "automatic_header_shaped_serial"
            continue
        if (
            original_row_index in sparse_layout_set
            and not has_business_value_after_serial
        ):
            counted_layout_rows.add(original_row_index)
            layout_row_reasons[original_row_index] = "sparse_layout_gap"
            continue
        if decision_context is None and not any(
            not is_blank_cell(value) for value in business_values
        ):
            counted_layout_rows.add(original_row_index)
            layout_row_reasons[original_row_index] = "automatic_blank_business_values"
            continue

        values = {
            column: (
                None
                if source_index >= len(row) or is_blank_cell(row[source_index])
                else row[source_index]
            )
            for column, source_index in zip(output_columns, output_column_indexes)
        }
        if has_section_context:
            values["_section_date"] = current_section_date
            values["_section_label"] = current_section_label

        cleaned_rows.append(values)
        row_provenance.append(
            {
                "cleaned_row_index": len(cleaned_rows) - 1,
                "original_row_index": original_row_index,
            }
        )

    excluded["repeated_headers"] = len(counted_repeated_header_rows)
    excluded["section_banners"] = len(section_banner_rows)
    excluded["date_title_rows"] = len(date_title_rows)
    excluded["layout_rows"] = len(counted_layout_rows)
    excluded["placeholder_rows"] = len(counted_placeholder_rows)
    sorted_layout_rows = sorted(counted_layout_rows)
    excluded_details = {
        "layout_rows": {
            "count": len(sorted_layout_rows),
            "row_indexes": sorted_layout_rows,
            "reasons": [
                {
                    "row_index": row_index,
                    "reason": layout_row_reasons.get(row_index, "automatic_blank_row"),
                }
                for row_index in sorted_layout_rows
            ],
        }
    }

    recipe: list[dict[str, Any]] = []
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
    if sorted_layout_rows:
        recipe.append(
            _recipe_step(
                "ignore_layout_rows",
                sorted_layout_rows,
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
        "is_empty": False,
        "worksheet_id": worksheet.get("worksheet_id"),
        "worksheet_name": worksheet.get("sheet_name"),
        "before": {
            "row_count": int(worksheet.get("row_count") or 0),
            "column_count": int(worksheet.get("column_count") or 0),
        },
        "output_columns": output_columns,
        "rows": cleaned_rows,
        "row_provenance": row_provenance,
        "recipe": recipe,
        "excluded": excluded,
        "excluded_details": excluded_details,
        "has_section_context": has_section_context,
        "structural_decision_summary": {
            "accepted": decision_context["accepted"] if decision_context else [],
            "preserved": decision_context["preserved"] if decision_context else [],
            "deferred": decision_context["deferred"] if decision_context else [],
        },
    }


def _empty_plan(*, worksheet: dict[str, Any]) -> dict[str, Any]:
    return {
        "is_empty": True,
        "worksheet_id": worksheet.get("worksheet_id"),
        "worksheet_name": worksheet.get("sheet_name"),
        "before": {
            "row_count": int(worksheet.get("row_count") or 0),
            "column_count": int(worksheet.get("column_count") or 0),
        },
        "output_columns": [],
        "rows": [],
        "row_provenance": [],
        "recipe": [],
        "excluded": _empty_excluded_counts(),
        "excluded_details": _empty_excluded_details(),
        "has_section_context": False,
        "structural_decision_summary": {
            "accepted": [],
            "preserved": [],
            "deferred": [],
        },
        "missing_value_summary": empty_missing_value_summary(),
        "transformation_summary": empty_transformation_summary(),
    }


def build_cleaning_recipe_preview(
    *,
    workbook_path: Path,
    worksheet: dict[str, Any],
    row_limit: int,
    structural_decision_plan: WorkbookStructuralDecisionPlan | None = None,
    missing_value_plan: WorkbookMissingValuePlan | None = None,
    transformation_plan: WorkbookTransformationPlan | None = None,
) -> dict[str, Any]:
    """Read-only preview of the cleaning recipe, clamped to `row_limit` rows."""
    clamped_row_limit = min(max(row_limit, 1), MAX_CLEANING_PREVIEW_ROWS)
    plan = compute_cleaning_recipe_plan(
        workbook_path=workbook_path,
        worksheet=worksheet,
        structural_decision_plan=structural_decision_plan,
    )
    validate_missing_value_plan_scope(missing_value_plan, str(plan["worksheet_id"]))
    validate_transformation_plan_scope(
        transformation_plan,
        str(plan["worksheet_id"]),
        worksheet,
        shaped_columns=plan.get("output_columns", []),
    )
    if plan.get("is_empty"):
        preview = _empty_preview(worksheet=worksheet, row_limit=clamped_row_limit)
        preview["missing_value_summary"] = {
            key: value
            for key, value in empty_missing_value_summary().items()
            if key != "kept_row_indexes"
        }
        preview["transformation_summary"] = empty_transformation_summary()
        return preview

    rows, missing_value_summary, _ = apply_missing_value_plan_to_rows(
        rows=plan["rows"],
        output_columns=plan["output_columns"],
        worksheet=worksheet,
        missing_value_plan=missing_value_plan,
    )
    kept_row_indexes = missing_value_summary.get("kept_row_indexes")
    source_provenance = plan["row_provenance"]
    if isinstance(kept_row_indexes, list) and len(kept_row_indexes) == len(rows):
        source_provenance = [
            plan["row_provenance"][index] for index in kept_row_indexes
        ]

    transformation_result = apply_transformation_plan_to_rows(
        rows=rows,
        columns=plan["output_columns"],
        schema=column_types_by_name(worksheet),
        transformation_plan=transformation_plan,
    )
    rows = transformation_result.rows
    output_columns = transformation_result.columns

    preview_rows = rows[:clamped_row_limit]
    row_provenance = [
        {
            "preview_row_index": index,
            "original_row_index": entry["original_row_index"],
        }
        for index, entry in enumerate(source_provenance[:clamped_row_limit])
    ]

    return {
        "status": "preview_only",
        "worksheet_id": plan["worksheet_id"],
        "worksheet_name": plan["worksheet_name"],
        "before": plan["before"],
        "after_preview": {
            "row_count": len(rows),
            "column_count": len(output_columns),
            "columns": output_columns,
            "rows": preview_rows,
            "row_provenance": row_provenance,
        },
        "recipe": plan["recipe"],
        "excluded": plan["excluded"],
        "excluded_details": plan.get("excluded_details", _empty_excluded_details()),
        "structural_decision_summary": plan.get(
            "structural_decision_summary",
            {"accepted": [], "preserved": [], "deferred": []},
        ),
        "missing_value_summary": {
            key: value
            for key, value in missing_value_summary.items()
            if key != "kept_row_indexes"
        },
        "transformation_summary": transformation_result.transformation_summary,
        "preview_row_limit": clamped_row_limit,
        "message": "Preview only - no changes have been applied.",
    }
