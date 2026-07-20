import unittest

from fastapi import HTTPException
from pydantic import ValidationError

from backend.app.workbook_cleaning_contract import (
    WorkbookCleaningApplyRequest,
    WorkbookCleaningPreviewRequest,
    validate_missing_value_plan_scope,
    validate_structural_decision_plan_scope,
    validate_transformation_plan_scope,
)


WORKSHEET_ID = "dataset-1:worksheet:1"


def valid_decision_payload() -> dict:
    return {
        "recommendation_id": f"{WORKSHEET_ID}:automatic_blank_row:0",
        "evidence_type": "automatic_blank_row",
        "evidence_signal_id": f"{WORKSHEET_ID}:automatic_blank_row:0",
        "evidence_ids": [f"{WORKSHEET_ID}:automatic_blank_row:0"],
        "decision": "use_recommendation",
        "affected_rows": [7],
        "affected_column_indexes": [],
        "affected_columns": [],
    }


def worksheet_metadata() -> dict:
    return {
        "worksheet_id": WORKSHEET_ID,
        "schema": [
            {"name": "amount", "inferred_type": "numeric"},
            {"name": "name", "inferred_type": "text"},
            {"name": "status", "inferred_type": "categorical"},
            {"name": "start_date", "inferred_type": "date"},
            {"name": "active", "inferred_type": "boolean"},
        ],
    }


def valid_transformation_step(**overrides: object) -> dict:
    step = {
        "step_id": "step-1",
        "order": 0,
        "kind": "trim_whitespace",
        "target_column": "name",
        "output_column": "name",
    }
    step.update(overrides)
    return step


def valid_transformation_plan(*steps: dict) -> dict:
    return {
        "worksheet_id": WORKSHEET_ID,
        "pipeline_id": "pipeline-1",
        "steps": list(steps) or [valid_transformation_step()],
    }


