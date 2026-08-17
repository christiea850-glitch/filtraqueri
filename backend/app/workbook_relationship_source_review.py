from __future__ import annotations

from copy import deepcopy
from typing import Any
import math

import duckdb

from backend.app.workbook_relationships import (
    MAX_RELATIONSHIP_SAMPLE_VALUES,
    infer_relationship_type,
    quote_identifier,
    type_compatible,
)
from backend.app.workbook_source_contracts import (
    create_deterministic_worksheet_source_fingerprint,
)
from backend.app.workbook_source_registry import (
    WORKBOOK_SOURCE_REGISTRY_VERSION,
    validate_source_registry,
)


SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION = "relationship-review-source-aware:v1"
RELATIONSHIP_REVIEW_STATE_REVISION_VERSION = "relationship-review-state-revision:v1"
RELATIONSHIP_CANDIDATE_REVISION_VERSION = "relationship-candidate-revision:v1"
RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION = "relationship-evidence-fingerprint:v1"
RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION = "relationship-endpoint-signature:v1"
RELATIONSHIP_SOURCE_VALIDATION_VERSION = "relationship-source-validation:v1"
RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION = "relationship-source-validation-ledger:v1"
RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION = "relationship-source-acceptance-history:v1"
RELATIONSHIP_EVIDENCE_POLICY_VERSION = "relationship-evidence-policy:v2"
RELATIONSHIP_OVERLAP_POLICY_ID = "sampled-overlap:v1"

SOURCE_AWARE_EXPECTATION_FIELDS = (
    "expected_relationship_review_state_revision",
    "expected_candidate_revision_id",
    "expected_source_endpoint_signature_id",
    "expected_target_endpoint_signature_id",
    "expected_source_revision_id",
    "expected_target_revision_id",
    "expected_relationship_evidence_fingerprint",
)


