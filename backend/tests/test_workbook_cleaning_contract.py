import unittest

from fastapi import HTTPException
from pydantic import ValidationError

from backend.app.workbook_cleaning_contract import (
    WorkbookCleaningApplyRequest,
    validate_structural_decision_plan_scope,
)


WORKSHEET_ID = "dataset-1:worksheet:1"


def valid_decision_payload() -> dict:
    return {
        "recommendation_id": f"{WORKSHEET_ID}:automatic_blank_row:0",
        "evidence_type": "automatic_blank_row",
        "evidence_signal_id": f"{WORKSHEET_ID}:automatic_blank_row:0",
        "decision": "use_recommendation",
        "affected_rows": [7],
        "affected_column_indexes": [],
    }


class WorkbookCleaningContractTests(unittest.TestCase):
    def test_absent_structural_plan_is_backward_compatible(self) -> None:
        request = WorkbookCleaningApplyRequest()

        self.assertIsNone(request.structural_decision_plan)
        validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_empty_structural_plan_is_no_op(self) -> None:
        request = WorkbookCleaningApplyRequest(structural_decision_plan={})

        self.assertEqual(request.structural_decision_plan.decisions, [])
        validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_valid_snake_case_plan_is_accepted(self) -> None:
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_name": "managers",
                "decisions": [valid_decision_payload()],
            }
        )

        validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)
        self.assertEqual(request.structural_decision_plan.worksheet_id, WORKSHEET_ID)
        self.assertEqual(request.structural_decision_plan.decisions[0].affected_rows, [7])

    def test_camel_case_plan_is_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                structuralDecisionPlan={
                    "worksheetId": WORKSHEET_ID,
                    "decisions": [valid_decision_payload()],
                }
            )

    def test_scope_mismatch_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={
                "worksheet_id": "dataset-1:worksheet:2",
                "decisions": [valid_decision_payload()],
            }
        )

        with self.assertRaises(HTTPException):
            validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_non_empty_plan_requires_worksheet_id(self) -> None:
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={"decisions": [valid_decision_payload()]}
        )

        with self.assertRaises(HTTPException):
            validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_unresolved_decision_is_not_allowed(self) -> None:
        payload = valid_decision_payload()
        payload["decision"] = "unresolved"

        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                structural_decision_plan={"worksheet_id": WORKSHEET_ID, "decisions": [payload]}
            )

    def test_unsupported_evidence_type_is_rejected(self) -> None:
        payload = valid_decision_payload()
        payload["evidence_type"] = "sql_select_transform"

        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                structural_decision_plan={"worksheet_id": WORKSHEET_ID, "decisions": [payload]}
            )

    def test_duplicate_recommendation_ids_are_rejected(self) -> None:
        payload = valid_decision_payload()
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={
                "worksheet_id": WORKSHEET_ID,
                "decisions": [payload, payload],
            }
        )

        with self.assertRaises(HTTPException):
            validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_recommendation_id_must_be_route_scoped(self) -> None:
        payload = valid_decision_payload()
        payload["recommendation_id"] = "dataset-1:worksheet:2:automatic_blank_row:0"
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={"worksheet_id": WORKSHEET_ID, "decisions": [payload]}
        )

        with self.assertRaises(HTTPException):
            validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_negative_row_indexes_are_rejected(self) -> None:
        payload = valid_decision_payload()
        payload["affected_rows"] = [-1]

        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                structural_decision_plan={"worksheet_id": WORKSHEET_ID, "decisions": [payload]}
            )


if __name__ == "__main__":
    unittest.main()
