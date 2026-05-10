from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import csv
import io
import re
import shutil

import duckdb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
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
ALLOWED_AGGREGATIONS = {"COUNT", "SUM", "AVG", "MIN", "MAX"}
ALLOWED_SORT_DIRECTIONS = {"ASC", "DESC"}

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


class FilterDefinition(BaseModel):
    column: str
    type: str
    min: int | float | str | None = None
    max: int | float | str | None = None
    values: list[str] | None = None
    value: bool | None = None
    start: str | None = None
    end: str | None = None


class SortDefinition(BaseModel):
    column: str
    direction: str = "ASC"


class FilterRequest(BaseModel):
    filters: list[FilterDefinition] = Field(default_factory=list)
    limit: int = Field(DEFAULT_PREVIEW_LIMIT, ge=1, le=MAX_QUERY_LIMIT)
    page: int = Field(1, ge=1)
    order_by: SortDefinition | None = None


class AggregationDefinition(BaseModel):
    function: str
    column: str | None = None
    alias: str | None = None


class QueryBuilderRequest(BaseModel):
    selected_columns: list[str] = Field(default_factory=list)
    group_by: list[str] = Field(default_factory=list)
    aggregations: list[AggregationDefinition] = Field(default_factory=list)
    filters: list[FilterDefinition] = Field(default_factory=list)
    order_by: SortDefinition | None = None
    limit: int = Field(DEFAULT_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT)
    page: int = Field(1, ge=1)


class ExportRequest(BaseModel):
    source: str = "filter"
    filters: list[FilterDefinition] = Field(default_factory=list)
    query_builder: QueryBuilderRequest | None = None
    order_by: SortDefinition | None = None
    limit: int = Field(MAX_QUERY_LIMIT, ge=1, le=MAX_QUERY_LIMIT)


def sanitize_filename(filename: str) -> str:
    clean_name = Path(filename).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", clean_name) or "dataset.csv"


def quote_identifier(identifier: str) -> str:
    escaped_identifier = identifier.replace('"', '""')
    return f'"{escaped_identifier}"'


def safe_alias(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_]", "_", value).strip("_").lower() or "result"


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


def infer_column_type(duckdb_type: str, unique_count: int, row_count: int) -> str:
    normalized_type = duckdb_type.upper()

    if "BOOL" in normalized_type:
        return "boolean"

    if any(token in normalized_type for token in ("DATE", "TIME")):
        return "date"

    if any(
        token in normalized_type
        for token in ("INT", "DECIMAL", "DOUBLE", "FLOAT", "REAL", "NUMERIC")
    ):
        return "numeric"

    if unique_count <= 50 and (row_count == 0 or unique_count / row_count < 0.8):
        return "categorical"

    return "text"


