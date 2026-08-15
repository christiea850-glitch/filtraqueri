from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import re
import zipfile
import xml.etree.ElementTree as ET

import duckdb
from fastapi import HTTPException

from .workbook_models import (
    WorkbookIngestionProfile,
    WorkbookMetadata,
    WorkbookNormalizationMetadata,
    WorkbookSourceFileMetadata,
    WorksheetMetadata,
    WorksheetNormalizationMetadata,
    WorksheetTemplateStructureEvidence,
    WorksheetTableMapping,
)
from .workbook_relationships import profile_relationship_candidates
from .workbook_source_registry import create_original_source_registry


MAX_WORKBOOK_FILE_BYTES = 25 * 1024 * 1024
MAX_WORKSHEETS = 30
MAX_WORKSHEET_COLUMNS = 250
MAX_WORKSHEET_ROWS = 50000
MAX_PREVIEW_ROWS = 25
ACTIVE_TABLE_NAME = "data"
WORKBOOK_TABLE_PREFIX = "ws"
XML_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
HEADER_SCAN_ROW_LIMIT = 8
HEADER_PREVIEW_VALUE_LIMIT = 12
STRUCTURAL_COLUMN_SAMPLE_LIMIT = 200
STRUCTURAL_COLUMN_EMPTY_RATIO_THRESHOLD = 0.95
STRUCTURAL_COLUMN_WARNING = (
    "Possible structural column detected. This column may come from a data dictionary row "
    "and may not be part of the business data."
)
STRUCTURAL_COLUMN_HEADER_NAMES = {
    "attribute_name",
    "field_name",
    "column_name",
    "data_type",
}
TEMPLATE_STRUCTURE_CANDIDATE_SCORE = 5
TEMPLATE_STRUCTURE_HIGH_CONFIDENCE_SCORE = 9


@dataclass(frozen=True)
class NormalizedWorksheetRows:
    columns: list[str]
    data_rows: list[list[Any]]
    duplicate_column_count: int
    empty_column_count: int
    header_row_index: int | None
    skipped_leading_rows: int
    header_detection_strategy: str
    header_detection_confidence: str | None
    header_detection_warning: str | None
    original_first_row_preview: list[str]
    selected_header_row_preview: list[str]
    structural_column_candidates: list[str]
    structural_column_detection_warning: str | None
    structural_column_detection_confidence: str | None
    structural_column_sample_size: int | None
    recommended_hidden_columns: list[str]


def safe_identifier(value: str, fallback: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_]+", "_", value.strip().lower()).strip("_")
    normalized = re.sub(r"_+", "_", normalized)
    return (normalized[:48] or fallback).strip("_") or fallback


def generate_safe_worksheet_table_name(sheet_name: str, index: int) -> str:
    return f"{WORKBOOK_TABLE_PREFIX}_{index + 1}_{safe_identifier(sheet_name, f'worksheet_{index + 1}')}"


def quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) + chr(34))}"'


def cell_reference_to_indexes(reference: str) -> tuple[int, int]:
    match = re.match(r"([A-Za-z]+)(\d+)", reference)
    if not match:
        return 0, 0

    column_letters, row_number = match.groups()
    column_index = 0
    for character in column_letters.upper():
        column_index = column_index * 26 + (ord(character) - ord("A") + 1)

    return int(row_number) - 1, column_index - 1


def normalize_header(value: Any, index: int, existing: set[str]) -> tuple[str, bool, bool]:
    empty_name = value in (None, "")
    raw_name = f"column_{index + 1}" if empty_name else str(value).strip()
    normalized = raw_name or f"column_{index + 1}"
    normalized = normalized[:80]
    base_name = normalized
    duplicate = normalized in existing
    suffix = 2

    while normalized in existing:
        normalized = f"{base_name}_{suffix}"
        suffix += 1

    existing.add(normalized)
    return normalized, duplicate, empty_name


def preview_row_values(row: list[Any]) -> list[str]:
    return [str(value).strip() for value in row[:HEADER_PREVIEW_VALUE_LIMIT] if value not in (None, "")]


def normalize_cell_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower()) if value not in (None, "") else ""


def non_empty_values(row: list[Any]) -> list[str]:
    return [normalize_cell_text(value) for value in row if normalize_cell_text(value)]


def is_datatype_like_value(value: str) -> bool:
    compact_value = value.replace(" ", "")
    if value in {"data type", "datatype"}:
        return True
    if re.fullmatch(r"(char|nchar|varchar|nvarchar|text|string)(\(\d+\))?", compact_value):
        return True
    if re.fullmatch(r"(date|datetime|timestamp|time|boolean|bool)", compact_value):
        return True
    if re.fullmatch(r"(tinyint|smallint|int|integer|bigint)(\(\d+\))?(zerofill)?", compact_value):
        return True
    if re.fullmatch(r"(decimal|number|numeric|float|double|real)(\(\d+(,\d+)?\))?", compact_value):
        return True
    return False


FIELD_NAME_TOKENS = {
    "id",
    "name",
    "first",
    "last",
    "email",
    "phone",
    "amount",
    "status",
    "date",
    "start",
    "end",
    "created",
    "updated",
    "move",
    "tenant",
    "customer",
    "account",
    "property",
    "unit",
    "order",
    "request",
    "payment",
    "contract",
}


