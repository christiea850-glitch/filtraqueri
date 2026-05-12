from __future__ import annotations

from collections import defaultdict
from typing import Any
import re

import duckdb

from .workbook_models import (
    WorksheetMetadata,
    WorksheetRelationshipCandidate,
    WorksheetRelationshipEvidence,
)


MAX_RELATIONSHIP_CANDIDATES = 30
MAX_RELATIONSHIP_SAMPLE_VALUES = 1000


def quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) + chr(34))}"'


def normalize_column_name(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower()).strip("_")
    return re.sub(r"_+", "_", normalized)


def base_column_name(value: str) -> str:
    normalized = normalize_column_name(value)
    for suffix in ("_id", "_key", "_code", "_number", "_no"):
        if normalized.endswith(suffix):
            return normalized[: -len(suffix)]
    return normalized


def stable_relationship_id(
    workbook_id: str,
    source_worksheet_id: str,
    source_column: str,
    target_worksheet_id: str,
    target_column: str,
) -> str:
    raw_value = "|".join(
        [
            workbook_id,
            source_worksheet_id,
            normalize_column_name(source_column),
            target_worksheet_id,
            normalize_column_name(target_column),
        ]
    )
    safe_value = re.sub(r"[^a-zA-Z0-9_]+", "_", raw_value).strip("_")
    return f"rel_{safe_value[:140]}"


def values_for_column(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    column_name: str,
) -> set[str]:
    rows = connection.execute(
        f"""
        SELECT DISTINCT {quote_identifier(column_name)}
        FROM {quote_identifier(table_name)}
        WHERE {quote_identifier(column_name)} IS NOT NULL
        LIMIT ?
        """,
        [MAX_RELATIONSHIP_SAMPLE_VALUES],
    ).fetchall()
    return {str(row[0]) for row in rows if row and row[0] not in (None, "")}


def column_unique_ratio(column: dict[str, Any], row_count: int) -> float:
    if row_count <= 0:
        return 0
    unique_count = column.get("unique_count")
    return min(1, max(0, float(unique_count or 0) / row_count))


def name_similarity(source_column: str, target_column: str) -> float:
    source_name = normalize_column_name(source_column)
    target_name = normalize_column_name(target_column)
    source_base = base_column_name(source_column)
    target_base = base_column_name(target_column)

    if source_name == target_name:
        return 1
    if source_base and source_base == target_base:
        return 0.86
    if source_base and source_base in target_name:
        return 0.72
    if target_base and target_base in source_name:
        return 0.72
    return 0


def is_key_pattern(column_name: str) -> bool:
    normalized = normalize_column_name(column_name)
    return normalized == "id" or normalized.endswith(("_id", "_key", "_code"))


def infer_relationship_type(
    source_unique_ratio: float,
    target_unique_ratio: float,
) -> tuple[str, str]:
    source_unique = source_unique_ratio >= 0.9
    target_unique = target_unique_ratio >= 0.9

    if source_unique and target_unique:
        return "one_to_one_candidate", "bidirectional"
    if source_unique and not target_unique:
        return "one_to_many_candidate", "source_to_target"
    if target_unique and not source_unique:
        return "many_to_one_candidate", "target_to_source"
    return "unknown_candidate", "unknown"


def confidence_label(score: float) -> str:
    if score >= 0.75:
        return "high"
    if score >= 0.52:
        return "medium"
    return "low"


def type_compatible(source_column: dict[str, Any], target_column: dict[str, Any]) -> bool:
    source_type = source_column.get("inferred_type")
    target_type = target_column.get("inferred_type")
    if source_type == target_type:
        return True
    compatible_groups = [
        {"text", "categorical"},
        {"numeric", "categorical"},
    ]
    return any({source_type, target_type}.issubset(group) for group in compatible_groups)


def relationship_evidence_summaries(
    *,
    name_score: float,
    overlap_ratio: float,
    source_column: str,
    target_column: str,
    source_unique_ratio: float,
    target_unique_ratio: float,
    compatible: bool,
) -> list[str]:
    summaries: list[str] = []

    if name_score >= 1:
        summaries.append("matching normalized names")
    elif name_score >= 0.7:
        summaries.append("similar key names")
    if overlap_ratio > 0:
        summaries.append(f"{round(overlap_ratio * 100)}% value overlap")
    if is_key_pattern(source_column) or is_key_pattern(target_column):
        summaries.append("key naming pattern detected")
    if source_unique_ratio >= 0.9 or target_unique_ratio >= 0.9:
        summaries.append("unique key pattern detected")
    if compatible:
        summaries.append("matching inferred types")

    return summaries[:5]


def build_column_index(worksheet: WorksheetMetadata) -> dict[str, dict[str, Any]]:
    return {
        column.get("name"): column
        for column in worksheet.schema_
        if isinstance(column.get("name"), str)
    }