def profile_dataset(connection: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
    schema = fetch_schema(connection)
    row_count = connection.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
    profiles: list[dict[str, Any]] = []

    for column in schema:
        column_name = column["name"]
        column_type = column["type"]
        identifier = quote_identifier(column_name)
        null_count = connection.execute(
            f"SELECT COUNT(*) FROM {TABLE_NAME} WHERE {identifier} IS NULL"
        ).fetchone()[0]
        unique_count = connection.execute(
            f"SELECT COUNT(DISTINCT {identifier}) FROM {TABLE_NAME}"
        ).fetchone()[0]
        sample_rows = connection.execute(
            f"""
            SELECT DISTINCT {identifier}
            FROM {TABLE_NAME}
            WHERE {identifier} IS NOT NULL
            LIMIT 12
            """
        ).fetchall()
        sample_values = [row[0] for row in sample_rows]
        inferred_type = infer_column_type(column_type, unique_count, row_count)
        profile: dict[str, Any] = {
            "name": column_name,
            "type": column_type,
            "inferred_type": inferred_type,
            "null_count": null_count,
            "unique_count": unique_count,
            "sample_values": sample_values,
        }

        if inferred_type in ("numeric", "date"):
            minimum, maximum = connection.execute(
                f"SELECT MIN({identifier}), MAX({identifier}) FROM {TABLE_NAME}"
            ).fetchone()
            profile["min"] = minimum
            profile["max"] = maximum

        profiles.append(profile)

    return profiles


def fetch_preview(
    connection: duckdb.DuckDBPyConnection,
    limit: int = DEFAULT_PREVIEW_LIMIT,
    page: int = 1,
    order_by: SortDefinition | None = None,
    valid_columns: set[str] | None = None,
) -> list[dict[str, Any]]:
    params: list[Any] = [limit, (page - 1) * limit]
    order_clause = build_order_clause(order_by, valid_columns or set())
    result = connection.execute(
        f"SELECT * FROM {TABLE_NAME} {order_clause} LIMIT ? OFFSET ?",
        params,
    )
    columns = [description[0] for description in result.description]
    rows = result.fetchall()
    return [dict(zip(columns, row)) for row in rows]


def table_stats(connection: duckdb.DuckDBPyConnection) -> tuple[int, int]:
    row_count = connection.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
    column_count = len(fetch_schema(connection))
    return row_count, column_count


def build_filter_where_clause(
    filters: list[FilterDefinition],
    valid_columns: set[str],
) -> tuple[str, list[Any]]:
    conditions: list[str] = []
    params: list[Any] = []

    for filter_item in filters:
        if filter_item.column not in valid_columns:
            raise HTTPException(status_code=400, detail=f"Unknown column: {filter_item.column}")

        identifier = quote_identifier(filter_item.column)
        filter_type = filter_item.type.lower()

        if filter_type == "numeric":
            if filter_item.min not in (None, ""):
                conditions.append(f"{identifier} >= ?")
                params.append(filter_item.min)
            if filter_item.max not in (None, ""):
                conditions.append(f"{identifier} <= ?")
                params.append(filter_item.max)

        elif filter_type in ("categorical", "text"):
            values = [value for value in (filter_item.values or []) if value != ""]
            if values:
                placeholders = ", ".join("?" for _ in values)
                conditions.append(f"{identifier} IN ({placeholders})")
                params.extend(values)

        elif filter_type == "date":
            if filter_item.start:
                conditions.append(f"{identifier} >= ?")
                params.append(filter_item.start)
            if filter_item.end:
                conditions.append(f"{identifier} <= ?")
                params.append(filter_item.end)

        elif filter_type == "boolean":
            if filter_item.value is not None:
                conditions.append(f"{identifier} = ?")
                params.append(filter_item.value)

    if not conditions:
        return "", []

    return f"WHERE {' AND '.join(conditions)}", params


def build_order_clause(order_by: SortDefinition | None, valid_columns: set[str]) -> str:
    if not order_by or not order_by.column:
        return ""

    sort_direction = order_by.direction.upper()
    if sort_direction not in ALLOWED_SORT_DIRECTIONS:
        raise HTTPException(status_code=400, detail="Sort direction must be ASC or DESC")

    if valid_columns and order_by.column not in valid_columns:
        raise HTTPException(status_code=400, detail=f"Unknown sort column: {order_by.column}")

    return f"ORDER BY {quote_identifier(order_by.column)} {sort_direction}"


def rows_to_dicts(result: duckdb.DuckDBPyConnection) -> tuple[list[str], list[dict[str, Any]]]:
    columns = [description[0] for description in result.description]
    rows = result.fetchall()
    return columns, [dict(zip(columns, row)) for row in rows]


def csv_response(columns: list[str], rows: list[dict[str, Any]], filename: str) -> Response:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def build_query_builder_sql(
    request: QueryBuilderRequest,
    valid_columns: set[str],
) -> tuple[str, str, list[Any], list[Any]]:
    selected_columns = list(dict.fromkeys(request.selected_columns))
    group_by = list(dict.fromkeys(request.group_by))

    for column in [*selected_columns, *group_by]:
        if column not in valid_columns:
            raise HTTPException(status_code=400, detail=f"Unknown column: {column}")

    select_parts: list[str] = []
    output_columns: set[str] = set()

    for column in selected_columns:
        select_parts.append(quote_identifier(column))
        output_columns.add(column)

    for column in group_by:
        if column not in output_columns:
            select_parts.append(quote_identifier(column))
            output_columns.add(column)

    for index, aggregation in enumerate(request.aggregations):
        function = aggregation.function.upper()

        if function not in ALLOWED_AGGREGATIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported aggregation: {function}")

        if function == "COUNT" and not aggregation.column:
            expression = "COUNT(*)"
            default_alias = "count_rows"
        else:
            if not aggregation.column or aggregation.column not in valid_columns:
                raise HTTPException(status_code=400, detail="Aggregation column is required")

            expression = f"{function}({quote_identifier(aggregation.column)})"
            default_alias = f"{function.lower()}_{safe_alias(aggregation.column)}"

        alias = safe_alias(aggregation.alias or default_alias)
        if alias in output_columns:
            alias = f"{alias}_{index + 1}"

        select_parts.append(f"{expression} AS {quote_identifier(alias)}")
        output_columns.add(alias)

    if not select_parts:
        select_parts.append("*")
        output_columns.update(valid_columns)

    non_grouped_columns = [column for column in selected_columns if column not in group_by]
    if request.aggregations and non_grouped_columns:
        raise HTTPException(
            status_code=400,
            detail="Selected columns must also be grouped when aggregations are used",
        )

    where_clause, params = build_filter_where_clause(request.filters, valid_columns)
    sql_parts = [f"SELECT {', '.join(select_parts)} FROM {TABLE_NAME}", where_clause]

    if group_by:
        sql_parts.append(
            "GROUP BY " + ", ".join(quote_identifier(column) for column in group_by)
        )

    count_sql = f"SELECT COUNT(*) FROM ({' '.join(part for part in sql_parts if part)}) AS query_builder_count"
    count_params = [*params]

    if request.order_by:
        sort_column = request.order_by.column
        sort_direction = request.order_by.direction.upper()

        if sort_direction not in ALLOWED_SORT_DIRECTIONS:
            raise HTTPException(status_code=400, detail="Sort direction must be ASC or DESC")

        if sort_column not in output_columns and sort_column not in valid_columns:
            raise HTTPException(status_code=400, detail=f"Unknown sort column: {sort_column}")

        sql_parts.append(f"ORDER BY {quote_identifier(sort_column)} {sort_direction}")

    sql_parts.append("LIMIT ? OFFSET ?")
    params.append(request.limit)
    params.append((request.page - 1) * request.limit)

    return " ".join(part for part in sql_parts if part), count_sql, params, count_params


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
            schema = profile_dataset(connection)
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
    page: int = 1,
    sort_by: str | None = None,
    sort_direction: str = "ASC",
) -> dict[str, Any]:
    if limit < 1 or limit > MAX_QUERY_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Preview limit must be between 1 and {MAX_QUERY_LIMIT}",
        )
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be 1 or greater")

    metadata = get_dataset_metadata(dataset_id)
    valid_columns = {column["name"] for column in metadata["schema"]}
    order_by = SortDefinition(column=sort_by, direction=sort_direction) if sort_by else None
    with get_connection(dataset_id) as connection:
        rows = fetch_preview(connection, limit, page, order_by, valid_columns)

    return {
        "dataset_id": dataset_id,
        "rows": rows,
        "row_count": len(rows),
        "total_count": metadata["row_count"],
        "limit": limit,
        "page": page,
    }