def is_field_name_like_value(value: str) -> bool:
    if not value or is_datatype_like_value(value):
        return False
    if not re.search(r"[a-z]", value):
        return False
    if "@" in value:
        return False
    if re.fullmatch(r"[a-z]{1,5}\d{2,}", value):
        return False
    if re.fullmatch(r"\d+([./-]\d+)?", value):
        return False

    normalized = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    tokens = [token for token in normalized.split("_") if token]
    if not tokens:
        return False
    if normalized == "attribute_name":
        return True
    if normalized.endswith("_id") or normalized in {"id", "email", "phone", "status", "amount", "date"}:
        return True
    if any(token in FIELD_NAME_TOKENS for token in tokens):
        return True
    if "_" in normalized and all(re.fullmatch(r"[a-z][a-z0-9]*", token) for token in tokens):
        return True
    return False


def ratio(count: int, total: int) -> float:
    return count / total if total else 0


def is_blank_cell(value: Any) -> bool:
    return value in (None, "") or (isinstance(value, str) and not value.strip())


def is_strong_datatype_row(row: list[Any]) -> bool:
    values = non_empty_values(row)
    if len(values) < 2:
        return False
    datatype_count = sum(1 for value in values if is_datatype_like_value(value))
    return datatype_count >= 2 and ratio(datatype_count, len(values)) >= 0.6


def is_strong_field_name_row(row: list[Any]) -> bool:
    values = non_empty_values(row)
    if len(values) < 2:
        return False
    field_count = sum(1 for value in values if is_field_name_like_value(value))
    datatype_count = sum(1 for value in values if is_datatype_like_value(value))
    return field_count >= 2 and ratio(field_count, len(values)) >= 0.5 and ratio(datatype_count, len(values)) < 0.4


KNOWN_BUSINESS_HEADER_TERMS = {
    # Row identifiers / counts
    "no", "number", "num", "id", "code", "ref", "reference", "line", "row", "entry",
    # Shipment / logistics
    "waybill", "consignor", "consignee", "shipper", "receiver", "tracking",
    # Place / geography
    "location", "address", "city", "country", "region", "branch", "site",
    # Classification
    "reason", "status", "type", "category", "group", "segment", "class",
    # Notes
    "notes", "note", "comments", "comment", "remarks", "description",
    # Money / value
    "amount", "total", "subtotal", "balance", "price", "cost", "value", "fee", "charge", "rate",
    # Time
    "date", "datetime", "day", "month", "year", "time", "period", "due",
    # Person / entity
    "customer", "client", "tenant", "buyer", "vendor", "supplier", "user", "member",
    "name", "first", "last", "title",
    # Documents
    "invoice", "receipt", "voucher", "transaction", "order",
    # Items
    "product", "item", "sku", "part", "service",
    # Quantities
    "quantity", "qty", "count", "units",
    # Contact
    "email", "phone", "contact",
    # Org
    "company", "organization", "department", "team",
    # State
    "paid", "pending", "open", "closed", "active", "inactive",
    # Measurement
    "score", "rating", "rank",
}

HEADER_SCORE_MIN_THRESHOLD = 6


def looks_like_numeric_value(value: str) -> bool:
    if not value:
        return False
    compact = value.replace(",", "").replace(" ", "")
    return bool(re.fullmatch(r"[-+]?\d+(\.\d+)?", compact))


_MONTH_TOKENS = {
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
    "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
}


def looks_like_date_value(value: str) -> bool:
    if not value:
        return False
    compact = value.replace(" ", "")
    if re.fullmatch(r"\d{1,4}[./-]\d{1,2}[./-]\d{1,4}", compact):
        return True
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}([t\s]\d{2}:\d{2}.*)?", compact):
        return True
    if re.fullmatch(r"q[1-4][-_ ]*(19|20)\d{2}", value):
        return True
    tokens = [token for token in re.split(r"[^a-z0-9]+", value) if token]
    if not tokens:
        return False
    if any(token in _MONTH_TOKENS for token in tokens):
        has_year = any(re.fullmatch(r"(19|20)\d{2}", token) for token in tokens)
        has_day = any(re.fullmatch(r"\d{1,2}", token) for token in tokens)
        if has_year or has_day:
            return True
    return False


def is_all_caps_short_phrase_row(row: list[Any]) -> bool:
    raw_strings: list[str] = []
    for cell in row:
        if cell in (None, ""):
            continue
        text = str(cell).strip()
        if text:
            raw_strings.append(text)
    if not raw_strings or len(raw_strings) > 3:
        return False
    for text in raw_strings:
        letters = [character for character in text if character.isalpha()]
        if not letters:
            return False
        if not all(character.isupper() for character in letters):
            return False
    return True


def numeric_or_date_dominance(values: list[str]) -> float:
    if not values:
        return 0.0
    matched = sum(
        1 for value in values
        if looks_like_numeric_value(value) or looks_like_date_value(value)
    )
    return matched / len(values)


def header_business_term_hits(value: str) -> int:
    if not value:
        return 0
    normalized = re.sub(r"[^a-z0-9]+", "_", value).strip("_")
    tokens = [token for token in normalized.split("_") if token]
    return sum(1 for token in tokens if token in KNOWN_BUSINESS_HEADER_TERMS)