def profile_relationship_candidates(
    connection: duckdb.DuckDBPyConnection,
    workbook_id: str,
    worksheets: list[WorksheetMetadata],
) -> list[WorksheetRelationshipCandidate]:
    ready_worksheets = [worksheet for worksheet in worksheets if worksheet.status == "ready"]
    sampled_values: dict[tuple[str, str], set[str]] = {}
    candidates: list[WorksheetRelationshipCandidate] = []
    seen_pairs: set[tuple[str, str, str, str]] = set()

    for source_index, source_worksheet in enumerate(ready_worksheets):
        source_columns = build_column_index(source_worksheet)
        for target_worksheet in ready_worksheets[source_index + 1 :]:
            target_columns = build_column_index(target_worksheet)
            worksheet_candidates: list[WorksheetRelationshipCandidate] = []

            for source_column_name, source_column in source_columns.items():
                for target_column_name, target_column in target_columns.items():
                    name_score = name_similarity(source_column_name, target_column_name)
                    if name_score <= 0 and not (
                        is_key_pattern(source_column_name) and is_key_pattern(target_column_name)
                    ):
                        continue

                    compatible = type_compatible(source_column, target_column)
                    if not compatible and name_score < 1:
                        continue

                    source_key = (source_worksheet.table_name, source_column_name)
                    target_key = (target_worksheet.table_name, target_column_name)
                    if source_key not in sampled_values:
                        sampled_values[source_key] = values_for_column(
                            connection,
                            source_worksheet.table_name,
                            source_column_name,
                        )
                    if target_key not in sampled_values:
                        sampled_values[target_key] = values_for_column(
                            connection,
                            target_worksheet.table_name,
                            target_column_name,
                        )

                    source_values = sampled_values[source_key]
                    target_values = sampled_values[target_key]
                    if source_values and target_values:
                        overlap_ratio = len(source_values & target_values) / max(
                            1,
                            min(len(source_values), len(target_values)),
                        )
                    else:
                        overlap_ratio = 0

                    source_unique_ratio = column_unique_ratio(source_column, source_worksheet.row_count)
                    target_unique_ratio = column_unique_ratio(target_column, target_worksheet.row_count)
                    relationship_type, direction = infer_relationship_type(
                        source_unique_ratio,
                        target_unique_ratio,
                    )
                    score = min(
                        1,
                        (name_score * 0.38)
                        + (overlap_ratio * 0.36)
                        + ((1 if compatible else 0) * 0.12)
                        + ((max(source_unique_ratio, target_unique_ratio)) * 0.14),
                    )

                    if score < 0.38:
                        continue

                    source_id = source_worksheet.worksheet_id
                    target_id = target_worksheet.worksheet_id
                    pair_key = (source_id, source_column_name, target_id, target_column_name)
                    reverse_pair_key = (target_id, target_column_name, source_id, source_column_name)
                    if pair_key in seen_pairs or reverse_pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    summaries = relationship_evidence_summaries(
                        name_score=name_score,
                        overlap_ratio=overlap_ratio,
                        source_column=source_column_name,
                        target_column=target_column_name,
                        source_unique_ratio=source_unique_ratio,
                        target_unique_ratio=target_unique_ratio,
                        compatible=compatible,
                    )
                    worksheet_candidates.append(
                        WorksheetRelationshipCandidate(
                            relationship_id=stable_relationship_id(
                                workbook_id,
                                source_id,
                                source_column_name,
                                target_id,
                                target_column_name,
                            ),
                            workbook_id=workbook_id,
                            source_worksheet_id=source_id,
                            source_worksheet_name=source_worksheet.display_name,
                            source_table=source_worksheet.table_name,
                            source_column=source_column_name,
                            target_worksheet_id=target_id,
                            target_worksheet_name=target_worksheet.display_name,
                            target_table=target_worksheet.table_name,
                            target_column=target_column_name,
                            confidence=round(score, 3),
                            confidence_label=confidence_label(score),
                            relationship_type=relationship_type,
                            direction=direction,
                            evidence=WorksheetRelationshipEvidence(
                                name_similarity=round(name_score, 3),
                                type_compatible=compatible,
                                source_unique_ratio=round(source_unique_ratio, 3),
                                target_unique_ratio=round(target_unique_ratio, 3),
                                sampled_overlap_ratio=round(overlap_ratio, 3),
                                sampled_row_count=min(len(source_values), len(target_values)),
                                summaries=summaries,
                            ),
                        )
                    )

            by_column_group: dict[str, list[WorksheetRelationshipCandidate]] = defaultdict(list)
            for candidate in worksheet_candidates:
                by_column_group[
                    f"{normalize_column_name(candidate.source_column)}:{normalize_column_name(candidate.target_column)}"
                ].append(candidate)
            for grouped_candidates in by_column_group.values():
                candidates.append(
                    sorted(grouped_candidates, key=lambda candidate: candidate.confidence, reverse=True)[0]
                )

    return sorted(candidates, key=lambda candidate: candidate.confidence, reverse=True)[
        :MAX_RELATIONSHIP_CANDIDATES
    ]
