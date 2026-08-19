"""Source-registry helpers for original workbook worksheets.

This module builds on the closed S1 A1-parity helpers. SHA-256 is used only as
materialization evidence over uploaded bytes plus a worksheet locator; A1 FNV
fingerprints remain deterministic contract identities, not content integrity.
"""

from __future__ import annotations

import hashlib
from collections.abc import Mapping
from copy import deepcopy
from pathlib import Path
from typing import Any

from .workbook_source_contracts import (
    canonicalize_for_worksheet_source,
    create_deterministic_worksheet_source_fingerprint,
)


WORKBOOK_SOURCE_REGISTRY_VERSION = "workbook-source-registry:v1"
WORKBOOK_SOURCE_MATERIALIZATION_VERSION = "worksheet-materialization:v1"
WORKBOOK_SOURCE_MATERIALIZATION_ALGORITHM = "sha256"
WORKSHEET_SOURCE_IDENTITY_VERSION = "worksheet-source-identity:v1"
WORKSHEET_SOURCE_REVISION_VERSION = "worksheet-source-revision:v1"
WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION = "worksheet-structural-schema-fingerprint:v1"

SOURCE_REGISTRY_LEGACY_REASON = "source_registry_missing_legacy"
SOURCE_REGISTRY_VERSION_UNSUPPORTED_REASON = "source_registry_version_unsupported"
SOURCE_REGISTRY_MALFORMED_REASON = "source_registry_malformed"
SOURCE_IDENTITY_INVALID_REASON = "source_identity_invalid"
SOURCE_REVISION_INVALID_REASON = "source_revision_invalid"
CURRENT_REVISION_MISSING_REASON = "current_revision_missing"
STRUCTURAL_FINGERPRINT_MISMATCH_REASON = "structural_fingerprint_mismatch"
MATERIALIZATION_FINGERPRINT_MISMATCH_REASON = "materialization_fingerprint_mismatch"
DUPLICATE_CONFLICTING_RECORD_REASON = "duplicate_conflicting_record"


def _failure(reason_codes: list[str], registry: dict[str, Any] | None = None) -> dict[str, Any]:
    output = deepcopy(registry) if isinstance(registry, dict) else {}
    output["version"] = output.get("version") or WORKBOOK_SOURCE_REGISTRY_VERSION
    output["status"] = "invalid"
    output["readiness"] = {"ready": False, "reason_codes": sorted(set(reason_codes))}
    return output


def _canonical_hash(value: Any) -> str:
    return create_deterministic_worksheet_source_fingerprint("source-registry-canonical", value)


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_materialization_fingerprint(
    *,
    uploaded_file_sha256: str,
    worksheet_locator: dict[str, Any],
) -> dict[str, Any]:
    payload = {
        "version": WORKBOOK_SOURCE_MATERIALIZATION_VERSION,
        "algorithm": WORKBOOK_SOURCE_MATERIALIZATION_ALGORITHM,
        "source_file_sha256": uploaded_file_sha256,
        "worksheet_locator": worksheet_locator,
    }
    digest = hashlib.sha256(
        canonicalize_for_worksheet_source(payload).encode("utf-8")
    ).hexdigest()
    return {
        "version": WORKBOOK_SOURCE_MATERIALIZATION_VERSION,
        "algorithm": WORKBOOK_SOURCE_MATERIALIZATION_ALGORITHM,
        "digest": digest,
        "payload": payload,
    }


def create_original_source_identity(
    *,
    dataset_id: str,
    workbook_id: str,
    worksheet_id: str,
) -> dict[str, Any]:
    identity = {
        "version": WORKSHEET_SOURCE_IDENTITY_VERSION,
        "datasetId": dataset_id,
        "workbookId": workbook_id,
        "worksheetId": worksheet_id,
        "sourceKind": "original",
        "cleanedLineageId": None,
    }
    return {
        **identity,
        "sourceId": create_deterministic_worksheet_source_fingerprint(
            "worksheet-source", identity
        ),
    }


def create_structural_schema_fingerprint(schema: list[dict[str, Any]]) -> dict[str, Any]:
    columns = []
    for ordinal, column in enumerate(schema):
        columns.append(
            {
                "columnId": None,
                "ordinal": ordinal,
                "name": str(column.get("name") or ""),
                "physicalType": str(column.get("type") or ""),
                "logicalType": str(column.get("inferred_type") or column.get("type") or ""),
                "nullable": None,
            }
        )
    normalized_columns = sorted(
        columns,
        key=lambda column: (column["ordinal"], column["name"]),
    )
    payload = {
        "version": WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION,
        "columns": normalized_columns,
    }
    return {
        "version": WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION,
        "fingerprint": create_deterministic_worksheet_source_fingerprint(
            "worksheet-structural-schema", payload
        ),
        "columns": normalized_columns,
    }