class RelationshipSourceReviewError(ValueError):
    def __init__(
        self,
        status_code: int,
        reason_code: str,
        *,
        authority: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(reason_code)
        self.status_code = status_code
        self.reason_code = reason_code
        self.authority = authority or {}


def clone_json(value: Any) -> Any:
    return deepcopy(value)


def _unique_sorted(values: list[str]) -> list[str]:
    return sorted(set(values))


def _safe_float(value: Any) -> float:
    parsed = float(value)
    if parsed != parsed or parsed < 0:
        raise ValueError("Invalid numeric evidence.")
    return parsed


def _ratio(value: float) -> float:
    if value < 0 or value > 1:
        raise ValueError("Invalid ratio evidence.")
    return round(value, 3)


def _checked_column_unique_ratio(column: dict[str, Any], row_count: int) -> float:
    if row_count <= 0:
        return 0
    unique_count = float(column.get("unique_count") or 0)
    if not math.isfinite(unique_count) or unique_count < 0:
        raise ValueError("Invalid numeric evidence.")
    return min(1, max(0, unique_count / row_count))


def _column_index(workbook_metadata: dict[str, Any]) -> dict[str, dict[str, Any]]:
    output: dict[str, dict[str, Any]] = {}
    for worksheet in workbook_metadata.get("worksheets") or []:
        if not isinstance(worksheet, dict):
            continue
        worksheet_id = str(worksheet.get("worksheet_id") or "")
        for ordinal, column in enumerate(worksheet.get("schema") or []):
            if isinstance(column, dict) and column.get("name"):
                output[f"{worksheet_id}:{column.get('name')}"] = {
                    "worksheet": worksheet,
                    "column": column,
                    "ordinal": ordinal,
                }
    return output


def _source_by_worksheet(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(source.get("worksheet_id")): source
        for source in registry.get("sources") or []
        if isinstance(source, dict)
    }


def _revision_by_id(registry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        str(revision.get("revision_id")): revision
        for revision in registry.get("revisions") or []
        if isinstance(revision, dict)
    }


def _endpoint_for_candidate(
    *,
    candidate: dict[str, Any],
    workbook_metadata: dict[str, Any],
    registry: dict[str, Any],
    role: str,
) -> dict[str, Any]:
    worksheet_key = f"{role}_worksheet_id"
    table_key = f"{role}_table"
    column_key = f"{role}_column"
    worksheet_id = str(candidate.get(worksheet_key) or "")
    column_name = str(candidate.get(column_key) or "")
    source = _source_by_worksheet(registry).get(worksheet_id)
    if not source:
        raise RelationshipSourceReviewError(409, "source_registry_missing_legacy")
    if source.get("source_kind") != "original":
        raise RelationshipSourceReviewError(409, "cleaned_or_mixed_source_unsupported")

    current_revision_id = (registry.get("current_revision_by_source_id") or {}).get(
        source.get("source_id")
    )
    revision_record = _revision_by_id(registry).get(str(current_revision_id))
    if not revision_record:
        raise RelationshipSourceReviewError(409, "source_revision_mismatch")
    if revision_record.get("source_kind") != "original":
        raise RelationshipSourceReviewError(409, "cleaned_or_mixed_source_unsupported")

    column_entry = _column_index(workbook_metadata).get(f"{worksheet_id}:{column_name}")
    if not column_entry:
        raise RelationshipSourceReviewError(409, "endpoint_missing")
    worksheet = column_entry["worksheet"]
    column = column_entry["column"]
    if str(worksheet.get("table_name") or "") != str(candidate.get(table_key) or ""):
        raise RelationshipSourceReviewError(409, "endpoint_missing")
    if str(revision_record.get("table_name") or "") != str(worksheet.get("table_name") or ""):
        raise RelationshipSourceReviewError(409, "endpoint_signature_mismatch")

    structural = revision_record.get("structural_schema_fingerprint")
    structural_columns = structural.get("columns") if isinstance(structural, dict) else []
    structural_column = next(
        (
            item
            for item in structural_columns
            if isinstance(item, dict)
            and int(item.get("ordinal") or 0) == int(column_entry["ordinal"])
            and item.get("name") == column_name
        ),
        None,
    )
    if not structural_column:
        raise RelationshipSourceReviewError(409, "structural_schema_mismatch")

    physical_type = str(column.get("type") or structural_column.get("physicalType") or "")
    logical_type = str(column.get("inferred_type") or column.get("type") or "")
    if structural_column.get("physicalType") != physical_type:
        raise RelationshipSourceReviewError(409, "endpoint_signature_mismatch")
    if structural_column.get("logicalType") != logical_type:
        raise RelationshipSourceReviewError(409, "endpoint_signature_mismatch")

    signature = {
        "version": RELATIONSHIP_ENDPOINT_SIGNATURE_VERSION,
        "sourceRevisionId": revision_record["revision_id"],
        "sourceId": source["source_id"],
        "datasetId": source["dataset_id"],
        "workbookId": source["workbook_id"],
        "worksheetId": worksheet_id,
        "sourceKind": "original",
        "tableName": str(worksheet.get("table_name") or ""),
        "structuralSchemaFingerprint": structural["fingerprint"],
        "columnId": structural_column.get("columnId"),
        "columnName": column_name,
        "columnOrdinal": int(column_entry["ordinal"]),
        "physicalType": physical_type,
        "logicalType": logical_type,
    }
    return {
        **signature,
        "endpointSignatureId": create_deterministic_worksheet_source_fingerprint(
            "relationship-endpoint",
            signature,
        ),
    }


def _candidate_key_evidence(unique_ratio: float) -> str:
    if unique_ratio >= 0.98:
        return "unique"
    if unique_ratio >= 0.8:
        return "mostly_unique"
    return "not_unique"


def _cardinality_evidence(relationship_type: str) -> str:
    return {
        "one_to_one_candidate": "one_to_one",
        "one_to_many_candidate": "one_to_many",
        "many_to_one_candidate": "many_to_one",
    }.get(relationship_type, "unknown")


def _count_distinct_and_nulls(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    column_name: str,
) -> tuple[int, int]:
    row = connection.execute(
        f"""
        SELECT
          COUNT(*) AS row_count,
          COUNT(*) FILTER (WHERE {quote_identifier(column_name)} IS NULL) AS null_count,
          COUNT(DISTINCT {quote_identifier(column_name)}) AS distinct_count
        FROM {quote_identifier(table_name)}
        """
    ).fetchone()
    if not row:
        raise ValueError("Evidence query returned no data.")
    return int(row[1] or 0), int(row[2] or 0)


def deterministic_values_for_column(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    column_name: str,
    *,
    limit: int = MAX_RELATIONSHIP_SAMPLE_VALUES,
) -> tuple[str, ...]:
    rows = connection.execute(
        f"""
        SELECT DISTINCT CAST({quote_identifier(column_name)} AS VARCHAR) AS sampled_value
        FROM {quote_identifier(table_name)}
        WHERE {quote_identifier(column_name)} IS NOT NULL
          AND CAST({quote_identifier(column_name)} AS VARCHAR) <> ''
        ORDER BY sampled_value ASC
        LIMIT ?
        """,
        [limit],
    ).fetchall()
    return tuple(str(row[0]) for row in rows if row and row[0] not in (None, ""))


def create_relationship_evidence_fingerprint(
    *,
    connection: duckdb.DuckDBPyConnection,
    candidate: dict[str, Any],
    source_column: dict[str, Any],
    target_column: dict[str, Any],
    source_worksheet: dict[str, Any],
    target_worksheet: dict[str, Any],
    evidence_policy_version: str = RELATIONSHIP_EVIDENCE_POLICY_VERSION,
) -> dict[str, Any]:
    if evidence_policy_version != RELATIONSHIP_EVIDENCE_POLICY_VERSION:
        raise RelationshipSourceReviewError(409, "evidence_policy_version_unsupported")
    source_values = deterministic_values_for_column(
        connection,
        str(candidate.get("source_table") or ""),
        str(candidate.get("source_column") or ""),
    )
    target_values = deterministic_values_for_column(
        connection,
        str(candidate.get("target_table") or ""),
        str(candidate.get("target_column") or ""),
    )
    source_null_count, source_distinct_count = _count_distinct_and_nulls(
        connection,
        str(candidate.get("source_table") or ""),
        str(candidate.get("source_column") or ""),
    )
    source_row_count = int(source_worksheet.get("row_count") or 0)
    source_unique_ratio = _safe_float(
        _checked_column_unique_ratio(source_column, source_row_count)
    )
    target_unique_ratio = _safe_float(
        _checked_column_unique_ratio(target_column, int(target_worksheet.get("row_count") or 0))
    )
    source_value_set = set(source_values)
    target_value_set = set(target_values)
    if source_value_set and target_value_set:
        overlap_count = len(source_value_set & target_value_set)
        overlap_ratio = overlap_count / max(1, min(len(source_values), len(target_values)))
    else:
        overlap_count = 0
        overlap_ratio = 0
    relationship_type, _ = infer_relationship_type(
        source_unique_ratio,
        target_unique_ratio,
    )
    if relationship_type != candidate.get("relationship_type"):
        relationship_type = str(candidate.get("relationship_type") or relationship_type)
    evidence = {
        "rowCount": source_row_count,
        "nullCount": source_null_count,
        "distinctCount": source_distinct_count,
        "uniquenessRatio": _ratio(source_unique_ratio),
        "cardinalityEvidence": _cardinality_evidence(relationship_type),
        "candidateKeyEvidence": _candidate_key_evidence(source_unique_ratio),
        "overlapPolicyId": RELATIONSHIP_OVERLAP_POLICY_ID,
        "sampledOverlapRatio": _ratio(overlap_ratio),
        "sampledOverlapCount": min(overlap_count, MAX_RELATIONSHIP_SAMPLE_VALUES),
    }
    if any(
        not isinstance(evidence[key], int) or evidence[key] < 0
        for key in ("rowCount", "nullCount", "distinctCount", "sampledOverlapCount")
    ):
        raise RelationshipSourceReviewError(409, "evidence_invalid")
    return {
        "version": RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION,
        "fingerprint": create_deterministic_worksheet_source_fingerprint(
            "relationship-evidence",
            {
                "version": RELATIONSHIP_EVIDENCE_FINGERPRINT_VERSION,
                "evidence": evidence,
            },
        ),
        "evidence": evidence,
        "policyVersion": evidence_policy_version,
        "sampleLimit": MAX_RELATIONSHIP_SAMPLE_VALUES,
    }


def relationship_validation_direction(candidate: dict[str, Any]) -> str:
    return "symmetric" if candidate.get("direction") == "bidirectional" else "directed"


def create_relationship_validation(
    *,
    relationship_id: str,
    direction: str,
    source_endpoint: dict[str, Any],
    target_endpoint: dict[str, Any],
    evidence_fingerprint: dict[str, Any],
    status: str = "valid",
    reason_codes: list[str] | None = None,
) -> dict[str, Any]:
    ordered = [source_endpoint, target_endpoint]
    if direction == "symmetric":
        ordered = sorted(ordered, key=lambda endpoint: endpoint["endpointSignatureId"])
    identity_payload = {
        "version": RELATIONSHIP_SOURCE_VALIDATION_VERSION,
        "relationshipId": relationship_id,
        "direction": direction,
        "endpoints": [
            {
                "endpointSignatureId": endpoint["endpointSignatureId"],
                "sourceRevisionId": endpoint["sourceRevisionId"],
            }
            for endpoint in ordered
        ],
    }
    validation_identity = create_deterministic_worksheet_source_fingerprint(
        "relationship-source-validation",
        identity_payload,
    )
    reasons = _unique_sorted(reason_codes or [])
    return {
        "version": RELATIONSHIP_SOURCE_VALIDATION_VERSION,
        "relationshipId": relationship_id,
        "direction": direction,
        "validationIdentity": validation_identity,
        "assessmentId": create_deterministic_worksheet_source_fingerprint(
            "relationship-source-assessment",
            {
                "validationIdentity": validation_identity,
                "evidenceFingerprint": evidence_fingerprint["fingerprint"],
                "status": status,
                "reasonCodes": reasons,
            },
        ),
        "leftEndpoint": clone_json(source_endpoint),
        "rightEndpoint": clone_json(target_endpoint),
        "evidenceFingerprint": clone_json(evidence_fingerprint),
        "status": status,
        "reasonCodes": reasons,
    }


def create_candidate_authority(
    *,
    connection: duckdb.DuckDBPyConnection,
    workbook_metadata: dict[str, Any],
    candidate: dict[str, Any],
    evidence_policy_version: str = RELATIONSHIP_EVIDENCE_POLICY_VERSION,
) -> dict[str, Any]:
    registry = validate_source_registry(workbook_metadata.get("source_registry"))
    if not registry:
        raise RelationshipSourceReviewError(409, "source_registry_missing_legacy")
    if registry.get("version") != WORKBOOK_SOURCE_REGISTRY_VERSION:
        raise RelationshipSourceReviewError(400, "source_registry_invalid")
    if not registry.get("readiness", {}).get("ready"):
        raise RelationshipSourceReviewError(409, "source_registry_invalid")

    source_endpoint = _endpoint_for_candidate(
        candidate=candidate,
        workbook_metadata=workbook_metadata,
        registry=registry,
        role="source",
    )
    target_endpoint = _endpoint_for_candidate(
        candidate=candidate,
        workbook_metadata=workbook_metadata,
        registry=registry,
        role="target",
    )
    if source_endpoint["sourceKind"] != "original" or target_endpoint["sourceKind"] != "original":
        raise RelationshipSourceReviewError(409, "cleaned_or_mixed_source_unsupported")

    column_lookup = _column_index(workbook_metadata)
    source_entry = column_lookup[
        f"{candidate.get('source_worksheet_id')}:{candidate.get('source_column')}"
    ]
    target_entry = column_lookup[
        f"{candidate.get('target_worksheet_id')}:{candidate.get('target_column')}"
    ]
    if not type_compatible(source_entry["column"], target_entry["column"]):
        raise RelationshipSourceReviewError(409, "endpoint_signature_mismatch")
    evidence_fingerprint = create_relationship_evidence_fingerprint(
        connection=connection,
        candidate=candidate,
        source_column=source_entry["column"],
        target_column=target_entry["column"],
        source_worksheet=source_entry["worksheet"],
        target_worksheet=target_entry["worksheet"],
        evidence_policy_version=evidence_policy_version,
    )
    candidate_revision_payload = {
        "version": RELATIONSHIP_CANDIDATE_REVISION_VERSION,
        "relationshipId": str(candidate.get("relationship_id") or ""),
        "relationshipType": str(candidate.get("relationship_type") or ""),
        "direction": str(candidate.get("direction") or ""),
        "sourceEndpointSignatureId": source_endpoint["endpointSignatureId"],
        "targetEndpointSignatureId": target_endpoint["endpointSignatureId"],
        "sourceRevisionId": source_endpoint["sourceRevisionId"],
        "targetRevisionId": target_endpoint["sourceRevisionId"],
        "evidencePolicyVersion": evidence_policy_version,
        "evidenceFingerprint": evidence_fingerprint["fingerprint"],
    }
    direction = relationship_validation_direction(candidate)
    validation = create_relationship_validation(
        relationship_id=str(candidate.get("relationship_id") or ""),
        direction=direction,
        source_endpoint=source_endpoint,
        target_endpoint=target_endpoint,
        evidence_fingerprint=evidence_fingerprint,
    )
    return {
        "relationshipReviewRequestVersion": SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION,
        "candidateRevisionId": create_deterministic_worksheet_source_fingerprint(
            "relationship-candidate-revision",
            candidate_revision_payload,
        ),
        "candidateRevisionPayload": candidate_revision_payload,
        "sourceEndpoint": source_endpoint,
        "targetEndpoint": target_endpoint,
        "sourceRevisionId": source_endpoint["sourceRevisionId"],
        "targetRevisionId": target_endpoint["sourceRevisionId"],
        "relationshipEvidenceFingerprint": evidence_fingerprint,
        "evidencePolicyVersion": evidence_policy_version,
        "validation": validation,
    }


def normalize_relationship_source_validation_ledger(value: Any) -> dict[str, Any]:
    if value is None:
        return {
            "version": RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
            "status": "ready",
            "readiness": {"ready": True, "reason_codes": []},
            "records": [],
            "current_validation_by_relationship_id": {},
        }
    if not isinstance(value, dict):
        return _invalid_ledger(["relationship_validation_ledger_malformed"])
    if value.get("version") != RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION:
        output = clone_json(value)
        output["status"] = "invalid"
        output["readiness"] = {
            "ready": False,
            "reason_codes": ["relationship_validation_ledger_version_unsupported"],
        }
        return output
    records = value.get("records")
    current = value.get("current_validation_by_relationship_id")
    if not isinstance(records, list) or not isinstance(current, dict):
        return _invalid_ledger(["relationship_validation_ledger_malformed"], value)

    reasons: list[str] = []
    by_assessment: dict[str, str] = {}
    validation_ids: set[str] = set()
    for record in records:
        if not isinstance(record, dict):
            reasons.append("relationship_validation_record_malformed")
            continue
        validation = record.get("validation")
        if not isinstance(validation, dict):
            reasons.append("relationship_validation_record_malformed")
            continue
        try:
            expected = create_relationship_validation(
                relationship_id=str(validation.get("relationshipId") or ""),
                direction=str(validation.get("direction") or ""),
                source_endpoint=validation.get("leftEndpoint") or {},
                target_endpoint=validation.get("rightEndpoint") or {},
                evidence_fingerprint=validation.get("evidenceFingerprint") or {},
                status=str(validation.get("status") or "valid"),
                reason_codes=list(validation.get("reasonCodes") or []),
            )
        except (KeyError, TypeError, ValueError):
            reasons.append("relationship_validation_record_malformed")
            continue
        if (
            validation.get("version") != RELATIONSHIP_SOURCE_VALIDATION_VERSION
            or validation.get("validationIdentity") != expected["validationIdentity"]
            or validation.get("assessmentId") != expected["assessmentId"]
        ):
            reasons.append("relationship_validation_record_tampered")
            continue
        record_id = str(record.get("validation_record_id") or "")
        expected_record_id = create_deterministic_worksheet_source_fingerprint(
            "relationship-source-validation-record",
            {
                "version": RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
                "validation": validation,
            },
        )
        if record_id != expected_record_id:
            reasons.append("relationship_validation_record_tampered")
        record_hash = create_deterministic_worksheet_source_fingerprint(
            "relationship-source-validation-record-canonical",
            record,
        )
        assessment_id = str(validation.get("assessmentId") or "")
        if assessment_id in by_assessment and by_assessment[assessment_id] != record_hash:
            reasons.append("duplicate_conflicting_record")
        by_assessment[assessment_id] = record_hash
        validation_ids.add(assessment_id)

    for relationship_id, assessment_id in current.items():
        if not relationship_id or assessment_id not in validation_ids:
            reasons.append("relationship_validation_projection_invalid")

    if reasons:
        return _invalid_ledger(reasons, value)

    return {
        **clone_json(value),
        "status": "ready",
        "readiness": {"ready": True, "reason_codes": []},
        "records": sorted(
            records,
            key=lambda record: str(record.get("validation_record_id") or ""),
        ),
        "current_validation_by_relationship_id": dict(sorted(current.items())),
    }


def _invalid_ledger(
    reason_codes: list[str],
    value: dict[str, Any] | None = None,
) -> dict[str, Any]:
    output = clone_json(value) if isinstance(value, dict) else {}
    output["version"] = output.get("version") or RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION
    output["status"] = "invalid"
    output["readiness"] = {"ready": False, "reason_codes": _unique_sorted(reason_codes)}
    output.setdefault("records", [])
    output.setdefault("current_validation_by_relationship_id", {})
    return output


def normalize_relationship_acceptance_history(value: Any) -> dict[str, Any]:
    if value is None:
        return {
            "version": RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
            "status": "ready",
            "readiness": {"ready": True, "reason_codes": []},
            "records": [],
            "current_acceptance_by_relationship_id": {},
        }
    if not isinstance(value, dict) or value.get("version") != RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION:
        output = clone_json(value) if isinstance(value, dict) else {}
        output["version"] = output.get("version") or RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION
        output["status"] = "invalid"
        output["readiness"] = {
            "ready": False,
            "reason_codes": ["relationship_acceptance_history_version_unsupported"],
        }
        output.setdefault("records", [])
        output.setdefault("current_acceptance_by_relationship_id", {})
        return output
    records = value.get("records")
    current = value.get("current_acceptance_by_relationship_id")
    if not isinstance(records, list) or not isinstance(current, dict):
        output = clone_json(value)
        output["status"] = "invalid"
        output["readiness"] = {
            "ready": False,
            "reason_codes": ["relationship_acceptance_history_malformed"],
        }
        return output
    record_ids = {record.get("acceptance_record_id") for record in records if isinstance(record, dict)}
    if any(record_id not in record_ids for record_id in current.values()):
        output = clone_json(value)
        output["status"] = "invalid"
        output["readiness"] = {
            "ready": False,
            "reason_codes": ["relationship_acceptance_projection_invalid"],
        }
        return output
    return {
        **clone_json(value),
        "status": "ready",
        "readiness": {"ready": True, "reason_codes": []},
        "records": sorted(records, key=lambda record: str(record.get("acceptance_record_id") or "")),
        "current_acceptance_by_relationship_id": dict(sorted(current.items())),
    }


def relationship_review_state_revision(
    workbook_metadata: dict[str, Any],
    candidate_authority: dict[str, Any] | None = None,
) -> str:
    registry = validate_source_registry(workbook_metadata.get("source_registry"))
    if not registry or not registry.get("readiness", {}).get("ready"):
        raise RelationshipSourceReviewError(409, "source_registry_invalid")
    ledger = normalize_relationship_source_validation_ledger(
        workbook_metadata.get("relationship_source_validation_ledger")
    )
    history = normalize_relationship_acceptance_history(
        workbook_metadata.get("relationship_acceptance_history")
    )
    if not ledger.get("readiness", {}).get("ready"):
        raise RelationshipSourceReviewError(409, "validation_version_unsupported")
    if not history.get("readiness", {}).get("ready"):
        raise RelationshipSourceReviewError(409, "validation_version_unsupported")
    candidates = []
    for candidate in workbook_metadata.get("relationship_candidates") or []:
        if isinstance(candidate, dict):
            candidates.append(
                {
                    "relationshipId": candidate.get("relationship_id"),
                    "reviewStatus": candidate.get("review_status"),
                    "sourceWorksheetId": candidate.get("source_worksheet_id"),
                    "sourceTable": candidate.get("source_table"),
                    "sourceColumn": candidate.get("source_column"),
                    "targetWorksheetId": candidate.get("target_worksheet_id"),
                    "targetTable": candidate.get("target_table"),
                    "targetColumn": candidate.get("target_column"),
                    "relationshipType": candidate.get("relationship_type"),
                    "direction": candidate.get("direction"),
                }
            )
    accepted_contracts = []
    for contract in workbook_metadata.get("accepted_relationship_contracts") or []:
        if isinstance(contract, dict):
            accepted_contracts.append(
                {
                    key: value
                    for key, value in contract.items()
                    if key not in {"last_validated_at", "validation_summary"}
                }
            )
    payload = {
        "version": RELATIONSHIP_REVIEW_STATE_REVISION_VERSION,
        "sourceRegistryCurrentRevisions": registry.get("current_revision_by_source_id"),
        "relationshipCandidates": sorted(candidates, key=lambda item: str(item.get("relationshipId") or "")),
        "acceptedRelationshipContracts": sorted(
            accepted_contracts,
            key=lambda item: str(item.get("contract_id") or ""),
        ),
        "relationshipSourceValidationLedger": ledger,
        "relationshipAcceptanceHistory": history,
        "evidencePolicyVersion": RELATIONSHIP_EVIDENCE_POLICY_VERSION,
        "currentCandidateRevisionId": (candidate_authority or {}).get("candidateRevisionId"),
    }
    return create_deterministic_worksheet_source_fingerprint(
        "relationship-review-state-revision",
        payload,
    )


def append_validation_record(
    ledger: dict[str, Any],
    validation: dict[str, Any],
) -> tuple[dict[str, Any], str]:
    normalized = normalize_relationship_source_validation_ledger(ledger or None)
    if not normalized.get("readiness", {}).get("ready"):
        raise RelationshipSourceReviewError(409, "validation_version_unsupported")
    record_id = create_deterministic_worksheet_source_fingerprint(
        "relationship-source-validation-record",
        {
            "version": RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
            "validation": validation,
        },
    )
    records = list(normalized.get("records") or [])
    if not any(record.get("validation_record_id") == record_id for record in records if isinstance(record, dict)):
        records.append(
            {
                "validation_record_id": record_id,
                "validation": clone_json(validation),
                "eligibility": {
                    "eligible": validation.get("status") == "valid",
                    "reason_codes": list(validation.get("reasonCodes") or []),
                },
            }
        )
    current = dict(normalized.get("current_validation_by_relationship_id") or {})
    current[str(validation.get("relationshipId") or "")] = str(validation.get("assessmentId") or "")
    return normalize_relationship_source_validation_ledger(
        {
            "version": RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
            "records": records,
            "current_validation_by_relationship_id": current,
        }
    ), record_id


def append_acceptance_record(
    history: dict[str, Any],
    *,
    relationship_id: str,
    review_status: str,
    validation: dict[str, Any],
    contract_id: str,
) -> tuple[dict[str, Any], str]:
    normalized = normalize_relationship_acceptance_history(history or None)
    if not normalized.get("readiness", {}).get("ready"):
        raise RelationshipSourceReviewError(409, "validation_version_unsupported")
    record_payload = {
        "version": RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
        "relationship_id": relationship_id,
        "review_status": review_status,
        "validation_id": validation["assessmentId"],
        "validation_identity": validation["validationIdentity"],
        "contract_id": contract_id,
    }
    record_id = create_deterministic_worksheet_source_fingerprint(
        "relationship-source-acceptance",
        record_payload,
    )
    records = list(normalized.get("records") or [])
    if not any(record.get("acceptance_record_id") == record_id for record in records if isinstance(record, dict)):
        records.append({"acceptance_record_id": record_id, **record_payload})
    current = dict(normalized.get("current_acceptance_by_relationship_id") or {})
    current[relationship_id] = record_id
    return normalize_relationship_acceptance_history(
        {
            "version": RELATIONSHIP_ACCEPTANCE_HISTORY_VERSION,
            "records": records,
            "current_acceptance_by_relationship_id": current,
        }
    ), record_id


def compare_source_aware_expectations(
    *,
    request_values: dict[str, Any],
    current_state_revision: str,
    candidate_authority: dict[str, Any],
) -> None:
    checks = [
        ("expected_relationship_review_state_revision", current_state_revision, "relationship_review_state_stale"),
        ("expected_candidate_revision_id", candidate_authority["candidateRevisionId"], "candidate_revision_mismatch"),
        ("expected_source_endpoint_signature_id", candidate_authority["sourceEndpoint"]["endpointSignatureId"], "endpoint_signature_mismatch"),
        ("expected_target_endpoint_signature_id", candidate_authority["targetEndpoint"]["endpointSignatureId"], "endpoint_signature_mismatch"),
        ("expected_source_revision_id", candidate_authority["sourceRevisionId"], "source_revision_mismatch"),
        ("expected_target_revision_id", candidate_authority["targetRevisionId"], "source_revision_mismatch"),
        ("expected_relationship_evidence_fingerprint", candidate_authority["relationshipEvidenceFingerprint"]["fingerprint"], "evidence_fingerprint_mismatch"),
    ]
    for field, actual, reason in checks:
        if request_values.get(field) != actual:
            raise RelationshipSourceReviewError(
                409,
                reason,
                authority={
                    "relationship_review_state_revision": current_state_revision,
                    **candidate_authority,
                },
            )
