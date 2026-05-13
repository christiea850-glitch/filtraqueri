from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def contract_id_for_candidate(candidate_id: str) -> str:
    safe_id = "".join(character if character.isalnum() or character in "_-" else "_" for character in candidate_id)
    return f"contract_{safe_id[:150]}"


def validate_contract(contract: dict[str, Any], workbook_metadata: dict[str, Any]) -> dict[str, Any]:
    worksheets = workbook_metadata.get("worksheets") if isinstance(workbook_metadata.get("worksheets"), list) else []
    worksheet_by_id = {
        worksheet.get("worksheet_id"): worksheet
        for worksheet in worksheets
        if isinstance(worksheet, dict) and worksheet.get("worksheet_id")
    }
    messages: list[str] = []
    validation_state = "valid"
    status = contract.get("status") if contract.get("status") in ("active", "invalid", "stale") else "active"

    source = worksheet_by_id.get(contract.get("source_worksheet_id"))
    target = worksheet_by_id.get(contract.get("target_worksheet_id"))
    if not source:
        messages.append("Source worksheet is missing.")
        validation_state = "broken"
        status = "invalid"
    if not target:
        messages.append("Target worksheet is missing.")
        validation_state = "broken"
        status = "invalid"

    if source:
        if source.get("table_name") != contract.get("source_table_name"):
            messages.append("Source table mapping changed.")
            validation_state = "warning" if validation_state != "broken" else validation_state
            if status == "active":
                status = "stale"
        source_schema = source.get("schema") if isinstance(source.get("schema"), list) else []
        source_column = next(
            (
                column
                for column in source_schema
                if isinstance(column, dict) and column.get("name") == contract.get("source_column_name")
            ),
            None,
        )
        if not source_column:
            messages.append("Source column is missing.")
            validation_state = "broken"
            status = "invalid"
    else:
        source_column = None

    if target:
        if target.get("table_name") != contract.get("target_table_name"):
            messages.append("Target table mapping changed.")
            validation_state = "warning" if validation_state != "broken" else validation_state
            if status == "active":
                status = "stale"
        target_schema = target.get("schema") if isinstance(target.get("schema"), list) else []
        target_column = next(
            (
                column
                for column in target_schema
                if isinstance(column, dict) and column.get("name") == contract.get("target_column_name")
            ),
            None,
        )
        if not target_column:
            messages.append("Target column is missing.")
            validation_state = "broken"
            status = "invalid"
    else:
        target_column = None

    inferred_type_compatible = bool(contract.get("inferred_type_compatible"))
    if source_column and target_column:
        source_type = source_column.get("inferred_type")
        target_type = target_column.get("inferred_type")
        inferred_type_compatible = (
            source_type == target_type
            or {source_type, target_type}.issubset({"text", "categorical"})
            or {source_type, target_type}.issubset({"numeric", "categorical"})
        )
        if not inferred_type_compatible:
            messages.append("Inferred types are no longer compatible.")
            validation_state = "warning" if validation_state != "broken" else validation_state
            if status == "active":
                status = "stale"

    if not messages:
        messages.append("Relationship contract references are valid.")

    return {
        **contract,
        "status": status,
        "validation_state": validation_state,
        "validation_summary": messages,
        "inferred_type_compatible": inferred_type_compatible,
        "last_validated_at": now_iso(),
    }


def create_contract_from_candidate(
    candidate: dict[str, Any],
    workbook_metadata: dict[str, Any],
    *,
    accepted_by: str | None = "local-workspace",
) -> dict[str, Any]:
    accepted_at = now_iso()
    contract = {
        "contract_id": contract_id_for_candidate(str(candidate.get("relationship_id") or "relationship")),
        "source_worksheet_id": str(candidate.get("source_worksheet_id") or ""),
        "source_table_name": str(candidate.get("source_table") or ""),
        "source_column_name": str(candidate.get("source_column") or ""),
        "target_worksheet_id": str(candidate.get("target_worksheet_id") or ""),
        "target_table_name": str(candidate.get("target_table") or ""),
        "target_column_name": str(candidate.get("target_column") or ""),
        "relationship_type": candidate.get("relationship_type") or "unknown_candidate",
        "confidence": max(0, min(1, float(candidate.get("confidence") or 0))),
        "accepted_from_candidate_id": str(candidate.get("relationship_id") or ""),
        "accepted_at": accepted_at,
        "accepted_by": accepted_by,
        "status": "active",
        "validation_state": "warning",
        "validation_summary": [],
        "overlap_ratio": max(0, min(1, float(candidate.get("evidence", {}).get("sampled_overlap_ratio") or 0))),
        "source_unique_ratio": max(0, min(1, float(candidate.get("evidence", {}).get("source_unique_ratio") or 0))),
        "target_unique_ratio": max(0, min(1, float(candidate.get("evidence", {}).get("target_unique_ratio") or 0))),
        "inferred_type_compatible": bool(candidate.get("evidence", {}).get("type_compatible")),
        "last_validated_at": None,
    }
    return validate_contract(contract, workbook_metadata)


def upsert_contract_for_candidate(
    workbook_metadata: dict[str, Any],
    candidate: dict[str, Any],
    review_status: str,
) -> dict[str, Any]:
    contracts = (
        workbook_metadata.get("accepted_relationship_contracts")
        if isinstance(workbook_metadata.get("accepted_relationship_contracts"), list)
        else []
    )
    candidate_id = str(candidate.get("relationship_id") or "")
    contract_index = next(
        (
            index
            for index, contract in enumerate(contracts)
            if isinstance(contract, dict) and contract.get("accepted_from_candidate_id") == candidate_id
        ),
        None,
    )

    if review_status == "accepted":
        contract = create_contract_from_candidate(candidate, workbook_metadata)
        if contract_index is None:
            contracts.append(contract)
        else:
            existing = contracts[contract_index]
            contracts[contract_index] = {
                **contract,
                "accepted_at": existing.get("accepted_at") or contract["accepted_at"],
                "accepted_by": existing.get("accepted_by") or contract["accepted_by"],
            }
    elif contract_index is not None and review_status == "dismissed":
        contracts[contract_index] = validate_contract(
            {
                **contracts[contract_index],
                "status": "stale",
                "validation_state": "warning",
                "validation_summary": ["Source candidate was dismissed."],
            },
            workbook_metadata,
        )

    workbook_metadata["accepted_relationship_contracts"] = validate_relationship_contracts(
        {**workbook_metadata, "accepted_relationship_contracts": contracts}
    )
    return workbook_metadata


def validate_relationship_contracts(workbook_metadata: dict[str, Any]) -> list[dict[str, Any]]:
    contracts = (
        workbook_metadata.get("accepted_relationship_contracts")
        if isinstance(workbook_metadata.get("accepted_relationship_contracts"), list)
        else []
    )
    return [
        validate_contract(contract, workbook_metadata)
        for contract in contracts
        if isinstance(contract, dict)
    ]
