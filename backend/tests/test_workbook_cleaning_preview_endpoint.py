import unittest
from urllib.parse import quote

from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app.main import app
from backend.app.workbook_cleaning_contract import WorkbookCleaningPreviewRequest


DATASET_ID = "02eadd4b599a45798269e553dd02d4e4"
MANAGERS_WORKSHEET_ID = f"{DATASET_ID}:worksheet:1"
PROPERTIES_WORKSHEET_ID = f"{DATASET_ID}:worksheet:3"


class WorkbookCleaningPreviewEndpointTests(unittest.TestCase):
    def _managers_decision_plan(self, decision: str = "use_recommendation") -> dict:
        recommendation_id = f"{MANAGERS_WORKSHEET_ID}:automatic_blank_row:0"
        return {
            "worksheet_id": MANAGERS_WORKSHEET_ID,
            "decisions": [
                {
                    "recommendation_id": recommendation_id,
                    "evidence_type": "automatic_blank_row",
                    "decision": decision,
                    "evidence_ids": [recommendation_id],
                    "affected_rows": [7],
                    "affected_column_indexes": [],
                }
            ],
        }

    def test_preview_endpoint_returns_automatic_blank_row_details(self) -> None:
        encoded_worksheet_id = quote(MANAGERS_WORKSHEET_ID, safe="")

        with TestClient(app) as client:
            response = client.get(
                f"/datasets/{DATASET_ID}/workbook/worksheets/"
                f"{encoded_worksheet_id}/cleaning-recipe-preview?row_limit=10"
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["worksheet_id"], MANAGERS_WORKSHEET_ID)
        self.assertIn("excluded_details", payload)
        layout_rows = payload["excluded_details"]["layout_rows"]
        self.assertEqual(layout_rows["count"], 1)
        self.assertEqual(layout_rows["row_indexes"], [7])
        self.assertEqual(
            layout_rows["reasons"],
            [{"row_index": 7, "reason": "automatic_blank_row"}],
        )

    def test_decision_aware_post_preview_accepts_accepted_decision(self) -> None:
        encoded_worksheet_id = quote(MANAGERS_WORKSHEET_ID, safe="")

        with TestClient(app) as client:
            response = client.post(
                f"/datasets/{DATASET_ID}/workbook/worksheets/"
                f"{encoded_worksheet_id}/cleaning-recipe-preview",
                json={
                    "row_limit_preview": 10,
                    "structural_decision_plan": self._managers_decision_plan("use_recommendation"),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "preview_only")
        self.assertEqual(payload["recipe"][0]["type"], "ignore_layout_rows")
        self.assertEqual(payload["recipe"][0]["original_row_indexes"], [7])
        self.assertEqual(payload["structural_decision_summary"]["accepted"][0]["decision"], "use_recommendation")
        self.assertNotIn("cleaned_table_name", payload)

    def test_decision_aware_post_preview_accepts_keep_original(self) -> None:
        encoded_worksheet_id = quote(MANAGERS_WORKSHEET_ID, safe="")

        with TestClient(app) as client:
            response = client.post(
                f"/datasets/{DATASET_ID}/workbook/worksheets/"
                f"{encoded_worksheet_id}/cleaning-recipe-preview",
                json={
                    "row_limit_preview": 10,
                    "structural_decision_plan": self._managers_decision_plan("keep_original"),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["recipe"], [])
        self.assertEqual(payload["excluded"]["layout_rows"], 0)
        self.assertEqual(payload["structural_decision_summary"]["preserved"][0]["decision"], "keep_original")

    def test_decision_aware_post_preview_accepts_decide_later(self) -> None:
        encoded_worksheet_id = quote(MANAGERS_WORKSHEET_ID, safe="")

        with TestClient(app) as client:
            response = client.post(
                f"/datasets/{DATASET_ID}/workbook/worksheets/"
                f"{encoded_worksheet_id}/cleaning-recipe-preview",
                json={
                    "row_limit_preview": 10,
                    "structural_decision_plan": self._managers_decision_plan("decide_later"),
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["recipe"], [])
        self.assertEqual(payload["excluded"]["layout_rows"], 0)
        self.assertEqual(payload["structural_decision_summary"]["deferred"][0]["decision"], "decide_later")

    def test_decision_aware_post_preview_rejects_unresolved(self) -> None:
        with self.assertRaises(ValidationError):
            WorkbookCleaningPreviewRequest(
                row_limit_preview=10,
                structural_decision_plan=self._managers_decision_plan("unresolved"),
            )

    def test_decision_aware_post_preview_rejects_worksheet_mismatch(self) -> None:
        encoded_worksheet_id = quote(MANAGERS_WORKSHEET_ID, safe="")
        plan = self._managers_decision_plan("use_recommendation")
        plan["worksheet_id"] = PROPERTIES_WORKSHEET_ID

        with TestClient(app) as client:
            response = client.post(
                f"/datasets/{DATASET_ID}/workbook/worksheets/"
                f"{encoded_worksheet_id}/cleaning-recipe-preview",
                json={"row_limit_preview": 10, "structural_decision_plan": plan},
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("worksheet_id", response.json()["detail"])

    def test_post_preview_and_apply_are_separate_routes(self) -> None:
        preview_route = next(
            route
            for route in app.routes
            if getattr(route, "path", "") == "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/cleaning-recipe-preview"
            and "POST" in getattr(route, "methods", set())
        )
        apply_route = next(
            route
            for route in app.routes
            if getattr(route, "path", "") == "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/apply-cleaning-recipe"
        )

        self.assertNotEqual(preview_route.endpoint, apply_route.endpoint)
        self.assertIn("POST", preview_route.methods)
        self.assertIn("POST", apply_route.methods)

    def test_unsupported_method_returns_405(self) -> None:
        encoded_worksheet_id = quote(MANAGERS_WORKSHEET_ID, safe="")

        with TestClient(app) as client:
            response = client.put(
                f"/datasets/{DATASET_ID}/workbook/worksheets/"
                f"{encoded_worksheet_id}/cleaning-recipe-preview",
                json={},
            )

        self.assertEqual(response.status_code, 405)


if __name__ == "__main__":
    unittest.main()
