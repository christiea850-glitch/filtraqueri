import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import duckdb
from fastapi import HTTPException

from backend.app.workbook_cleaning_apply import apply_cleaning_recipe_to_working_copy
from backend.app.workbook_cleaning_preview import build_cleaning_recipe_preview
from backend.app.workbook_cleaning_contract import WorkbookCleaningPreviewRequest
from backend.tests import test_workbook_cleaning_missing_values as fixtures


class WorkbookCleaningMissingValuePreviewTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workbook_path = Path(self.temp_dir.name) / "preview-missing.xlsx"
        self.duckdb_path = Path(self.temp_dir.name) / "session.duckdb"
        fixtures._write_workbook(self.workbook_path, fixtures._rows())
        self.parse_patcher = patch(
            "backend.app.workbook_cleaning_preview.parse_xlsx_workbook",
            return_value=[{"name": "Data", "rows": fixtures._rows()}],
        )
        self.parse_patcher.start()
        with duckdb.connect(str(self.duckdb_path)) as connection:
            connection.execute("CREATE TABLE original_source (id VARCHAR, amount VARCHAR)")
            connection.execute("INSERT INTO original_source VALUES ('2', NULL)")
            connection.execute("CREATE TABLE unrelated_worksheet (id VARCHAR, value VARCHAR)")
            connection.execute("INSERT INTO unrelated_worksheet VALUES ('1', 'unchanged')")
            connection.execute("CREATE VIEW data AS SELECT * FROM original_source")
        self.worksheet = fixtures._worksheet_metadata()

    def tearDown(self) -> None:
        self.parse_patcher.stop()
        self.temp_dir.cleanup()

    def _preview(self, missing_value_plan, structural_decision_plan=None):
        return build_cleaning_recipe_preview(
            workbook_path=self.workbook_path,
            worksheet=self.worksheet,
            row_limit=25,
            structural_decision_plan=structural_decision_plan,
            missing_value_plan=missing_value_plan,
        )

    def _apply(self, missing_value_plan, structural_decision_plan=None):
        return apply_cleaning_recipe_to_working_copy(
            workbook_path=self.workbook_path,
            worksheet=self.worksheet,
            duckdb_path=self.duckdb_path,
            dataset_id="dataset-missing",
            structural_decision_plan=structural_decision_plan,
            missing_value_plan=missing_value_plan,
        )

    def assert_preview_apply_parity(self, missing_value_plan, structural_decision_plan=None) -> None:
        preview = self._preview(missing_value_plan, structural_decision_plan)
        apply = self._apply(missing_value_plan, structural_decision_plan)

        self.assertEqual(preview["after_preview"]["row_count"], apply["after"]["row_count"])
        self.assertEqual(preview["after_preview"]["column_count"], apply["after"]["column_count"])
        self.assertEqual(preview["after_preview"]["columns"], apply["after"]["columns"])
        self.assertEqual(preview["after_preview"]["rows"], apply["preview_rows"])
        self.assertEqual(preview["excluded"], apply["excluded"])
        self.assertEqual(
            preview["missing_value_summary"]["columns_changed"],
            apply["missing_value_summary"]["columns_changed"],
        )
        self.assertEqual(
            preview["missing_value_summary"]["cells_filled"],
            apply["missing_value_summary"]["cells_filled"],
        )
        self.assertEqual(
            preview["missing_value_summary"]["rows_removed"],
            apply["missing_value_summary"]["rows_removed"],
        )

    def test_structural_only_preview_unchanged(self) -> None:
        preview = self._preview(None)

        self.assertEqual(preview["status"], "preview_only")
        self.assertEqual(preview["missing_value_summary"]["cells_filled"], 0)
        self.assertEqual(preview["after_preview"]["row_count"], 3)

    def test_missing_value_only_preview(self) -> None:
        plan = fixtures._missing_plan(column_decisions=[{"column_name": "amount", "strategy": "fill_zero"}])
        preview = self._preview(plan)

        self.assertEqual(preview["after_preview"]["rows"][1]["amount"], "0")
        self.assertEqual(preview["missing_value_summary"]["columns_changed"], ["amount"])
        self.assertEqual(preview["missing_value_summary"]["cells_filled"], 1)

    def test_combined_structural_and_missing_preview(self) -> None:
        self.parse_patcher.stop()
        self.parse_patcher = patch(
            "backend.app.workbook_cleaning_preview.parse_xlsx_workbook",
            return_value=[{"name": "Data", "rows": fixtures._structural_rows()}],
        )
        self.parse_patcher.start()
        self.worksheet = fixtures._structural_worksheet_metadata()

        self.assert_preview_apply_parity(
            fixtures._missing_plan(column_decisions=[{"column_name": "amount", "strategy": "fill_mean"}]),
            structural_decision_plan=fixtures._structural_plan(),
        )

    def test_preview_apply_parity_for_supported_column_strategies(self) -> None:
        cases = [
            [{"column_name": "amount", "strategy": "fill_zero"}],
            [{"column_name": "amount", "strategy": "fill_mean"}],
            [{"column_name": "amount", "strategy": "fill_median"}],
            [{"column_name": "region", "strategy": "fill_mode"}],
            [{"column_name": "comment", "strategy": "mark_unknown"}],
            [{"column_name": "amount", "strategy": "fill_custom", "custom_value": 42}],
            [{"column_name": "comment", "strategy": "fill_custom", "custom_value": "TBD"}],
            [{"column_name": "visit_date", "strategy": "custom_date", "custom_value": "2024-02-01"}],
        ]
        for decisions in cases:
            with self.subTest(decisions=decisions):
                self.assert_preview_apply_parity(fixtures._missing_plan(column_decisions=decisions))

    def test_leave_unchanged_and_layout_space_are_no_op_preview(self) -> None:
        for strategy in ["leave_unchanged", "layout_space"]:
            with self.subTest(strategy=strategy):
                preview = self._preview(fixtures._missing_plan(worksheet_strategy=strategy))
                self.assertEqual(preview["missing_value_summary"]["has_changes"], False)
                self.assertEqual(preview["after_preview"]["row_count"], 3)

    def test_remove_mostly_blank_rows_preview(self) -> None:
        plan = fixtures._missing_plan(worksheet_strategy="remove_mostly_blank_rows")
        preview = self._preview(plan)

        self.assertEqual(preview["after_preview"]["row_count"], 2)
        self.assertEqual(preview["missing_value_summary"]["rows_removed"], 1)
        self.assertEqual(
            [row["original_row_index"] for row in preview["after_preview"]["row_provenance"]],
            [1, 3],
        )
        self.assert_preview_apply_parity(plan)

    def test_repeated_preview_is_deterministic(self) -> None:
        plan = fixtures._missing_plan(column_decisions=[{"column_name": "region", "strategy": "fill_mode"}])

        self.assertEqual(self._preview(plan), self._preview(plan))

    def test_preview_is_read_only(self) -> None:
        plan = fixtures._missing_plan(column_decisions=[{"column_name": "amount", "strategy": "fill_zero"}])

        self._preview(plan)

        with duckdb.connect(str(self.duckdb_path)) as connection:
            tables = {row[0] for row in connection.execute("SHOW TABLES").fetchall()}
            self.assertFalse(any(table.startswith("cleaned_") for table in tables))
            self.assertIsNone(connection.execute("SELECT amount FROM original_source WHERE id = '2'").fetchone()[0])
            self.assertEqual(connection.execute("SELECT amount FROM data WHERE id = '2'").fetchone()[0], None)
            self.assertEqual(connection.execute("SELECT value FROM unrelated_worksheet").fetchone()[0], "unchanged")

    def test_zero_row_worksheet_preview(self) -> None:
        worksheet = {
            **fixtures._worksheet_metadata(),
            "row_count": 0,
            "column_count": 0,
            "status": "empty",
        }
        preview = build_cleaning_recipe_preview(
            workbook_path=self.workbook_path,
            worksheet=worksheet,
            row_limit=25,
            missing_value_plan=None,
        )

        self.assertEqual(preview["after_preview"]["row_count"], 0)
        self.assertEqual(preview["missing_value_summary"]["cells_filled"], 0)

    def test_invalid_preview_plans_are_rejected(self) -> None:
        cases = [
            fixtures._missing_plan(column_decisions=[{"column_name": "missing", "strategy": "fill_zero"}]),
            fixtures._missing_plan(column_decisions=[{"column_name": "region", "strategy": "fill_zero"}]),
        ]
        for plan in cases:
            with self.subTest(plan=plan):
                with self.assertRaises(HTTPException):
                    self._preview(plan)

    def test_all_null_eligible_column_is_rejected(self) -> None:
        rows = [
            ["id", "amount", "region", "comment", "visit_date", "flag"],
            [1, None, None, None, None, "true"],
        ]
        self.parse_patcher.stop()
        self.parse_patcher = patch(
            "backend.app.workbook_cleaning_preview.parse_xlsx_workbook",
            return_value=[{"name": "Data", "rows": rows}],
        )
        self.parse_patcher.start()

        with self.assertRaises(HTTPException):
            self._preview(fixtures._missing_plan(column_decisions=[{"column_name": "amount", "strategy": "fill_mean"}]))
        with self.assertRaises(HTTPException):
            self._preview(fixtures._missing_plan(column_decisions=[{"column_name": "region", "strategy": "fill_mode"}]))

    def test_preview_request_accepts_missing_plan(self) -> None:
        request = WorkbookCleaningPreviewRequest(
            row_limit_preview=10,
            missing_value_plan={
                "worksheet_id": fixtures.WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [{"column_name": "amount", "strategy": "fill_zero"}],
            },
        )

        self.assertEqual(request.missing_value_plan.column_decisions[0].strategy, "fill_zero")

    def test_worksheet_mismatch_is_rejected(self) -> None:
        plan = WorkbookCleaningPreviewRequest(
            row_limit_preview=10,
            missing_value_plan={
                "worksheet_id": fixtures.OTHER_WORKSHEET_ID,
                "worksheet_strategy": "decide_per_column",
                "column_decisions": [{"column_name": "amount", "strategy": "fill_zero"}],
            },
        ).missing_value_plan

        with self.assertRaises(HTTPException):
            self._preview(plan)


if __name__ == "__main__":
    unittest.main()