class WorkbookCleaningContractTests(unittest.TestCase):
    def test_absent_structural_plan_is_backward_compatible(self) -> None:
        request = WorkbookCleaningApplyRequest()

        self.assertIsNone(request.structural_decision_plan)
        self.assertIsNone(request.missing_value_plan)
        self.assertIsNone(request.transformation_plan)
        validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)
        validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)
        validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

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
        self.assertEqual(
            request.structural_decision_plan.decisions[0].evidence_ids,
            [f"{WORKSHEET_ID}:automatic_blank_row:0"],
        )

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

    def test_cross_worksheet_evidence_ids_are_rejected(self) -> None:
        payload = valid_decision_payload()
        payload["evidence_ids"] = ["dataset-1:worksheet:2:automatic_blank_row:0"]
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={"worksheet_id": WORKSHEET_ID, "decisions": [payload]}
        )

        with self.assertRaises(HTTPException):
            validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)

    def test_affected_column_names_are_accepted_by_contract(self) -> None:
        payload = valid_decision_payload()
        payload["affected_columns"] = ["note"]
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={"worksheet_id": WORKSHEET_ID, "decisions": [payload]}
        )

        self.assertEqual(request.structural_decision_plan.decisions[0].affected_columns, ["note"])

    def test_valid_missing_value_only_plan_is_accepted(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [
                    {"column_name": "amount", "strategy": "fill_zero"},
                    {"column_name": "name", "strategy": "fill_custom", "custom_value": "Unknown"},
                ],
            }
        )

        validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)
        self.assertEqual(request.missing_value_plan.worksheet_id, WORKSHEET_ID)
        self.assertEqual(request.missing_value_plan.column_decisions[0].strategy, "fill_zero")

    def test_valid_combined_plan_is_accepted(self) -> None:
        request = WorkbookCleaningApplyRequest(
            structural_decision_plan={
                "worksheet_id": WORKSHEET_ID,
                "decisions": [valid_decision_payload()],
            },
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [{"column_name": "amount", "strategy": "fill_mean"}],
            },
        )

        validate_structural_decision_plan_scope(request.structural_decision_plan, WORKSHEET_ID)
        validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_missing_value_worksheet_mismatch_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": "dataset-1:worksheet:2",
                "worksheet_strategy": "leave_unchanged",
                "column_decisions": [],
            }
        )

        with self.assertRaises(HTTPException):
            validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_duplicate_missing_value_column_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [
                    {"column_name": "amount", "strategy": "fill_zero"},
                    {"column_name": "amount", "strategy": "fill_mean"},
                ],
            }
        )

        with self.assertRaises(HTTPException):
            validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_unsupported_missing_value_strategy_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [{"column_name": "amount", "strategy": "not_real"}],
            }
        )

        with self.assertRaises(HTTPException):
            validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_forward_fill_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [{"column_name": "date", "strategy": "forward_fill"}],
            }
        )

        with self.assertRaises(HTTPException):
            validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_column_strategy_as_worksheet_strategy_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "fill_zero",
                "column_decisions": [],
            }
        )

        with self.assertRaises(HTTPException):
            validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_worksheet_strategy_as_column_strategy_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            missing_value_plan={
                "worksheet_id": WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [{"column_name": "amount", "strategy": "remove_mostly_blank_rows"}],
            }
        )

        with self.assertRaises(HTTPException):
            validate_missing_value_plan_scope(request.missing_value_plan, WORKSHEET_ID)

    def test_valid_transformation_plan_is_accepted_by_preview_and_apply(self) -> None:
        payload = valid_transformation_plan(
            valid_transformation_step(step_id="step-1", order=0),
            valid_transformation_step(
                step_id="step-2",
                order=1,
                kind="log_transform",
                target_column="amount",
                output_column="amount_log",
            ),
        )
        apply_request = WorkbookCleaningApplyRequest(transformation_plan=payload)
        preview_request = WorkbookCleaningPreviewRequest(transformation_plan=payload)

        validate_transformation_plan_scope(
            apply_request.transformation_plan,
            WORKSHEET_ID,
            worksheet_metadata(),
        )
        validate_transformation_plan_scope(
            preview_request.transformation_plan,
            WORKSHEET_ID,
            worksheet_metadata(),
        )
        self.assertEqual(apply_request.transformation_plan.pipeline_id, "pipeline-1")

    def test_valid_mixed_supported_transformation_plan_is_accepted(self) -> None:
        request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(step_id="step-1", order=0, kind="lowercase"),
                valid_transformation_step(
                    step_id="step-2",
                    order=1,
                    kind="cap_outliers_percentile",
                    target_column="amount",
                    output_column="amount",
                    parameters={"lower_percentile": 5, "upper_percentile": 95},
                ),
                valid_transformation_step(
                    step_id="step-3",
                    order=2,
                    kind="ordinal_encode",
                    target_column="status",
                    output_column="status_ordinal",
                    parameters={"order": ["low", "high"]},
                ),
                valid_transformation_step(
                    step_id="step-4",
                    order=3,
                    kind="extract_year",
                    target_column="start_date",
                    output_column="start_date_year",
                ),
                valid_transformation_step(
                    step_id="step-5",
                    order=4,
                    kind="boolean_to_integer",
                    target_column="active",
                    output_column="active",
                ),
            )
        )

        validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_transformation_worksheet_mismatch_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            transformation_plan={
                **valid_transformation_plan(),
                "worksheet_id": "dataset-1:worksheet:2",
            }
        )

        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_duplicate_transformation_step_id_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(step_id="step-1", order=0),
                valid_transformation_step(step_id="step-1", order=1),
            )
        )

        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_missing_transformation_ids_are_rejected(self) -> None:
        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                transformation_plan={
                    **valid_transformation_plan(),
                    "pipeline_id": "",
                }
            )
        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                transformation_plan=valid_transformation_plan(
                    valid_transformation_step(step_id=""),
                )
            )

    def test_invalid_transformation_order_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(step_id="step-1", order=0),
                valid_transformation_step(step_id="step-2", order=2),
            )
        )

        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())
        with self.assertRaises(ValidationError):
            WorkbookCleaningApplyRequest(
                transformation_plan=valid_transformation_plan(
                    valid_transformation_step(step_id="step-1", order=-1),
                )
            )

        duplicate_order_request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(step_id="step-1", order=0),
                valid_transformation_step(step_id="step-2", order=0),
            )
        )
        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(
                duplicate_order_request.transformation_plan,
                WORKSHEET_ID,
                worksheet_metadata(),
            )

    def test_blocked_transformation_kinds_are_rejected(self) -> None:
        for kind in ("fill_missing_mean", "fill_missing_unknown", "fill_missing_true"):
            with self.subTest(kind=kind):
                request = WorkbookCleaningApplyRequest(
                    transformation_plan=valid_transformation_plan(
                        valid_transformation_step(kind=kind),
                    )
                )
                with self.assertRaises(HTTPException):
                    validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_unsupported_transformation_kind_is_rejected(self) -> None:
        request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(kind="normalize_everything"),
            )
        )

        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_one_hot_and_sql_transformations_are_rejected(self) -> None:
        for kind in ("one_hot_encode", "sql_select_transform"):
            with self.subTest(kind=kind):
                request = WorkbookCleaningApplyRequest(
                    transformation_plan=valid_transformation_plan(
                        valid_transformation_step(kind=kind),
                    )
                )
                with self.assertRaises(HTTPException):
                    validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_invalid_transformation_parameters_are_rejected(self) -> None:
        cases = [
            valid_transformation_step(
                kind="cap_outliers_percentile",
                target_column="amount",
                parameters={"lower_percentile": 95, "upper_percentile": 5},
            ),
            valid_transformation_step(
                kind="ordinal_encode",
                target_column="status",
                output_column="status_ordinal",
                parameters={"order": []},
            ),
            valid_transformation_step(
                kind="days_since",
                target_column="start_date",
                output_column="start_date_days_since",
                parameters={},
            ),
        ]
        for step in cases:
            with self.subTest(step=step):
                request = WorkbookCleaningApplyRequest(transformation_plan=valid_transformation_plan(step))
                with self.assertRaises(HTTPException):
                    validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_transformation_output_collision_is_rejected(self) -> None:
        cases = [
            valid_transformation_step(
                kind="log_transform",
                target_column="amount",
                output_column="name",
            ),
            valid_transformation_step(
                kind="log_transform",
                target_column="amount",
                output_column="amount",
            ),
            valid_transformation_step(
                kind="log_transform",
                target_column="amount",
                output_column="bad name",
            ),
        ]
        for step in cases:
            with self.subTest(step=step):
                request = WorkbookCleaningApplyRequest(transformation_plan=valid_transformation_plan(step))
                with self.assertRaises(HTTPException):
                    validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

        duplicate_output_request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(
                    step_id="step-1",
                    order=0,
                    kind="log_transform",
                    target_column="amount",
                    output_column="amount_signal",
                ),
                valid_transformation_step(
                    step_id="step-2",
                    order=1,
                    kind="min_max_scale",
                    target_column="amount",
                    output_column="amount_signal",
                ),
            )
        )
        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(
                duplicate_output_request.transformation_plan,
                WORKSHEET_ID,
                worksheet_metadata(),
            )

    def test_unknown_target_and_invalid_datatype_are_rejected(self) -> None:
        cases = [
            valid_transformation_step(target_column="missing"),
            valid_transformation_step(kind="log_transform", target_column="name", output_column="name_log"),
        ]
        for step in cases:
            with self.subTest(step=step):
                request = WorkbookCleaningApplyRequest(transformation_plan=valid_transformation_plan(step))
                with self.assertRaises(HTTPException):
                    validate_transformation_plan_scope(request.transformation_plan, WORKSHEET_ID, worksheet_metadata())

    def test_removed_structural_column_contract_rejects_shaped_column_miss(self) -> None:
        request = WorkbookCleaningApplyRequest(
            transformation_plan=valid_transformation_plan(
                valid_transformation_step(target_column="name"),
            )
        )

        with self.assertRaises(HTTPException):
            validate_transformation_plan_scope(
                request.transformation_plan,
                WORKSHEET_ID,
                worksheet_metadata(),
                shaped_columns=["amount", "status", "start_date", "active"],
            )


if __name__ == "__main__":
    unittest.main()
