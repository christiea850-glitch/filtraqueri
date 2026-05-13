from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def diagnostic(
    *,
    contract_id: str,
    severity: str,
    issue_type: str,
    issue_summary: str,
    suggested_action: str,
    affected_source: str,
    affected_target: str,
) -> dict[str, Any]:
    safe_issue = "".join(character if character.isalnum() else "_" for character in issue_type)
    return {
        "diagnostic_id": f"diag_{contract_id}_{safe_issue}",
        "contract_id": contract_id,
        "severity": severity,
        "issue_type": issue_type,
        "issue_summary": issue_summary,
        "suggested_action": suggested_action,
        "affected_source": affected_source,
        "affected_target": affected_target,
        "checked_at": now_iso(),
    }


def find_column(worksheet: dict[str, Any] | None, column_name: str) -> dict[str, Any] | None:
    if not worksheet:
        return None
    schema = worksheet.get("schema") if isinstance(worksheet.get("schema"), list) else []
    return next(
        (
            column
            for column in schema
            if isinstance(column, dict) and column.get("name") == column_name
        ),
        None,
    )


def analyze_contract_diagnostics(
    workbook_metadata: dict[str, Any],
    existing_tables: set[str] | None = None,
) -> dict[str, Any]:
    existing_tables = existing_tables or set()
    worksheets = workbook_metadata.get("worksheets") if isinstance(workbook_metadata.get("worksheets"), list) else []
    contracts = (
        workbook_metadata.get("accepted_relationship_contracts")
        if isinstance(workbook_metadata.get("accepted_relationship_contracts"), list)
        else []
    )
    candidates = (
        workbook_metadata.get("relationship_candidates")
        if isinstance(workbook_metadata.get("relationship_candidates"), list)
        else []
    )
    worksheet_by_id = {
        worksheet.get("worksheet_id"): worksheet
        for worksheet in worksheets
        if isinstance(worksheet, dict) and worksheet.get("worksheet_id")
    }
    candidate_ids = {
        candidate.get("relationship_id")
        for candidate in candidates
        if isinstance(candidate, dict) and candidate.get("relationship_id")
    }
    diagnostics: list[dict[str, Any]] = []

    for contract in contracts:
        if not isinstance(contract, dict):
            continue

        contract_id = str(contract.get("contract_id") or "relationship_contract")
        source_worksheet_id = str(contract.get("source_worksheet_id") or "")
        target_worksheet_id = str(contract.get("target_worksheet_id") or "")
        source_table = str(contract.get("source_table_name") or "")
        target_table = str(contract.get("target_table_name") or "")
        source_column = str(contract.get("source_column_name") or "")
        target_column = str(contract.get("target_column_name") or "")
        affected_source = f"{source_table}.{source_column}"
        affected_target = f"{target_table}.{target_column}"
        source_worksheet = worksheet_by_id.get(source_worksheet_id)
        target_worksheet = worksheet_by_id.get(target_worksheet_id)

        if not source_worksheet:
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="broken",
                issue_type="missing_worksheet",
                issue_summary="Source worksheet was removed or cannot be restored.",
                suggested_action="Worksheet was removed",
                affected_source=affected_source,
                affected_target=affected_target,
            ))
        if not target_worksheet:
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="broken",
                issue_type="missing_worksheet",
                issue_summary="Target worksheet was removed or cannot be restored.",
                suggested_action="Worksheet was removed",
                affected_source=affected_source,
                affected_target=affected_target,
            ))

        for worksheet, table_name, side in (
            (source_worksheet, source_table, "source"),
            (target_worksheet, target_table, "target"),
        ):
            if worksheet and worksheet.get("status") != "ready":
                diagnostics.append(diagnostic(
                    contract_id=contract_id,
                    severity="broken",
                    issue_type="unsupported_worksheet_state",
                    issue_summary=f"{side.title()} worksheet is not ready.",
                    suggested_action="Select a different worksheet",
                    affected_source=affected_source,
                    affected_target=affected_target,
                ))
            if worksheet and worksheet.get("table_name") != table_name:
                diagnostics.append(diagnostic(
                    contract_id=contract_id,
                    severity="warning",
                    issue_type="stale_worksheet_mapping",
                    issue_summary=f"{side.title()} worksheet table mapping has changed.",
                    suggested_action="Re-accept a new relationship candidate",
                    affected_source=affected_source,
                    affected_target=affected_target,
                ))
            if table_name and existing_tables and table_name not in existing_tables:
                diagnostics.append(diagnostic(
                    contract_id=contract_id,
                    severity="broken",
                    issue_type=f"missing_{side}_table",
                    issue_summary=f"{side.title()} table is missing from the workbook session.",
                    suggested_action="Re-profile workbook relationships",
                    affected_source=affected_source,
                    affected_target=affected_target,
                ))

        source_column_meta = find_column(source_worksheet, source_column)
        target_column_meta = find_column(target_worksheet, target_column)
        if source_worksheet and not source_column_meta:
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="broken",
                issue_type="missing_source_column",
                issue_summary="Source column no longer exists.",
                suggested_action="Column no longer exists",
                affected_source=affected_source,
                affected_target=affected_target,
            ))
        if target_worksheet and not target_column_meta:
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="broken",
                issue_type="missing_target_column",
                issue_summary="Target column no longer exists.",
                suggested_action="Column no longer exists",
                affected_source=affected_source,
                affected_target=affected_target,
            ))

        if source_column_meta and target_column_meta and not contract.get("inferred_type_compatible"):
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="warning",
                issue_type="inferred_type_mismatch",
                issue_summary="Source and target inferred types are not compatible.",
                suggested_action="Re-profile workbook relationships",
                affected_source=affected_source,
                affected_target=affected_target,
            ))
        if float(contract.get("overlap_ratio") or 0) < 0.2:
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="warning",
                issue_type="low_overlap_ratio",
                issue_summary="Relationship evidence has low sampled value overlap.",
                suggested_action="Relationship confidence too low",
                affected_source=affected_source,
                affected_target=affected_target,
            ))
        if not contract.get("accepted_from_candidate_id") or contract.get("accepted_from_candidate_id") not in candidate_ids:
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="warning",
                issue_type="stale_relationship_candidate_reference",
                issue_summary="Accepted relationship no longer references an available candidate.",
                suggested_action="Re-accept a new relationship candidate",
                affected_source=affected_source,
                affected_target=affected_target,
            ))
        if not contract.get("last_validated_at"):
            diagnostics.append(diagnostic(
                contract_id=contract_id,
                severity="warning",
                issue_type="missing_evidence_metadata",
                issue_summary="Validation timestamp or evidence metadata is incomplete.",
                suggested_action="Evidence metadata missing",
                affected_source=affected_source,
                affected_target=affected_target,
            ))

    contract_ids_with_issues = {diagnostic["contract_id"] for diagnostic in diagnostics}
    for contract in contracts:
        if isinstance(contract, dict) and contract.get("contract_id") not in contract_ids_with_issues:
            diagnostics.append(diagnostic(
                contract_id=str(contract.get("contract_id")),
                severity="healthy",
                issue_type="healthy_contract",
                issue_summary="Relationship contract references are healthy.",
                suggested_action="No action needed",
                affected_source=f"{contract.get('source_table_name')}.{contract.get('source_column_name')}",
                affected_target=f"{contract.get('target_table_name')}.{contract.get('target_column_name')}",
            ))

    summary = {
        "healthy": sum(1 for item in diagnostics if item["severity"] == "healthy"),
        "warning": sum(1 for item in diagnostics if item["severity"] == "warning"),
        "broken": sum(1 for item in diagnostics if item["severity"] == "broken"),
        "stale": sum(
            1
            for contract in contracts
            if isinstance(contract, dict) and contract.get("status") == "stale"
        ),
        "total_contracts": len([contract for contract in contracts if isinstance(contract, dict)]),
    }
    return {"diagnostics": diagnostics, "summary": summary}
