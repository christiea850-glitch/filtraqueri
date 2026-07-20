from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import duckdb
from openpyxl import Workbook

from backend.app.workbook_ingestion import parse_xlsx_workbook, profile_table


class WorkbookIngestionXlsxTests(unittest.TestCase):
    def test_parse_xlsx_accepts_absolute_sheet_relationship_targets(self):
        with TemporaryDirectory() as temp_dir:
            workbook_path = Path(temp_dir) / "absolute-targets.xlsx"
            workbook = Workbook()
            worksheet = workbook.active
            worksheet.title = "People"
            worksheet.append(["Name", "Amount", "Date"])
            worksheet.append([" Alice ", 10, "2024-01-05"])
            workbook.save(workbook_path)

            sheets = parse_xlsx_workbook(workbook_path)

        self.assertEqual([sheet["name"] for sheet in sheets], ["People"])
        self.assertEqual(sheets[0]["rows"][0], ["Name", "Amount", "Date"])

    def test_profile_table_infers_numeric_and_date_text_values(self):
        with duckdb.connect(":memory:") as connection:
            connection.execute('CREATE TABLE sample ("Amount" VARCHAR, "Date" VARCHAR)')
            connection.executemany(
                'INSERT INTO sample VALUES (?, ?)',
                [("10", "2024-01-05"), ("20", "2024-03-15")],
            )

            profiles, _, _ = profile_table(connection, "sample")

        inferred = {profile["name"]: profile["inferred_type"] for profile in profiles}
        self.assertEqual(inferred["Amount"], "numeric")
        self.assertEqual(inferred["Date"], "date")


if __name__ == "__main__":
    unittest.main()
