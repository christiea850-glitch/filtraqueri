from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import re
import zipfile
import xml.etree.ElementTree as ET

import duckdb
from fastapi import HTTPException

from .workbook_models import (
    WorkbookIngestionProfile,
    WorkbookMetadata,
    WorkbookNormalizationMetadata,
    WorkbookSourceFileMetadata,
    WorksheetMetadata,
    WorksheetNormalizationMetadata,
    WorksheetTableMapping,
)
from .workbook_relationships import profile_relationship_candidates


MAX_WORKBOOK_FILE_BYTES = 25 * 1024 * 1024
MAX_WORKSHEETS = 30
MAX_WORKSHEET_COLUMNS = 250
MAX_WORKSHEET_ROWS = 50000
MAX_PREVIEW_ROWS = 25
ACTIVE_TABLE_NAME = "data"
WORKBOOK_TABLE_PREFIX = "ws"
XML_NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def safe_identifier(value: str, fallback: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_]+", "_", value.strip().lower()).strip("_")
    normalized = re.sub(r"_+", "_", normalized)
    return (normalized[:48] or fallback).strip("_") or fallback


def generate_safe_worksheet_table_name(sheet_name: str, index: int) -> str:
    return f"{WORKBOOK_TABLE_PREFIX}_{index + 1}_{safe_identifier(sheet_name, f'worksheet_{index + 1}')}"


def quote_identifier(identifier: str) -> str:
    return f'"{identifier.replace(chr(34), chr(34) + chr(34))}"'


def cell_reference_to_indexes(reference: str) -> tuple[int, int]:
    match = re.match(r"([A-Za-z]+)(\d+)", reference)
    if not match:
        return 0, 0

    column_letters, row_number = match.groups()
    column_index = 0
    for character in column_letters.upper():
        column_index = column_index * 26 + (ord(character) - ord("A") + 1)

    return int(row_number) - 1, column_index - 1


def normalize_header(value: Any, index: int, existing: set[str]) -> tuple[str, bool, bool]:
    empty_name = value in (None, "")
    raw_name = f"column_{index + 1}" if empty_name else str(value).strip()
    normalized = raw_name or f"column_{index + 1}"
    normalized = normalized[:80]
    base_name = normalized
    duplicate = normalized in existing
    suffix = 2

    while normalized in existing:
        normalized = f"{base_name}_{suffix}"
        suffix += 1

    existing.add(normalized)
    return normalized, duplicate, empty_name


def normalize_rows(raw_rows: list[list[Any]]) -> tuple[list[str], list[list[Any]], int, int]:
    non_empty_rows = [
        row
        for row in raw_rows
        if any(value not in (None, "") for value in row)
    ]
    if not non_empty_rows:
        return [], [], 0, 0

    header_values = non_empty_rows[0][:MAX_WORKSHEET_COLUMNS]
    existing: set[str] = set()
    columns: list[str] = []
    duplicate_count = 0
    empty_count = 0

    for index, value in enumerate(header_values):
        column_name, duplicate, empty = normalize_header(value, index, existing)
        columns.append(column_name)
        duplicate_count += 1 if duplicate else 0
        empty_count += 1 if empty else 0

    data_rows = [
        [*(row[: len(columns)]), *([None] * max(0, len(columns) - len(row)))]
        for row in non_empty_rows[1 : MAX_WORKSHEET_ROWS + 1]
    ]
    data_rows = [row[: len(columns)] for row in data_rows]

    return columns, data_rows, duplicate_count, empty_count


def read_shared_strings(workbook_zip: zipfile.ZipFile) -> list[str]:
    try:
        xml_content = workbook_zip.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    root = ET.fromstring(xml_content)
    values: list[str] = []
    for item in root.findall("main:si", XML_NS):
        text_parts = [text.text or "" for text in item.findall(".//main:t", XML_NS)]
        values.append("".join(text_parts))
    return values


def read_workbook_sheets(workbook_zip: zipfile.ZipFile) -> list[dict[str, str]]:
    workbook_root = ET.fromstring(workbook_zip.read("xl/workbook.xml"))
    rels_root = ET.fromstring(workbook_zip.read("xl/_rels/workbook.xml.rels"))
    relationships = {
        relationship.attrib["Id"]: relationship.attrib["Target"]
        for relationship in rels_root.findall("pkg_rel:Relationship", XML_NS)
    }
    sheets: list[dict[str, str]] = []

    for sheet in workbook_root.findall("main:sheets/main:sheet", XML_NS):
        relationship_id = sheet.attrib.get(f"{{{XML_NS['rel']}}}id")
        target = relationships.get(relationship_id or "")
        if not target:
            continue
        sheet_path = f"xl/{target.lstrip('/')}"
        if not sheet_path.startswith("xl/worksheets/") and "worksheets/" in sheet_path:
            sheet_path = "xl/" + sheet_path.split("xl/", 1)[-1]
        sheets.append({
            "name": sheet.attrib.get("name", f"Sheet {len(sheets) + 1}"),
            "path": sheet_path,
        })

    return sheets[:MAX_WORKSHEETS]