def count_row_repeats(
    scan_rows: list[tuple[int, list[Any]]],
    target_index: int,
) -> int:
    if not (0 <= target_index < len(scan_rows)):
        return 0
    _, target_row = scan_rows[target_index]
    target_signature = tuple(non_empty_values(target_row))
    if not target_signature:
        return 0
    repeats = 0
    for index, (_, row) in enumerate(scan_rows):
        if index == target_index:
            continue
        if tuple(non_empty_values(row)) == target_signature:
            repeats += 1
    return repeats


def score_header_candidate(
    row: list[Any],
    next_row: list[Any] | None,
    repeat_count: int,
    max_data_row_width: int,
) -> int:
    values = non_empty_values(row)
    cell_count = len(values)
    if cell_count == 0:
        return -100

    score = 0

    # +4 per non-empty cell, capped at +12
    score += min(cell_count * 4, 12)

    # +2 per text-like cell (non-numeric, non-date)
    text_like = sum(
        1 for value in values
        if not looks_like_numeric_value(value) and not looks_like_date_value(value)
    )
    score += text_like * 2

    # +3 per cell with a known business header term, capped at +15
    business_hits = sum(1 for value in values if header_business_term_hits(value) > 0)
    score += min(business_hits * 3, 15)

    # +2 if the row below is more numeric/date-heavy and is data-shaped
    if next_row is not None:
        next_values = non_empty_values(next_row)
        if next_values:
            candidate_density = numeric_or_date_dominance(values)
            next_density = numeric_or_date_dominance(next_values)
            next_wide_enough = len(next_values) >= max(2, cell_count - 1)
            if next_density > candidate_density and next_wide_enough:
                score += 2

    # -6 if sparse (< 3 cells) and a wider data row exists below
    if cell_count < 3 and max_data_row_width >= 4:
        score -= 6

    # -5 if only populated cell is date-like
    if cell_count == 1 and looks_like_date_value(values[0]):
        score -= 5

    # -4 if all-caps short banner phrase
    if is_all_caps_short_phrase_row(row):
        score -= 4

    # -3 if the row content repeats elsewhere in the scan window (banner)
    if repeat_count > 0:
        score -= 3

    return score


def scored_header_row_scan(
    non_empty_rows: list[tuple[int, list[Any]]],
) -> tuple[int, int, int] | None:
    scan_rows = non_empty_rows[:HEADER_SCAN_ROW_LIMIT]
    if not scan_rows:
        return None

    max_data_row_width = 0
    if len(scan_rows) >= 2:
        max_data_row_width = max(
            (len(non_empty_values(row)) for _, row in scan_rows[1:]),
            default=0,
        )

    scores: list[int] = []
    for index, (_, row) in enumerate(scan_rows):
        next_row = scan_rows[index + 1][1] if index + 1 < len(scan_rows) else None
        repeat_count = count_row_repeats(scan_rows, index)
        scores.append(
            score_header_candidate(row, next_row, repeat_count, max_data_row_width)
        )

    if not scores:
        return None

    winning_index = max(range(len(scores)), key=lambda i: scores[i])
    winning_score = scores[winning_index]
    runner_up_scores = [score for index, score in enumerate(scores) if index != winning_index]
    runner_up_score = max(runner_up_scores) if runner_up_scores else 0

    return winning_index, winning_score, runner_up_score


def detect_header_row(
    non_empty_rows: list[tuple[int, list[Any]]],
) -> tuple[int, str, str | None, str | None]:
    scan_rows = non_empty_rows[:HEADER_SCAN_ROW_LIMIT]

    # Priority 1: data-dictionary pattern (datatype row above field-name row) — unchanged.
    for index in range(len(scan_rows) - 1):
        _, current_row = scan_rows[index]
        _, next_row = scan_rows[index + 1]
        if is_strong_datatype_row(current_row) and is_strong_field_name_row(next_row):
            return (
                index + 1,
                "datatype_row_then_field_header",
                "high",
                "Detected a datatype row above the header row; using the following row as worksheet headers.",
            )

    # Priority 2: scored scan over the first HEADER_SCAN_ROW_LIMIT non-empty rows.
    scan_result = scored_header_row_scan(non_empty_rows)
    if scan_result is not None:
        winning_index, winning_score, runner_up_score = scan_result
        if winning_score >= HEADER_SCORE_MIN_THRESHOLD:
            margin = winning_score - runner_up_score
            if winning_score >= 10 and margin >= 6:
                confidence = "high"
                warning = None
            elif winning_score >= 8 and margin >= 3:
                confidence = "medium"
                warning = (
                    "Header row was auto-detected with medium confidence; "
                    "review the column names before relying on analysis."
                )
            else:
                confidence = "low"
                warning = (
                    "Header row could not be detected confidently; "
                    "review the worksheet structure before relying on analysis."
                )
            return winning_index, "scored_header_scan", confidence, warning

    # Priority 3: fall back to the first non-empty row (existing behaviour).
    return 0, "first_non_empty_row", None, None


