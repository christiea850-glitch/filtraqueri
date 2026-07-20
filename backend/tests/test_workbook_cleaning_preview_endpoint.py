import unittest
from urllib.parse import quote

from fastapi.testclient import TestClient

from backend.app.main import app


DATASET_ID = "02eadd4b599a45798269e553dd02d4e4"
MANAGERS_WORKSHEET_ID = f"{DATASET_ID}:worksheet:1"


class WorkbookCleaningPreviewEndpointTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