def parse_xlsx_sheet(workbook_zip: zipfile.ZipFile, sheet_path: str, shared_strings: list[str]) -> list[list[Any]]:
    root = ET.fromstring(workbook_zip.read(sheet_path))
    rows: list[list[Any]] = []

    for row in root.findall(".//main:sheetData/main:row", XML_NS):
        row_values: list[Any] = []
        for cell in row.findall("main:c", XML_NS):
            reference = cell.attrib.get("r", "")
            _, column_index = cell_reference_to_indexes(reference)
            while len(row_values) <= column_index:
                row_values.append(None)

            cell_type = cell.attrib.get("t")
            value_node = cell.find("main:v", XML_NS)
            inline_text = cell.find("main:is/main:t", XML_NS)
            value: Any = None

            if cell_type == "inlineStr":
                value = inline_text.text if inline_text is not None else None
            elif value_node is not None:
                raw_value = value_node.text or ""
                if cell_type == "s":
                    value = shared_strings[int(raw_value)] if raw_value.isdigit() and int(raw_value) < len(shared_strings) else raw_value
                elif cell_type == "b":
                    value = raw_value == "1"
                else:
                    value = raw_value

            row_values[column_index] = value
        rows.append(row_values)

    return rows


def parse_xlsx_workbook(path: Path) -> list[dict[str, Any]]:
    try:
        with zipfile.ZipFile(path) as workbook_zip:
            shared_strings = read_shared_strings(workbook_zip)
            sheets = read_workbook_sheets(workbook_zip)
            return [
                {
                    "name": sheet["name"],
                    "rows": parse_xlsx_sheet(workbook_zip, sheet["path"], shared_strings),
                }
                for sheet in sheets
            ]
    except (zipfile.BadZipFile, KeyError, ET.ParseError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Workbook could not be read as a valid XLSX file") from error


def parse_xls_workbook(path: Path) -> list[dict[str, Any]]:
    try:
        import xlrd  # type: ignore
    except ImportError as error:
        raise HTTPException(
            status_code=400,
            detail="Legacy XLS uploads require the optional xlrd backend dependency",
        ) from error

    workbook = xlrd.open_workbook(str(path))
    sheets: list[dict[str, Any]] = []
    for sheet in workbook.sheets()[:MAX_WORKSHEETS]:
        rows = [
            [sheet.cell_value(row_index, column_index) for column_index in range(sheet.ncols)]
            for row_index in range(min(sheet.nrows, MAX_WORKSHEET_ROWS + 1))
        ]
        sheets.append({"name": sheet.name, "rows": rows})
    return sheets


def create_table_from_rows(
    connection: duckdb.DuckDBPyConnection,
    table_name: str,
    columns: list[str],
    rows: list[list[Any]],
) -> None:
    column_sql = ", ".join(f"{quote_identifier(column)} VARCHAR" for column in columns)
    connection.execute(f"CREATE TABLE {quote_identifier(table_name)} ({column_sql})")
    if not rows:
        return

    placeholders = ", ".join("?" for _ in columns)
    connection.executemany(
        f"INSERT INTO {quote_identifier(table_name)} VALUES ({placeholders})",
        [[None if value == "" else value for value in row] for row in rows],
    )


def profile_table(connection: duckdb.DuckDBPyConnection, table_name: str) -> tuple[list[dict[str, Any]], int, int]:
    table_identifier = quote_identifier(table_name)
    escaped_table_name = table_name.replace("'", "''")
    schema_rows = connection.execute(f"PRAGMA table_info('{escaped_table_name}')").fetchall()
    row_count = connection.execute(f"SELECT COUNT(*) FROM {table_identifier}").fetchone()[0]
    profiles: list[dict[str, Any]] = []

    for row in schema_rows:
        column_name = row[1]
        identifier = quote_identifier(column_name)
        null_count = connection.execute(
            f"SELECT COUNT(*) FROM {table_identifier} WHERE {identifier} IS NULL"
        ).fetchone()[0]
        unique_count = connection.execute(
            f"SELECT COUNT(DISTINCT {identifier}) FROM {table_identifier}"
        ).fetchone()[0]
        sample_values = [
            sample_row[0]
            for sample_row in connection.execute(
                f"SELECT DISTINCT {identifier} FROM {table_identifier} WHERE {identifier} IS NOT NULL LIMIT 12"
            ).fetchall()
        ]
        inferred_type = "categorical" if unique_count <= 50 and (row_count == 0 or unique_count / row_count < 0.8) else "text"
        profiles.append({
            "name": column_name,
            "type": row[2],
            "inferred_type": inferred_type,
            "null_count": null_count,
            "unique_count": unique_count,
            "sample_values": sample_values,
        })

    return profiles, row_count, len(schema_rows)


def ingest_workbook(
    *,
    path: Path,
    original_filename: str,
    dataset_id: str,
    duckdb_path: Path,
    uploaded_at: str,
) -> dict[str, Any]:
    if path.stat().st_size > MAX_WORKBOOK_FILE_BYTES:
        raise HTTPException(status_code=400, detail="Workbook is too large for this prototype")

    suffix = path.suffix.lower()
    raw_sheets = parse_xlsx_workbook(path) if suffix == ".xlsx" else parse_xls_workbook(path)
    if not raw_sheets:
        raise HTTPException(status_code=400, detail="Workbook does not contain readable worksheets")

    worksheets: list[WorksheetMetadata] = []
    active_table_name: str | None = None
    active_schema: list[dict[str, Any]] = []
    active_row_count = 0
    active_column_count = 0
    relationship_candidates = []

    with duckdb.connect(str(duckdb_path)) as connection:
        for index, sheet in enumerate(raw_sheets[:MAX_WORKSHEETS]):
            sheet_name = sheet["name"]
            table_name = generate_safe_worksheet_table_name(sheet_name, index)
            columns, rows, duplicate_count, empty_count = normalize_rows(sheet["rows"])
            status = "ready" if columns else "empty"
            schema: list[dict[str, Any]] = []
            row_count = 0
            column_count = len(columns)

            if columns:
                create_table_from_rows(connection, table_name, columns, rows)
                schema, row_count, column_count = profile_table(connection, table_name)
                if active_table_name is None:
                    active_table_name = table_name
                    active_schema = schema
                    active_row_count = row_count
                    active_column_count = column_count

            worksheets.append(
                WorksheetMetadata(
                    worksheet_id=f"{dataset_id}:worksheet:{index + 1}",
                    workbook_id=dataset_id,
                    sheet_name=sheet_name,
                    display_name=sheet_name,
                    table_name=table_name,
                    original_index=index,
                    status=status,
                    schema=schema,
                    row_count=row_count,
                    column_count=column_count,
                    visible_columns=[column["name"] for column in schema],
                    hidden_columns=[],
                    normalization=WorksheetNormalizationMetadata(
                        normalized_at=uploaded_at,
                        header_row_index=0 if columns else None,
                        duplicate_column_count=duplicate_count,
                        empty_column_count=empty_count,
                        warnings=[] if status == "ready" else ["Worksheet is empty and was not loaded as an active table."],
                    ),
                )
            )

        if not active_table_name:
            raise HTTPException(status_code=400, detail="Workbook does not contain a non-empty worksheet")

        connection.execute(f"CREATE VIEW {quote_identifier(ACTIVE_TABLE_NAME)} AS SELECT * FROM {quote_identifier(active_table_name)}")
        preview_result = connection.execute(
            f"SELECT * FROM {quote_identifier(ACTIVE_TABLE_NAME)} LIMIT ?",
            [MAX_PREVIEW_ROWS],
        )
        preview_columns = [description[0] for description in preview_result.description]
        preview = [dict(zip(preview_columns, row)) for row in preview_result.fetchall()]
        relationship_candidates = profile_relationship_candidates(connection, dataset_id, worksheets)

    workbook_metadata = WorkbookMetadata(
        workbook_id=dataset_id,
        workspace_id=dataset_id,
        name=original_filename,
        status="ready",
        source_file=WorkbookSourceFileMetadata(
            original_filename=original_filename,
            stored_path=str(path),
            mime_type=None,
            byte_size=path.stat().st_size,
            uploaded_at=uploaded_at,
        ),
        worksheet_ids=[worksheet.worksheet_id for worksheet in worksheets],
        active_worksheet_id=next(
            worksheet.worksheet_id for worksheet in worksheets if worksheet.table_name == active_table_name
        ),
        worksheets=worksheets,
        table_mappings=[
            WorksheetTableMapping(
                sheet_name=worksheet.sheet_name,
                table_name=worksheet.table_name,
                original_index=worksheet.original_index,
            )
            for worksheet in worksheets
        ],
        relationship_candidates=relationship_candidates,
        ingestion_profile=WorkbookIngestionProfile(
            max_worksheets=MAX_WORKSHEETS,
            max_rows_per_worksheet_profile=MAX_WORKSHEET_ROWS,
            max_columns_per_worksheet=MAX_WORKSHEET_COLUMNS,
            max_preview_rows=MAX_PREVIEW_ROWS,
        ),
        normalization=WorkbookNormalizationMetadata(
            normalized_at=uploaded_at,
            status="normalized",
            warnings=[],
        ),
        created_at=uploaded_at,
        updated_at=datetime.now(timezone.utc).isoformat(),
    )

    return {
        "preview": preview[:MAX_PREVIEW_ROWS],
        "active_table_name": ACTIVE_TABLE_NAME,
        "active_worksheet_table_name": active_table_name,
        "schema": active_schema,
        "row_count": active_row_count,
        "column_count": active_column_count,
        "workbook_metadata": workbook_metadata.model_dump(by_alias=True),
    }