def normalize_structural_header_name(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return re.sub(r"_+", "_", normalized)


def detect_structural_column_candidates(
    *,
    columns: list[str],
    data_rows: list[list[Any]],
    header_detection_strategy: str,
) -> tuple[list[str], str | None, str | None, int | None, list[str]]:
    if (
        header_detection_strategy != "datatype_row_then_field_header"
        or len(columns) < 2
        or normalize_structural_header_name(columns[0]) not in STRUCTURAL_COLUMN_HEADER_NAMES
    ):
        return [], None, None, None, []

    sample_rows = data_rows[:STRUCTURAL_COLUMN_SAMPLE_LIMIT]
    sample_size = len(sample_rows)
    if sample_size <= 0:
        return [], None, None, sample_size, []

    blank_count = sum(1 for row in sample_rows if not row or is_blank_cell(row[0]))
    if ratio(blank_count, sample_size) < STRUCTURAL_COLUMN_EMPTY_RATIO_THRESHOLD:
        return [], None, None, sample_size, []

    neighbor_indexes = range(1, min(len(columns), 5))
    field_like_neighbors = [
        index
        for index in neighbor_indexes
        if is_field_name_like_value(normalize_cell_text(columns[index]))
    ]
    required_neighbor_count = min(2, len(columns) - 1)
    if len(field_like_neighbors) < required_neighbor_count:
        return [], None, None, sample_size, []

    has_neighbor_values = any(
        any(len(row) > index and not is_blank_cell(row[index]) for row in sample_rows)
        for index in field_like_neighbors
    )
    if not has_neighbor_values:
        return [], None, None, sample_size, []

    candidates = [columns[0]]
    return candidates, STRUCTURAL_COLUMN_WARNING, "high", sample_size, candidates


def populated_column_indexes(row: list[Any]) -> list[int]:
    return [index for index, value in enumerate(row) if not is_blank_cell(value)]


def contiguous_header_width(header_row: list[Any]) -> int:
    width = 0
    for value in header_row:
        if is_blank_cell(value):
            break
        width += 1
    return width


def row_signature(row: list[Any], width: int) -> tuple[str, ...]:
    return tuple(normalize_cell_text(value) for value in row[:width])


def contiguous_ranges(indexes: list[int]) -> list[list[int]]:
    if not indexes:
        return []
    ranges: list[list[int]] = []
    start = indexes[0]
    end = indexes[0]
    for index in indexes[1:]:
        if index == end + 1:
            end = index
            continue
        ranges.append([start, end])
        start = index
        end = index
    ranges.append([start, end])
    return ranges


def detect_template_structure(
    raw_rows: list[list[Any]],
    header_row_index: int | None,
) -> tuple[bool, str, list[WorksheetTemplateStructureEvidence]]:
    if header_row_index is None or not (0 <= header_row_index < len(raw_rows)):
        return False, "low", []

    header_row = raw_rows[header_row_index]
    main_width = contiguous_header_width(header_row)
    if main_width < 2:
        return False, "low", []

    evidence: list[WorksheetTemplateStructureEvidence] = []
    score = 0
    canonical_signature = row_signature(header_row, main_width)

    repeated_header_indexes = [
        index
        for index, row in enumerate(raw_rows[header_row_index + 1 :], start=header_row_index + 1)
        if row_signature(row, main_width) == canonical_signature
    ]
    if repeated_header_indexes:
        score += 4
        evidence.append(
            WorksheetTemplateStructureEvidence(
                type="repeated_header",
                row_indexes=repeated_header_indexes,
                row_range=[repeated_header_indexes[0], repeated_header_indexes[-1]],
                preview_values=preview_row_values(header_row[:main_width]),
                confidence="high",
                explanation=(
                    f"Canonical worksheet headers repeat {len(repeated_header_indexes)} time(s) "
                    "below the selected header row."
                ),
            )
        )

    date_title_indexes = [
        index
        for index, row in enumerate(raw_rows)
        if len(non_empty_values(row)) == 1 and looks_like_date_value(non_empty_values(row)[0])
    ]
    if date_title_indexes:
        score += 2
        evidence.append(
            WorksheetTemplateStructureEvidence(
                type="date_title_row",
                row_indexes=date_title_indexes,
                row_range=[date_title_indexes[0], date_title_indexes[-1]],
                preview_values=[
                    preview_row_values(raw_rows[index])[0]
                    for index in date_title_indexes[:5]
                ],
                confidence="medium" if len(date_title_indexes) == 1 else "high",
                explanation=(
                    f"Detected {len(date_title_indexes)} sparse date/title row(s), "
                    "which may label recurring report blocks."
                ),
            )
        )

    banner_indexes_by_label: dict[str, list[int]] = {}
    for index, row in enumerate(raw_rows):
        values = non_empty_values(row)
        if (
            len(values) == 1
            and not looks_like_date_value(values[0])
            and not looks_like_numeric_value(values[0])
            and is_all_caps_short_phrase_row(row)
        ):
            banner_indexes_by_label.setdefault(values[0], []).append(index)
    for label, indexes in banner_indexes_by_label.items():
        if len(indexes) < 2:
            continue
        score += 3
        evidence.append(
            WorksheetTemplateStructureEvidence(
                type="section_banner",
                row_indexes=indexes,
                row_range=[indexes[0], indexes[-1]],
                label=label.upper(),
                preview_values=[label.upper()],
                confidence="high",
                explanation=f"Repeated section banner appears {len(indexes)} time(s).",
            )
        )

    blank_indexes = [
        index for index, row in enumerate(raw_rows)
        if not populated_column_indexes(row)
    ]
    layout_gap_ranges = [
        row_range for row_range in contiguous_ranges(blank_indexes)
        if row_range[1] - row_range[0] + 1 >= 2
    ]
    if layout_gap_ranges:
        score += 1
        for row_range in layout_gap_ranges[:10]:
            evidence.append(
                WorksheetTemplateStructureEvidence(
                    type="sparse_layout_gap",
                    row_range=row_range,
                    confidence="medium",
                    explanation="Consecutive blank rows may represent visual spacing between template blocks.",
                )
            )

    placeholder_indexes = [
        index
        for index, row in enumerate(raw_rows[header_row_index + 1 :], start=header_row_index + 1)
        if populated_column_indexes(row) == [0]
        and looks_like_numeric_value(normalize_cell_text(row[0]))
    ]
    placeholder_ranges = [
        row_range for row_range in contiguous_ranges(placeholder_indexes)
        if row_range[1] - row_range[0] + 1 >= 2
    ]
    if placeholder_ranges:
        score += 2
        for row_range in placeholder_ranges[:10]:
            evidence.append(
                WorksheetTemplateStructureEvidence(
                    type="serial_only_placeholder_rows",
                    row_range=row_range,
                    confidence="high",
                    explanation=(
                        "Consecutive rows contain only serial numbers while business fields are blank; "
                        "these may be pre-formatted template slots."
                    ),
                )
            )

    populated_header_indexes = populated_column_indexes(header_row)
    separator_columns = [
        index for index in range(main_width, max(populated_header_indexes, default=-1))
        if is_blank_cell(header_row[index])
    ]
    side_note_indexes = [index for index in populated_header_indexes if index > main_width]
    if separator_columns and side_note_indexes:
        score += 2
        evidence.append(
            WorksheetTemplateStructureEvidence(
                type="side_note_region_candidate",
                row_index=header_row_index,
                column_range=[side_note_indexes[0], side_note_indexes[-1]],
                preview_values=preview_row_values(header_row[side_note_indexes[0] : side_note_indexes[-1] + 1]),
                confidence="high",
                explanation=(
                    "Populated cells appear to the right of the main header region after one or more "
                    "blank separator columns."
                ),
            )
        )

    missing_patterns: dict[tuple[bool, ...], list[int]] = {}
    for index, row in enumerate(raw_rows[header_row_index + 1 :], start=header_row_index + 1):
        pattern = tuple(is_blank_cell(value) for value in row[:main_width])
        populated_count = sum(1 for is_blank in pattern if not is_blank)
        if 0 < populated_count < main_width:
            missing_patterns.setdefault(pattern, []).append(index)
    repeated_sparse_patterns = [
        indexes for indexes in missing_patterns.values()
        if len(indexes) >= 3
    ]
    if repeated_sparse_patterns:
        score += 1
        indexes = max(repeated_sparse_patterns, key=len)
        evidence.append(
            WorksheetTemplateStructureEvidence(
                type="repeated_missing_pattern",
                row_indexes=indexes[:25],
                row_range=[indexes[0], indexes[-1]],
                confidence="medium",
                explanation=(
                    f"A sparse missing-value pattern repeats {len(indexes)} time(s) "
                    "within the main table-shaped region."
                ),
            )
        )

    data_rows = [
        row[:main_width]
        for row in raw_rows[header_row_index + 1 :]
        if populated_column_indexes(row)
    ]
    rectangular_rows = sum(
        1 for row in data_rows
        if len(row) >= main_width and all(not is_blank_cell(value) for value in row)
    )
    has_repeated_banner = any(len(indexes) >= 2 for indexes in banner_indexes_by_label.values())
    has_structural_repeat = bool(repeated_header_indexes or has_repeated_banner or layout_gap_ranges)
    if data_rows and ratio(rectangular_rows, len(data_rows)) >= 0.9 and not has_structural_repeat:
        score -= 4
        evidence.append(
            WorksheetTemplateStructureEvidence(
                type="clean_table_counter_signal",
                row_range=[header_row_index + 1, len(raw_rows) - 1],
                confidence="high",
                explanation="Rows below the selected header form a consistently populated rectangular table.",
            )
        )

    candidate = score >= TEMPLATE_STRUCTURE_CANDIDATE_SCORE
    confidence = (
        "high"
        if score >= TEMPLATE_STRUCTURE_HIGH_CONFIDENCE_SCORE
        else "medium"
        if candidate
        else "low"
    )
    return candidate, confidence, evidence


def normalize_rows(raw_rows: list[list[Any]]) -> NormalizedWorksheetRows:
    non_empty_rows = [
        (index, row)
        for index, row in enumerate(raw_rows)
        if any(value not in (None, "") for value in row)
    ]
    if not non_empty_rows:
        return NormalizedWorksheetRows(
            columns=[],
            data_rows=[],
            duplicate_column_count=0,
            empty_column_count=0,
            header_row_index=None,
            skipped_leading_rows=0,
            header_detection_strategy="no_non_empty_rows",
            header_detection_confidence=None,
            header_detection_warning=None,
            original_first_row_preview=[],
            selected_header_row_preview=[],
            structural_column_candidates=[],
            structural_column_detection_warning=None,
            structural_column_detection_confidence=None,
            structural_column_sample_size=None,
            recommended_hidden_columns=[],
        )

    selected_non_empty_index, strategy, confidence, warning = detect_header_row(non_empty_rows)
    original_first_row = non_empty_rows[0][1]
    header_row_index, header_row = non_empty_rows[selected_non_empty_index]
    header_values = header_row[:MAX_WORKSHEET_COLUMNS]
    existing: set[str] = set()
    columns: list[str] = []
    duplicate_count = 0
    empty_count = 0

    for index, value in enumerate(header_values):
        column_name, duplicate, empty = normalize_header(value, index, existing)
        columns.append(column_name)
        duplicate_count += 1 if duplicate else 0
        empty_count += 1 if empty else 0

    data_rows = [
        [*(row[: len(columns)]), *([None] * max(0, len(columns) - len(row)))]
        for _, row in non_empty_rows[
            selected_non_empty_index + 1 : selected_non_empty_index + MAX_WORKSHEET_ROWS + 1
        ]
    ]
    data_rows = [row[: len(columns)] for row in data_rows]
    (
        structural_column_candidates,
        structural_column_detection_warning,
        structural_column_detection_confidence,
        structural_column_sample_size,
        recommended_hidden_columns,
    ) = detect_structural_column_candidates(
        columns=columns,
        data_rows=data_rows,
        header_detection_strategy=strategy,
    )

    return NormalizedWorksheetRows(
        columns=columns,
        data_rows=data_rows,
        duplicate_column_count=duplicate_count,
        empty_column_count=empty_count,
        header_row_index=header_row_index,
        skipped_leading_rows=header_row_index,
        header_detection_strategy=strategy,
        header_detection_confidence=confidence,
        header_detection_warning=warning,
        original_first_row_preview=preview_row_values(original_first_row),
        selected_header_row_preview=preview_row_values(header_row),
        structural_column_candidates=structural_column_candidates,
        structural_column_detection_warning=structural_column_detection_warning,
        structural_column_detection_confidence=structural_column_detection_confidence,
        structural_column_sample_size=structural_column_sample_size,
        recommended_hidden_columns=recommended_hidden_columns,
    )


def read_shared_strings(workbook_zip: zipfile.ZipFile) -> list[str]:
    try:
        xml_content = workbook_zip.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    root = ET.fromstring(xml_content)
    values: list[str] = []
    for item in root.findall("main:si", XML_NS):
        text_parts = [text.text or "" for text in item.findall(".//main:t", XML_NS)]
        values.append("".join(text_parts))
    return values


def read_workbook_sheets(workbook_zip: zipfile.ZipFile) -> list[dict[str, str]]:
    workbook_root = ET.fromstring(workbook_zip.read("xl/workbook.xml"))
    rels_root = ET.fromstring(workbook_zip.read("xl/_rels/workbook.xml.rels"))
    relationships = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in rels_root.findall("pkg_rel:Relationship", XML_NS)
    }
    sheets: list[dict[str, str]] = []

    for sheet in workbook_root.findall("main:sheets/main:sheet", XML_NS):
        relationship_id = sheet.attrib.get(f"{{{XML_NS['rel']}}}id")
        target = relationships.get(relationship_id or "")
        if not target:
            continue
        normalized_target = target.lstrip("/")
        sheet_path = (
            normalized_target
            if normalized_target.startswith("xl/")
            else f"xl/{normalized_target}"
        )
        if not sheet_path.startswith("xl/worksheets/") and "worksheets/" in sheet_path:
            sheet_path = "xl/" + sheet_path.split("xl/", 1)[-1]
        sheets.append({
            "name": sheet.attrib.get("name", f"Sheet {len(sheets) + 1}"),
            "path": sheet_path,
        })

    return sheets[:MAX_WORKSHEETS]