def create_source_revision(
    *,
    source_identity: dict[str, Any],
    table_name: str,
    structural_schema_fingerprint: dict[str, Any],
    materialization_fingerprint: dict[str, Any],
) -> dict[str, Any]:
    revision = {
        "version": WORKSHEET_SOURCE_REVISION_VERSION,
        "sourceIdentity": deepcopy(source_identity),
        "tableName": table_name,
        "structuralSchemaFingerprint": deepcopy(structural_schema_fingerprint),
        "materializationFingerprint": materialization_fingerprint["digest"],
        "transformationLineageId": None,
    }
    return {
        **revision,
        "revisionId": create_deterministic_worksheet_source_fingerprint(
            "worksheet-source-revision", revision
        ),
    }


def _worksheet_field(worksheet: Any, field_name: str) -> Any:
    if isinstance(worksheet, Mapping):
        return worksheet.get(field_name)
    return getattr(worksheet, field_name, None)


def _extract_worksheet_schema(worksheet: Any) -> list[dict[str, Any]]:
    if isinstance(worksheet, Mapping):
        schema_value = worksheet.get("schema_")
        if schema_value is None:
            schema_value = worksheet.get("schema")
    else:
        schema_value = getattr(worksheet, "schema_", None)

    if callable(schema_value):
        raise ValueError("Worksheet schema field is callable.")
    if not isinstance(schema_value, list):
        raise ValueError("Worksheet schema field must be a list of column objects.")

    schema: list[dict[str, Any]] = []
    for column in schema_value:
        if not isinstance(column, Mapping):
            raise ValueError("Worksheet schema entries must be objects.")
        schema.append(dict(column))

    column_count = _worksheet_field(worksheet, "column_count")
    if isinstance(column_count, int) and column_count > 0 and not schema:
        raise ValueError("Ready worksheet has columns but no structural schema.")

    return schema


def create_original_source_registry(
    *,
    dataset_id: str,
    workbook_id: str,
    uploaded_file_path: Path,
    worksheets: list[Any],
) -> dict[str, Any]:
    uploaded_file_sha256 = _file_sha256(uploaded_file_path)
    sources: list[dict[str, Any]] = []
    revisions: list[dict[str, Any]] = []
    current_revision_by_source_id: dict[str, str] = {}

    for worksheet in worksheets:
        if _worksheet_field(worksheet, "status") != "ready":
            continue
        schema = _extract_worksheet_schema(worksheet)
        worksheet_id = str(_worksheet_field(worksheet, "worksheet_id"))
        worksheet_locator = {
            "workbookId": workbook_id,
            "worksheetId": worksheet_id,
            "sheetName": str(_worksheet_field(worksheet, "sheet_name")),
            "originalIndex": int(_worksheet_field(worksheet, "original_index")),
        }
        source_identity = create_original_source_identity(
            dataset_id=dataset_id,
            workbook_id=workbook_id,
            worksheet_id=worksheet_id,
        )
        structural_schema_fingerprint = create_structural_schema_fingerprint(schema)
        materialization_fingerprint = create_materialization_fingerprint(
            uploaded_file_sha256=uploaded_file_sha256,
            worksheet_locator=worksheet_locator,
        )
        revision = create_source_revision(
            source_identity=source_identity,
            table_name=str(_worksheet_field(worksheet, "table_name")),
            structural_schema_fingerprint=structural_schema_fingerprint,
            materialization_fingerprint=materialization_fingerprint,
        )
        source_record = {
            "source_identity": source_identity,
            "source_id": source_identity["sourceId"],
            "dataset_id": dataset_id,
            "workbook_id": workbook_id,
            "worksheet_id": worksheet_id,
            "source_kind": "original",
            "worksheet_locator": worksheet_locator,
            "table_name": str(_worksheet_field(worksheet, "table_name")),
        }
        revision_record = {
            "revision": revision,
            "revision_id": revision["revisionId"],
            "source_id": source_identity["sourceId"],
            "dataset_id": dataset_id,
            "workbook_id": workbook_id,
            "worksheet_id": worksheet_id,
            "source_kind": "original",
            "table_name": str(_worksheet_field(worksheet, "table_name")),
            "worksheet_locator": worksheet_locator,
            "materialization_fingerprint": materialization_fingerprint,
            "structural_schema_fingerprint": structural_schema_fingerprint,
        }
        sources.append(source_record)
        revisions.append(revision_record)
        current_revision_by_source_id[source_identity["sourceId"]] = revision["revisionId"]

    sources.sort(key=lambda source: source["source_id"])
    revisions.sort(key=lambda revision: revision["revision_id"])
    registry = {
        "version": WORKBOOK_SOURCE_REGISTRY_VERSION,
        "status": "ready",
        "readiness": {"ready": True, "reason_codes": []},
        "source_kinds": ["original"],
        "sources": sources,
        "revisions": revisions,
        "current_revision_by_source_id": dict(sorted(current_revision_by_source_id.items())),
    }
    return registry