@app.get("/datasets/{dataset_id}/schema")
def get_dataset_schema(dataset_id: str) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)

    return {
        "dataset_id": dataset_id,
        "table_name": metadata["table_name"],
        "schema": metadata["schema"],
        "profiles": metadata["schema"],
        "column_count": metadata["column_count"],
    }


@app.post("/datasets/{dataset_id}/filter")
def filter_dataset(dataset_id: str, request: FilterRequest) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    valid_columns = {column["name"] for column in metadata["schema"]}

    with get_connection(dataset_id) as connection:
        try:
            where_clause, params = build_filter_where_clause(request.filters, valid_columns)
            order_clause = build_order_clause(request.order_by, valid_columns)
            query = f"SELECT * FROM {TABLE_NAME} {where_clause} {order_clause} LIMIT ? OFFSET ?"
            count_query = f"SELECT COUNT(*) FROM {TABLE_NAME} {where_clause}"
            preview_result = connection.execute(
                query,
                [*params, request.limit, (request.page - 1) * request.limit],
            )
            columns, rows = rows_to_dicts(preview_result)
            filtered_count = connection.execute(count_query, params).fetchone()[0]
        except duckdb.Error as error:
            raise HTTPException(status_code=400, detail=f"Filter failed: {error}") from error

    return {
        "dataset_id": dataset_id,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "filtered_count": filtered_count,
        "total_count": filtered_count,
        "limit": request.limit,
        "page": request.page,
    }


@app.post("/datasets/{dataset_id}/query-builder")
def query_builder_dataset(dataset_id: str, request: QueryBuilderRequest) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    valid_columns = {column["name"] for column in metadata["schema"]}

    with get_connection(dataset_id) as connection:
        try:
            sql, count_sql, params, count_params = build_query_builder_sql(request, valid_columns)
            result = connection.execute(sql, params)
            columns, rows = rows_to_dicts(result)
            total_count = connection.execute(count_sql, count_params).fetchone()[0]
        except duckdb.Error as error:
            raise HTTPException(status_code=400, detail=f"Query builder failed: {error}") from error

    return {
        "dataset_id": dataset_id,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "total_count": total_count,
        "limit": request.limit,
        "page": request.page,
    }


@app.post("/datasets/{dataset_id}/export")
def export_dataset(dataset_id: str, request: ExportRequest) -> Response:
    metadata = get_dataset_metadata(dataset_id)
    valid_columns = {column["name"] for column in metadata["schema"]}
    source = request.source.lower()

    with get_connection(dataset_id) as connection:
        try:
            if source == "query_builder":
                if not request.query_builder:
                    raise HTTPException(status_code=400, detail="Query builder definition is required")

                export_query = request.query_builder.model_copy(
                    update={"page": 1, "limit": request.limit}
                )
                sql, _, params, _ = build_query_builder_sql(export_query, valid_columns)
                result = connection.execute(sql, params)

            elif source in ("preview", "filter"):
                where_clause, params = build_filter_where_clause(request.filters, valid_columns)
                order_clause = build_order_clause(request.order_by, valid_columns)
                sql = f"SELECT * FROM {TABLE_NAME} {where_clause} {order_clause} LIMIT ?"
                result = connection.execute(sql, [*params, request.limit])

            else:
                raise HTTPException(status_code=400, detail="Unsupported export source")

            columns, rows = rows_to_dicts(result)
        except duckdb.Error as error:
            raise HTTPException(status_code=400, detail=f"Export failed: {error}") from error

    return csv_response(columns, rows, f"{metadata['filename']}_export.csv")


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