def parse_xlsx_sheet(workbook_zip: zipfile.ZipFile, sheet_path: str, shared_strings: list[str]) -> list[list[Any]]:
    root = ET.fromstring(workbook_zip.read(sheet_path))
    rows: list[list[Any]] = []

    for row in root.findall(".//main:sheetData/main:row", XML_NS):
        row_values: list[Any] = []
        for cell in row.findall("main:c", XML_NS):
            reference = cell.attrib.get("r", "")
            _, column_index = cell_reference_to_indexes(reference)
            while len(row_values) <= column_index:
                row_values.append(None)

            cell_type = cell.attrib.get("t")
            value_node = cell.find("main:v", XML_NS)
            inline_text = cell.find("main:is/main:t", XML_NS)
            value: Any = None

            if cell_type == "inlineStr":
                value = inline_text.text if inline_text is not None else None
            elif value_node is not None:
                raw_value = value_node.text or ""
                if cell_type == "s":
                    value = shared_strings[int(raw_value)] if raw_value.isdigit() and int(raw_value) < len(shared_strings) else raw_value
                elif cell_type == "b":
                    value = raw_value == "1"
                else:
                    value = raw_value

            row_values[column_index] = value
        rows.append(row_values)

    return rows


def parse_xlsx_workbook(path: Path) -> list[dict[str, Any]]:
    try:
        with zipfile.ZipFile(path) as workbook_zip:
            shared_strings = read_shared_strings(workbook_zip)
            sheets = read_workbook_sheets(workbook_zip)
            return [
                {
                    "name": sheet["name"],
                    "rows": parse_xlsx_sheet(workbook_zip, sheet["path"], shared_strings),
                }
                for sheet in sheets
            ]
    except (zipfile.BadZipFile, KeyError, ET.ParseError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Workbook could not be read as a valid XLSX file") from error


def parse_xls_workbook(path: Path) -> list[dict[str, Any]]:
    try:
        import xlrd  # type: ignore
    except ImportError as error:
        raise HTTPException(
            status_code=400,
            detail="Legacy XLS uploads require the optional xlrd backend dependency",
        ) from error

    workbook = xlrd.open_workbook(str(path))
    sheets: list[dict[str, Any]] = []
    for sheet in workbook.sheets()[:MAX_WORKSHEETS]:
        rows = [
            [sheet.cell_value(row_index, column_index) for column_index in range(sheet.ncols)]
            for row_index in range(min(sheet.nrows, MAX_WORKSHEET_ROWS + 1))
        ]
        sheets.append({"name": sheet.name, "rows": rows})
    return sheets


def create_table_from_rows(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    columns: list[str],
    rows: list[list[Any]],
) -> None:
    column_sql = ", ".join(f"{quote_identifier(column)} VARCHAR" for column in columns)
    connection.execute(f"CREATE TABLE {quote_identifier(table_name)} ({column_sql})")
    if not rows:
        return

    placeholders = ", ".join("?" for _ in columns)
    connection.executemany(
        f"INSERT INTO {quote_identifier(table_name)} VALUES ({placeholders})",
        [[None if value == "" else value for value in row] for row in rows],
    )


def profile_table(connection: duckdb.DuckDBPyConnection, table_name: str) -> tuple[list[dict[str, Any]], int, int]:
    table_identifier = quote_identifier(table_name)
    escaped_table_name = table_name.replace("'", "''")
    schema_rows = connection.execute(f"PRAGMA table_info('{escaped_table_name}')").fetchall()
    row_count = connection.execute(f"SELECT COUNT(*) FROM {table_identifier}").fetchone()[0]
    profiles: list[dict[str, Any]] = []

    for row in schema_rows:
        column_name = row[1]
        identifier = quote_identifier(column_name)
        null_count = connection.execute(
            f"SELECT COUNT(*) FROM {table_identifier} WHERE {identifier} IS NULL"
        ).fetchone()[0]
        unique_count = connection.execute(
            f"SELECT COUNT(DISTINCT {identifier}) FROM {table_identifier}"
        ).fetchone()[0]
        sample_values = [
            sample_row[0]
            for sample_row in connection.execute(
                f"SELECT DISTINCT {identifier} FROM {table_identifier} WHERE {identifier} IS NOT NULL LIMIT 12"
            ).fetchall()
        ]
        non_null_sample_text = [normalize_cell_text(value) for value in sample_values]
        non_null_sample_text = [value for value in non_null_sample_text if value]
        if non_null_sample_text and all(
            looks_like_numeric_value(value) for value in non_null_sample_text
        ):
            inferred_type = "numeric"
        elif non_null_sample_text and all(
            looks_like_date_value(value.lower()) for value in non_null_sample_text
        ):
            inferred_type = "date"
        else:
            inferred_type = (
                "categorical"
                if unique_count <= 50 and (row_count == 0 or unique_count / row_count < 0.8)
                else "text"
            )
        profiles.append({
            "name": column_name,
            "type": row[2],
            "inferred_type": inferred_type,
            "null_count": null_count,
            "unique_count": unique_count,
            "sample_values": sample_values,
        })

    return profiles, row_count, len(schema_rows)


def ingest_workbook(
    *,
    path: Path,
    original_filename: str,
    dataset_id: str,
    duckdb_path: Path,
    uploaded_at: str,
) -> dict[str, Any]:
    if path.stat().st_size > MAX_WORKBOOK_FILE_BYTES:
        raise HTTPException(status_code=400, detail="Workbook is too large for this prototype")

    suffix = path.suffix.lower()
    raw_sheets = parse_xlsx_workbook(path) if suffix == ".xlsx" else parse_xls_workbook(path)
    if not raw_sheets:
        raise HTTPException(status_code=400, detail="Workbook does not contain readable worksheets")

    worksheets: list[WorksheetMetadata] = []
    active_table_name: str | None = None
    active_schema: list[dict[str, Any]] = []
    active_row_count = 0
    active_column_count = 0
    relationship_candidates = []

    with duckdb.connect(str(duckdb_path)) as connection:
        for index, sheet in enumerate(raw_sheets[:MAX_WORKSHEETS]):
            sheet_name = sheet["name"]
            table_name = generate_safe_worksheet_table_name(sheet_name, index)
            normalized_rows = normalize_rows(sheet["rows"])
            (
                template_structure_candidate,
                template_structure_confidence,
                template_structure_evidence,
            ) = detect_template_structure(
                sheet["rows"],
                normalized_rows.header_row_index,
            )
            columns = normalized_rows.columns
            rows = normalized_rows.data_rows
            status = "ready" if columns else "empty"
            schema: list[dict[str, Any]] = []
            row_count = 0
            column_count = len(columns)

            if columns:
                create_table_from_rows(connection, table_name, columns, rows)
                schema, row_count, column_count = profile_table(connection, table_name)
                if active_table_name is None:
                    active_table_name = table_name
                    active_schema = schema
                    active_row_count = row_count
                    active_column_count = column_count

            worksheets.append(
                WorksheetMetadata(
                    worksheet_id=f"{dataset_id}:worksheet:{index + 1}",
                    workbook_id=dataset_id,
                    sheet_name=sheet_name,
                    display_name=sheet_name,
                    table_name=table_name,
                    original_index=index,
                    status=status,
                    schema=schema,
                    row_count=row_count,
                    column_count=column_count,
                    visible_columns=[column["name"] for column in schema],
                    hidden_columns=[],
                    normalization=WorksheetNormalizationMetadata(
                        normalized_at=uploaded_at,
                        header_row_index=normalized_rows.header_row_index,
                        skipped_leading_rows=normalized_rows.skipped_leading_rows,
                        header_detection_strategy=normalized_rows.header_detection_strategy,
                        header_detection_confidence=normalized_rows.header_detection_confidence,
                        header_detection_warning=normalized_rows.header_detection_warning,
                        original_first_row_preview=normalized_rows.original_first_row_preview,
                        selected_header_row_preview=normalized_rows.selected_header_row_preview,
                        structural_column_candidates=normalized_rows.structural_column_candidates,
                        structural_column_detection_warning=(
                            normalized_rows.structural_column_detection_warning
                        ),
                        structural_column_detection_confidence=(
                            normalized_rows.structural_column_detection_confidence
                        ),
                        structural_column_sample_size=normalized_rows.structural_column_sample_size,
                        recommended_hidden_columns=normalized_rows.recommended_hidden_columns,
                        duplicate_column_count=normalized_rows.duplicate_column_count,
                        empty_column_count=normalized_rows.empty_column_count,
                        template_structure_candidate=template_structure_candidate,
                        template_structure_confidence=template_structure_confidence,
                        template_structure_evidence=template_structure_evidence,
                        warnings=[
                            warning
                            for warning in [
                                normalized_rows.header_detection_warning,
                                normalized_rows.structural_column_detection_warning,
                                None
                                if status == "ready"
                                else "Worksheet is empty and was not loaded as an active table.",
                            ]
                            if warning
                        ],
                    ),
                )
            )

        if not active_table_name:
            raise HTTPException(status_code=400, detail="Workbook does not contain a non-empty worksheet")

        connection.execute(f"CREATE VIEW {quote_identifier(ACTIVE_TABLE_NAME)} AS SELECT * FROM {quote_identifier(active_table_name)}")
        preview_result = connection.execute(
            f"SELECT * FROM {quote_identifier(ACTIVE_TABLE_NAME)} LIMIT ?",
            [MAX_PREVIEW_ROWS],
        )
        preview_columns = [description[0] for description in preview_result.description]
        preview = [dict(zip(preview_columns, row)) for row in preview_result.fetchall()]
        relationship_candidates = profile_relationship_candidates(connection, dataset_id, worksheets)

    workbook_metadata = WorkbookMetadata(
        workbook_id=dataset_id,
        workspace_id=dataset_id,
        name=original_filename,
        status="ready",
        source_file=WorkbookSourceFileMetadata(
            original_filename=original_filename,
            stored_path=str(path),
            mime_type=None,
            byte_size=path.stat().st_size,
            uploaded_at=uploaded_at,
        ),
        worksheet_ids=[worksheet.worksheet_id for worksheet in worksheets],
        active_worksheet_id=next(
            worksheet.worksheet_id for worksheet in worksheets if worksheet.table_name == active_table_name
        ),
        worksheets=worksheets,
        table_mappings=[
            WorksheetTableMapping(
                sheet_name=worksheet.sheet_name,
                table_name=worksheet.table_name,
                original_index=worksheet.original_index,
            )
            for worksheet in worksheets
        ],
        relationship_candidates=relationship_candidates,
        accepted_relationship_contracts=[],
        ingestion_profile=WorkbookIngestionProfile(
            max_worksheets=MAX_WORKSHEETS,
            max_rows_per_worksheet_profile=MAX_WORKSHEET_ROWS,
            max_columns_per_worksheet=MAX_WORKSHEET_COLUMNS,
            max_preview_rows=MAX_PREVIEW_ROWS,
        ),
        normalization=WorkbookNormalizationMetadata(
            normalized_at=uploaded_at,
            status="normalized",
            warnings=[],
        ),
        created_at=uploaded_at,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

    workbook_metadata_payload = workbook_metadata.model_dump(by_alias=True)
    workbook_metadata_payload["source_registry"] = create_original_source_registry(
        dataset_id=dataset_id,
        workbook_id=dataset_id,
        uploaded_file_path=path,
        worksheets=worksheets,
    )

    return {
        "preview": preview[:MAX_PREVIEW_ROWS],
        "active_table_name": ACTIVE_TABLE_NAME,
        "active_worksheet_table_name": active_table_name,
        "schema": active_schema,
        "row_count": active_row_count,
        "column_count": active_column_count,
        "workbook_metadata": workbook_metadata_payload,
    }