def validate_source_registry(registry: Any) -> dict[str, Any] | None:
    if registry is None:
        return None
    if not isinstance(registry, dict):
        return _failure([SOURCE_REGISTRY_MALFORMED_REASON])
    if registry.get("version") != WORKBOOK_SOURCE_REGISTRY_VERSION:
        return _failure([SOURCE_REGISTRY_VERSION_UNSUPPORTED_REASON], registry)

    try:
        normalized = deepcopy(registry)
        sources = normalized.get("sources")
        revisions = normalized.get("revisions")
        current = normalized.get("current_revision_by_source_id")
        if not isinstance(sources, list) or not isinstance(revisions, list) or not isinstance(current, dict):
            return _failure([SOURCE_REGISTRY_MALFORMED_REASON], registry)

        reason_codes: list[str] = []
        source_hashes: dict[str, str] = {}
        revision_hashes: dict[str, str] = {}
        source_ids: set[str] = set()
        revision_ids: set[str] = set()

        for source in sources:
            if not isinstance(source, dict) or not isinstance(source.get("source_identity"), dict):
                reason_codes.append(SOURCE_IDENTITY_INVALID_REASON)
                continue
            identity = source["source_identity"]
            expected_id = create_deterministic_worksheet_source_fingerprint(
                "worksheet-source",
                {key: identity[key] for key in ["version", "datasetId", "workbookId", "worksheetId", "sourceKind", "cleanedLineageId"]},
            )
            source_id = identity.get("sourceId")
            if source_id != expected_id or source.get("source_id") != source_id:
                reason_codes.append(SOURCE_IDENTITY_INVALID_REASON)
                continue
            source_hash = _canonical_hash(source)
            if source_id in source_hashes and source_hashes[source_id] != source_hash:
                reason_codes.append(DUPLICATE_CONFLICTING_RECORD_REASON)
            source_hashes[source_id] = source_hash
            source_ids.add(source_id)

        for revision_record in revisions:
            if not isinstance(revision_record, dict) or not isinstance(revision_record.get("revision"), dict):
                reason_codes.append(SOURCE_REVISION_INVALID_REASON)
                continue
            revision = revision_record["revision"]
            structural = revision.get("structuralSchemaFingerprint")
            materialization = revision_record.get("materialization_fingerprint")
            if not isinstance(structural, dict) or not isinstance(materialization, dict):
                reason_codes.append(SOURCE_REVISION_INVALID_REASON)
                continue
            structural_payload = {
                "version": WORKSHEET_STRUCTURAL_SCHEMA_FINGERPRINT_VERSION,
                "columns": structural.get("columns"),
            }
            if structural.get("fingerprint") != create_deterministic_worksheet_source_fingerprint(
                "worksheet-structural-schema",
                structural_payload,
            ):
                reason_codes.append(STRUCTURAL_FINGERPRINT_MISMATCH_REASON)
            materialization_payload = materialization.get("payload")
            if not isinstance(materialization_payload, dict):
                reason_codes.append(MATERIALIZATION_FINGERPRINT_MISMATCH_REASON)
            else:
                expected_digest = hashlib.sha256(
                    canonicalize_for_worksheet_source(materialization_payload).encode("utf-8")
                ).hexdigest()
                if materialization.get("digest") != expected_digest:
                    reason_codes.append(MATERIALIZATION_FINGERPRINT_MISMATCH_REASON)
            revision_payload = {
                "version": revision.get("version"),
                "sourceIdentity": revision.get("sourceIdentity"),
                "tableName": revision.get("tableName"),
                "structuralSchemaFingerprint": structural,
                "materializationFingerprint": revision.get("materializationFingerprint"),
                "transformationLineageId": revision.get("transformationLineageId"),
            }
            expected_revision_id = create_deterministic_worksheet_source_fingerprint(
                "worksheet-source-revision",
                revision_payload,
            )
            revision_id = revision.get("revisionId")
            if (
                revision.get("version") != WORKSHEET_SOURCE_REVISION_VERSION
                or revision_id != expected_revision_id
                or revision_record.get("revision_id") != revision_id
                or revision.get("materializationFingerprint") != materialization.get("digest")
                or revision_record.get("source_id") not in source_ids
            ):
                reason_codes.append(SOURCE_REVISION_INVALID_REASON)
            revision_hash = _canonical_hash(revision_record)
            if revision_id in revision_hashes and revision_hashes[revision_id] != revision_hash:
                reason_codes.append(DUPLICATE_CONFLICTING_RECORD_REASON)
            revision_hashes[revision_id] = revision_hash
            revision_ids.add(str(revision_id))

        for source_id, revision_id in current.items():
            if source_id not in source_ids or revision_id not in revision_ids:
                reason_codes.append(CURRENT_REVISION_MISSING_REASON)

        if reason_codes:
            return _failure(reason_codes, registry)

        normalized["status"] = "ready"
        normalized["readiness"] = {"ready": True, "reason_codes": []}
        normalized["sources"] = sorted(sources, key=lambda source: source["source_id"])
        normalized["revisions"] = sorted(revisions, key=lambda revision: revision["revision_id"])
        normalized["current_revision_by_source_id"] = dict(sorted(current.items()))
        return normalized
    except Exception:
        return _failure([SOURCE_REGISTRY_MALFORMED_REASON], registry)
