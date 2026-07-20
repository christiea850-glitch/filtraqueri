import unittest

from fastapi import HTTPException

from backend.app.workbook_cleaning_contract import WorkbookTransformationPlan
from backend.app.workbook_cleaning_transformations import (
    apply_transformation_plan_to_rows,
)

WID = "dataset:worksheet:1"


def step(step_id, order, kind, target, output=None, parameters=None):
    return {
        "step_id": step_id,
        "order": order,
        "kind": kind,
        "target_column": target,
        "output_column": output,
        "parameters": parameters or {},
    }


def plan(*steps):
    return WorkbookTransformationPlan(
        worksheet_id=WID, pipeline_id="p1", steps=list(steps)
    )


def run(rows, columns, schema, *steps):
    return apply_transformation_plan_to_rows(
        rows=rows, columns=columns, schema=schema, transformation_plan=plan(*steps)
    )


class WorkbookCleaningTransformationPlannerTests(unittest.TestCase):
    def test_text_trim_lowercase_uppercase(self):
        rows = [{"name": " Alice "}, {"name": None}, {"name": "BOB"}]
        result = run(
            rows,
            ["name"],
            {"name": "text"},
            step("s1", 0, "trim_whitespace", "name", "name"),
            step("s2", 1, "lowercase", "name", "name"),
            step("s3", 2, "uppercase", "name", "name"),
        )
        self.assertEqual([row["name"] for row in result.rows], ["ALICE", None, "BOB"])
        self.assertEqual(result.transformation_summary["step_count"], 3)

    def test_numeric_percentile_capping(self):
        result = run(
            [{"x": 0}, {"x": 10}, {"x": 100}],
            ["x"],
            {"x": "numeric"},
            step(
                "s1",
                0,
                "cap_outliers_percentile",
                "x",
                "x",
                {"lower_percentile": 10, "upper_percentile": 90},
            ),
        )
        self.assertEqual([row["x"] for row in result.rows], [2.0, 10.0, 82.0])
        self.assertIn(
            "type_7_quantile", result.transformation_summary["operations"][0]["detail"]
        )

    def test_log_z_score_and_min_max_scaling(self):
        rows = [{"x": 0}, {"x": 1}, {"x": 3}]
        result = run(
            rows,
            ["x"],
            {"x": "numeric"},
            step("s1", 0, "log_transform", "x", "log_x"),
            step("s2", 1, "z_score_scale", "log_x", "z_log_x"),
            step("s3", 2, "min_max_scale", "x", "scaled_x"),
        )
        self.assertEqual(result.columns, ["x", "log_x", "z_log_x", "scaled_x"])
        self.assertAlmostEqual(result.rows[1]["log_x"], 0.6931471805599453)
        self.assertEqual([row["scaled_x"] for row in result.rows], [0.0, 1 / 3, 1.0])

    def test_log_rejects_negative_domain(self):
        with self.assertRaises(HTTPException):
            run(
                [{"x": -1}],
                ["x"],
                {"x": "numeric"},
                step("s1", 0, "log_transform", "x", "log_x"),
            )

    def test_date_operations(self):
        rows = [{"d": "2024-01-01"}, {"d": "2024-04-07"}, {"d": None}]
        result = run(
            rows,
            ["d"],
            {"d": "date"},
            step("y", 0, "extract_year", "d", "year"),
            step("m", 1, "extract_month", "d", "month"),
            step("q", 2, "extract_quarter", "d", "quarter"),
            step("w", 3, "extract_day_of_week", "d", "weekday"),
            step("ds", 4, "days_since", "d", "days", {"anchor_date": "2024-04-10"}),
        )
        self.assertEqual(result.rows[0]["year"], 2024)
        self.assertEqual(result.rows[1]["month"], 4)
        self.assertEqual(result.rows[1]["quarter"], 2)
        self.assertEqual(result.rows[0]["weekday"], 1)
        self.assertEqual(result.rows[1]["days"], 3)
        self.assertIsNone(result.rows[2]["days"])

    def test_date_rejects_unparseable_values(self):
        with self.assertRaises(HTTPException):
            run(
                [{"d": "01/02/2024"}],
                ["d"],
                {"d": "date"},
                step("y", 0, "extract_year", "d", "year"),
            )

    def test_boolean_to_integer_replacement_and_output(self):
        replaced = run(
            [{"b": "true"}, {"b": "false"}, {"b": None}],
            ["b"],
            {"b": "boolean"},
            step("b", 0, "boolean_to_integer", "b", "b"),
        )
        self.assertEqual([row["b"] for row in replaced.rows], [1, 0, None])
        derived = run(
            [{"b": True}],
            ["b"],
            {"b": "boolean"},
            step("b", 0, "boolean_to_integer", "b", "b_int"),
        )
        self.assertEqual(derived.columns, ["b", "b_int"])
        self.assertEqual(derived.rows[0]["b_int"], 1)

    def test_ordinal_and_frequency_encoding(self):
        rows = [{"size": "small"}, {"size": "large"}, {"size": "small"}, {"size": None}]
        result = run(
            rows,
            ["size"],
            {"size": "categorical"},
            step(
                "o",
                0,
                "ordinal_encode",
                "size",
                "size_ord",
                {"order": ["small", "medium", "large"]},
            ),
            step("f", 1, "frequency_encode", "size", "size_count"),
        )
        self.assertEqual([row["size_ord"] for row in result.rows], [0, 2, 0, None])
        self.assertEqual([row["size_count"] for row in result.rows], [2, 1, 2, None])

    def test_ordinal_rejects_duplicates_and_unknowns(self):
        with self.assertRaises(HTTPException):
            run(
                [{"x": "a"}],
                ["x"],
                {"x": "categorical"},
                step("o", 0, "ordinal_encode", "x", "xo", {"order": ["a", "a"]}),
            )
        with self.assertRaises(HTTPException):
            run(
                [{"x": "b"}],
                ["x"],
                {"x": "categorical"},
                step("o", 0, "ordinal_encode", "x", "xo", {"order": ["a"]}),
            )

    def test_ordered_multistep_derived_target_and_mismatch_rejection(self):
        result = run(
            [{"x": 1}],
            ["x"],
            {"x": "numeric"},
            step("log", 0, "log_transform", "x", "log_x"),
            step("scale", 1, "min_max_scale", "log_x", "scaled"),
        )
        self.assertEqual(result.columns, ["x", "log_x", "scaled"])
        with self.assertRaises(HTTPException):
            run(
                [{"x": 1}],
                ["x"],
                {"x": "numeric"},
                step("log", 0, "log_transform", "x", "log_x"),
                step("bad", 1, "lowercase", "log_x", "log_x"),
            )

    def test_output_collision_and_removed_target_rejection(self):
        with self.assertRaises(HTTPException):
            run(
                [{"x": 1}],
                ["x"],
                {"x": "numeric"},
                step("s", 0, "log_transform", "x", "x"),
            )
        with self.assertRaises(HTTPException):
            run(
                [{"x": 1}],
                ["x"],
                {"x": "numeric", "removed": "numeric"},
                step("s", 0, "log_transform", "removed", "out"),
            )

    def test_blocked_operations_rejected(self):
        for kind in [
            "fill_missing_mean",
            "fill_missing_true",
            "one_hot_encode",
            "sql_select_transform",
        ]:
            with self.subTest(kind=kind), self.assertRaises(HTTPException):
                run([{"x": "a"}], ["x"], {"x": "text"}, step("s", 0, kind, "x", "out"))

    def test_no_op_summary(self):
        result = apply_transformation_plan_to_rows(
            rows=[{"x": "a"}],
            columns=["x"],
            schema={"x": "text"},
            transformation_plan=None,
        )
        self.assertFalse(result.has_changes)
        self.assertEqual(result.transformation_summary["status"], "no_changes")
