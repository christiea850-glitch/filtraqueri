from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import re
import shutil

import duckdb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
SESSIONS_DIR = STORAGE_DIR / "sessions"
TABLE_NAME = "data"
DEFAULT_PREVIEW_LIMIT = 25
MAX_QUERY_LIMIT = 1000
DEFAULT_QUERY_LIMIT = 100
BLOCKED_SQL_KEYWORDS = (
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "copy",
    "attach",
)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="FiltraQueri API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dataset_sessions: dict[str, dict[str, Any]] = {}


class QueryRequest(BaseModel):
    sql: str = Field(..., min_length=1)
    limit: int = Field(DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT)


def sanitize_filename(filename: str) -> str:
    clean_name = Path(filename).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", clean_name) or "dataset.csv"


def get_connection(dataset_id: str) -> duckdb.DuckDBPyConnection:
    metadata = get_dataset_metadata(dataset_id)
    return duckdb.connect(metadata["duckdb_path"])


def get_dataset_metadata(dataset_id: str) -> dict[str, Any]:
    metadata = dataset_sessions.get(dataset_id)

    if not metadata:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return metadata


def fetch_schema(connection: duckdb.DuckDBPyConnection) -> list[dict[str, str]]:
    rows = connection.execute(f"PRAGMA table_info('{TABLE_NAME}')").fetchall()
    return [{"name": row[1], "type": row[2]} for row in rows]


def fetch_preview(
    connection: duckdb.DuckDBPyConnection,
    limit: int = DEFAULT_PREVIEW_LIMIT,
) -> list[dict[str, Any]]:
    result = connection.execute(f"SELECT * FROM {TABLE_NAME} LIMIT ?", [limit])
    columns = [description[0] for description in result.description]
    rows = result.fetchall()
    return [dict(zip(columns, row)) for row in rows]


def table_stats(connection: duckdb.DuckDBPyConnection) -> tuple[int, int]:
    row_count = connection.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
    column_count = len(fetch_schema(connection))
    return row_count, column_count


def normalize_query(sql: str) -> str:
    query = sql.strip()

    if query.endswith(";"):
        query = query[:-1].strip()

    if ";" in query:
        raise HTTPException(status_code=400, detail="Only one SELECT statement is allowed")

    return query


def validate_select_query(sql: str) -> str:
    query = normalize_query(sql)
    lowered = query.lower()

    if not lowered.startswith("select"):
        raise HTTPException(status_code=400, detail="Only SELECT queries are allowed")

    for keyword in BLOCKED_SQL_KEYWORDS:
        if re.search(rf"\b{keyword}\b", lowered):
            raise HTTPException(
                status_code=400,
                detail=f"{keyword.upper()} statements are not allowed",
            )

    return query


def run_limited_query(
    connection: duckdb.DuckDBPyConnection,
    sql: str,
    limit: int,
) -> dict[str, Any]:
    safe_sql = validate_select_query(sql)
    limited_sql = f"SELECT * FROM ({safe_sql}) AS filtered_result LIMIT ?"
    result = connection.execute(limited_sql, [limit])
    columns = [description[0] for description in result.description]
    rows = result.fetchall()

    return {
        "columns": columns,
        "rows": [dict(zip(columns, row)) for row in rows],
        "row_count": len(rows),
        "limit": limit,
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV uploads are supported")

    dataset_id = uuid4().hex
    safe_filename = sanitize_filename(file.filename)
    uploaded_path = UPLOADS_DIR / f"{dataset_id}_{safe_filename}"
    duckdb_path = SESSIONS_DIR / f"{dataset_id}.duckdb"

    try:
        with uploaded_path.open("wb") as destination:
            shutil.copyfileobj(file.file, destination)

        with duckdb.connect(str(duckdb_path)) as connection:
            connection.execute(
                f"CREATE TABLE {TABLE_NAME} AS SELECT * FROM read_csv_auto(?, HEADER=TRUE)",
                [str(uploaded_path)],
            )
            schema = fetch_schema(connection)
            preview = fetch_preview(connection)
            row_count, column_count = table_stats(connection)

    except duckdb.Error as error:
        uploaded_path.unlink(missing_ok=True)
        duckdb_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Could not load CSV: {error}") from error
    finally:
        await file.close()

    metadata = {
        "dataset_id": dataset_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "table_name": TABLE_NAME,
        "uploaded_path": str(uploaded_path),
        "duckdb_path": str(duckdb_path),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "row_count": row_count,
        "column_count": column_count,
        "schema": schema,
    }
    dataset_sessions[dataset_id] = metadata

    return {
        "dataset": metadata,
        "preview": preview,
    }


@app.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    return {"dataset": get_dataset_metadata(dataset_id)}


@app.get("/datasets/{dataset_id}/preview")
def get_dataset_preview(
    dataset_id: str,
    limit: int = DEFAULT_PREVIEW_LIMIT,
) -> dict[str, Any]:
    if limit < 1 or limit > MAX_QUERY_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Preview limit must be between 1 and {MAX_QUERY_LIMIT}",
        )

    with get_connection(dataset_id) as connection:
        rows = fetch_preview(connection, limit)

    return {
        "dataset_id": dataset_id,
        "rows": rows,
        "row_count": len(rows),
        "limit": limit,
    }


@app.get("/datasets/{dataset_id}/schema")
def get_dataset_schema(dataset_id: str) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)

    return {
        "dataset_id": dataset_id,
        "table_name": metadata["table_name"],
        "schema": metadata["schema"],
        "column_count": metadata["column_count"],
    }


@app.post("/datasets/{dataset_id}/query")
def query_dataset(dataset_id: str, request: QueryRequest) -> dict[str, Any]:
    with get_connection(dataset_id) as connection:
        try:
            result = run_limited_query(connection, request.sql, request.limit)
        except duckdb.Error as error:
            raise HTTPException(status_code=400, detail=f"Query failed: {error}") from error

    return {
        "dataset_id": dataset_id,
        **result,
    }
