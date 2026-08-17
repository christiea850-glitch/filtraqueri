from collections import OrderedDict
from contextlib import contextmanager
from copy import deepcopy
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4
import csv
import io
import json
import math
import os
import re
import shutil
import tempfile
import threading
import time

import duckdb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .workbook_contracts import (
    upsert_contract_for_candidate,
    validate_relationship_contracts,
)
from .workbook_contract_diagnostics import analyze_contract_diagnostics
from .workbook_ingestion import ingest_workbook
from .workbook_cleaning_apply import apply_cleaning_recipe_to_working_copy
from .workbook_cleaning_contract import (
    WorkbookCleaningApplyRequest,
    WorkbookCleaningPreviewRequest,
    validate_missing_value_plan_scope,
    validate_structural_decision_plan_scope,
    validate_transformation_plan_scope,
)
from .workbook_cleaning_preview import build_cleaning_recipe_preview
from .workbook_missing_value_apply import apply_missing_value_decisions_to_cleaned_copy
from .workbook_original_layout import extract_original_workbook_layout
from .workbook_source_registry import validate_source_registry
from .workbook_relationship_source_review import (
    SOURCE_AWARE_EXPECTATION_FIELDS,
    SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION,
    RelationshipSourceReviewError,
    append_acceptance_record,
    append_validation_record,
    compare_source_aware_expectations,
    create_candidate_authority,
    normalize_relationship_acceptance_history,
    normalize_relationship_source_validation_ledger,
    relationship_review_state_revision,
)

BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage"
UPLOADS_DIR = STORAGE_DIR / "uploads"
SESSIONS_DIR = STORAGE_DIR / "sessions"
MANIFESTS_DIR = STORAGE_DIR / "manifests"
TABLE_NAME = "data"
RESTORE_CLEANED_COPY_FALLBACK_WARNING = (
    "Cleaned working copy was unavailable during restore, so FiltraQueri returned "
    "to the original analysis table."
)
WORKSPACE_MANIFEST_VERSION = 1
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
MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="FiltraQueri API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

dataset_sessions: dict[str, dict[str, Any]] = {}


class RelationshipReviewLockEntry:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.references = 0
        self.last_used = time.monotonic()


relationship_review_locks: OrderedDict[str, RelationshipReviewLockEntry] = OrderedDict()
relationship_review_locks_guard = threading.Lock()
relationship_review_tokens: OrderedDict[str, str] = OrderedDict()
relationship_review_tokens_guard = threading.Lock()
MAX_RELATIONSHIP_REVIEW_LOCKS = 128
MAX_RELATIONSHIP_REVIEW_TOKENS = 512
RELATIONSHIP_REVIEW_LOCK_TIMEOUT_SECONDS = 5


def prune_idle_relationship_review_locks() -> None:
    while len(relationship_review_locks) > MAX_RELATIONSHIP_REVIEW_LOCKS:
        idle_key = next(
            (
                key
                for key, entry in relationship_review_locks.items()
                if entry.references == 0 and not entry.lock.locked()
            ),
            None,
        )
        if idle_key is None:
            return
        relationship_review_locks.pop(idle_key, None)


@contextmanager
def relationship_review_lock(dataset_id: str):
    with relationship_review_locks_guard:
        entry = relationship_review_locks.get(dataset_id)
        if entry is None:
            entry = RelationshipReviewLockEntry()
            relationship_review_locks[dataset_id] = entry
        entry.references += 1
        entry.last_used = time.monotonic()
        relationship_review_locks.move_to_end(dataset_id)
        prune_idle_relationship_review_locks()
    try:
        with entry.lock:
            yield
    finally:
        with relationship_review_locks_guard:
            entry.references = max(0, entry.references - 1)
            entry.last_used = time.monotonic()
            relationship_review_locks.move_to_end(dataset_id)
            prune_idle_relationship_review_locks()


def reserve_relationship_review_token(dataset_id: str, candidate_id: str, revision: str) -> str:
    token = f"{dataset_id}:{candidate_id}:{revision}"
    with relationship_review_tokens_guard:
        status = relationship_review_tokens.get(token)
        if status in {"in_progress", "consumed"}:
            raise RelationshipSourceReviewError(
                409,
                "relationship_review_state_stale",
            )
        relationship_review_tokens[token] = "in_progress"
        relationship_review_tokens.move_to_end(token)
        while len(relationship_review_tokens) > MAX_RELATIONSHIP_REVIEW_TOKENS:
            relationship_review_tokens.popitem(last=False)
    return token


def complete_relationship_review_token(token: str) -> None:
    with relationship_review_tokens_guard:
        if token in relationship_review_tokens:
            relationship_review_tokens[token] = "consumed"
            relationship_review_tokens.move_to_end(token)


def release_relationship_review_token(token: str) -> None:
    with relationship_review_tokens_guard:
        if relationship_review_tokens.get(token) == "in_progress":
            relationship_review_tokens.pop(token, None)


def relationship_review_cross_process_lock_path(dataset_id: str) -> Path:
    safe_dataset_id = re.sub(r"[^A-Za-z0-9_-]", "_", dataset_id)
    return MANIFESTS_DIR / f".relationship-review-{safe_dataset_id}.lock"


@contextmanager
def relationship_review_cross_process_lock(dataset_id: str):
    path = relationship_review_cross_process_lock_path(dataset_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    deadline = time.monotonic() + RELATIONSHIP_REVIEW_LOCK_TIMEOUT_SECONDS
    handle = None
    locked = False
    while not locked:
        try:
            path.touch(exist_ok=True)
            if path.stat().st_size == 0:
                with path.open("r+b") as initializer:
                    initializer.write(b"\0")
                    initializer.flush()
                    os.fsync(initializer.fileno())
            handle = path.open("r+b")
            handle.seek(0)
            if os.name == "nt":
                try:
                    import msvcrt
                except ImportError as error:
                    raise HTTPException(
                        status_code=409,
                        detail={"reason_code": "relationship_review_lock_unavailable"},
                    ) from error
                try:
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                    locked = True
                except OSError:
                    handle.close()
                    handle = None
            else:
                try:
                    import fcntl
                except ImportError as error:
                    raise HTTPException(
                        status_code=409,
                        detail={"reason_code": "relationship_review_lock_unavailable"},
                    ) from error
                try:
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    locked = True
                except OSError:
                    handle.close()
                    handle = None
            if locked:
                break
            if time.monotonic() >= deadline:
                raise HTTPException(
                    status_code=409,
                    detail={"reason_code": "relationship_review_lock_unavailable"},
                )
            time.sleep(0.01)
        except Exception:
            if handle is not None and not locked:
                handle.close()
            raise
    try:
        yield
    finally:
        if handle is not None:
            try:
                handle.seek(0)
                if os.name == "nt":
                    import msvcrt

                    msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    import fcntl

                    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
            finally:
                handle.close()


def workspace_manifest_path(workspace_id: str) -> Path:
    safe_workspace_id = re.sub(r"[^A-Za-z0-9_-]", "_", workspace_id)
    return MANIFESTS_DIR / f"{safe_workspace_id}.json"


def json_safe_value(value: Any) -> Any:
    if value is None:
        return None

    value_type_name = type(value).__name__.lower()
    if value_type_name in {"nattype"}:
        return None

    try:
        if value != value:
            return None
    except (TypeError, ValueError):
        pass

    if isinstance(value, datetime):
        return value.isoformat()

    if isinstance(value, date):
        return value.isoformat()

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        return {str(key): json_safe_value(item) for key, item in value.items()}

    if isinstance(value, (list, tuple, set)):
        return [json_safe_value(item) for item in value]

    item = getattr(value, "item", None)
    if callable(item):
        try:
            primitive_value = item()
            if primitive_value is not value:
                return json_safe_value(primitive_value)
        except (TypeError, ValueError, AttributeError):
            pass

    to_pydatetime = getattr(value, "to_pydatetime", None)
    if callable(to_pydatetime):
        try:
            return json_safe_value(to_pydatetime())
        except (TypeError, ValueError, AttributeError):
            pass

    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def json_safe_payload(payload: Any) -> Any:
    return json_safe_value(payload)


def dataset_manifest_entry(
    metadata: dict[str, Any], source_type: str = "uploaded"
) -> dict[str, Any]:
    entry = {
        "dataset_id": metadata["dataset_id"],
        "dataset_name": metadata["original_filename"],
        "source_type": source_type,
        "uploaded_path": metadata["uploaded_path"],
        "duckdb_path": metadata["duckdb_path"],
        "schema": metadata["schema"],
        "row_count": metadata["row_count"],
        "column_count": metadata["column_count"],
        "created_at": metadata["uploaded_at"],
    }
    if isinstance(metadata.get("workbook_metadata"), dict):
        entry["workbook_metadata"] = normalize_workbook_manifest_metadata(
            metadata["workbook_metadata"]
        )
    return entry


def create_workspace_manifest(
    metadata: dict[str, Any], workspace_id: str | None = None
) -> dict[str, Any]:
    resolved_workspace_id = workspace_id or metadata["dataset_id"]
    manifest = {
        "version": WORKSPACE_MANIFEST_VERSION,
        "workspace_id": resolved_workspace_id,
        "workspace_name": metadata["original_filename"],
        "active_dataset_id": metadata["dataset_id"],
        "active_result_id": "preview",
        "active_execution_id": None,
        "current_mode": "human",
        "current_result_tab": "preview",
        "filter_metadata": {},
        "query_builder_metadata": {},
        "sql_workspace_metadata": {},
        "datasets": [dataset_manifest_entry(metadata)],
        "created_at": metadata["uploaded_at"],
        "last_opened_at": metadata["uploaded_at"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if isinstance(metadata.get("workbook_metadata"), dict):
        manifest["workbook_metadata"] = normalize_workbook_manifest_metadata(
            metadata["workbook_metadata"]
        )
    return manifest


def normalize_workbook_manifest_metadata(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None

    worksheets = (
        value.get("worksheets") if isinstance(value.get("worksheets"), list) else []
    )
    normalized_worksheets: list[dict[str, Any]] = []
    worksheet_ids: list[str] = []

    for index, worksheet in enumerate(worksheets):
        if not isinstance(worksheet, dict):
            continue

        worksheet_id = str(worksheet.get("worksheet_id") or f"worksheet:{index + 1}")
        table_name = str(worksheet.get("table_name") or "")
        sheet_name = str(worksheet.get("sheet_name") or f"Worksheet {index + 1}")
        if not table_name:
            continue

        schema = (
            worksheet.get("schema") if isinstance(worksheet.get("schema"), list) else []
        )
        status = (
            worksheet.get("status")
            if worksheet.get("status") in ("ready", "empty", "error", "skipped")
            else "error"
        )
        normalized_worksheet = {
            **worksheet,
            "worksheet_id": worksheet_id,
            "sheet_name": sheet_name,
            "display_name": str(worksheet.get("display_name") or sheet_name),
            "table_name": table_name,
            "original_index": int(worksheet.get("original_index") or index),
            "status": status,
            "schema": schema,
            "row_count": max(0, int(worksheet.get("row_count") or 0)),
            "column_count": max(0, int(worksheet.get("column_count") or len(schema))),
            "visible_columns": (
                worksheet.get("visible_columns")
                if isinstance(worksheet.get("visible_columns"), list)
                else [
                    column.get("name")
                    for column in schema
                    if isinstance(column, dict) and column.get("name")
                ]
            ),
            "hidden_columns": (
                worksheet.get("hidden_columns")
                if isinstance(worksheet.get("hidden_columns"), list)
                else []
            ),
            "normalization": (
                worksheet.get("normalization")
                if isinstance(worksheet.get("normalization"), dict)
                else {}
            ),
        }
        worksheet_ids.append(worksheet_id)
        normalized_worksheets.append(normalized_worksheet)

    active_worksheet_id = value.get("active_worksheet_id")
    if active_worksheet_id not in worksheet_ids:
        active_worksheet_id = next(
            (
                worksheet["worksheet_id"]
                for worksheet in normalized_worksheets
                if worksheet.get("status") == "ready"
            ),
            worksheet_ids[0] if worksheet_ids else None,
        )

    table_mappings = [
        {
            "sheet_name": worksheet["sheet_name"],
            "table_name": worksheet["table_name"],
            "original_index": worksheet["original_index"],
        }
        for worksheet in normalized_worksheets
    ]
    relationship_candidates = (
        value.get("relationship_candidates")
        if isinstance(value.get("relationship_candidates"), list)
        else []
    )
    normalized_relationship_candidates: list[dict[str, Any]] = []
    for index, candidate in enumerate(relationship_candidates):
        if not isinstance(candidate, dict):
            continue

        review_status = candidate.get("review_status")
        if review_status not in ("pending", "accepted", "dismissed"):
            review_status = "pending"
        confidence_label = candidate.get("confidence_label")
        if confidence_label not in ("low", "medium", "high"):
            confidence_label = "low"
        relationship_type = candidate.get("relationship_type")
        if relationship_type not in (
            "one_to_one_candidate",
            "one_to_many_candidate",
            "many_to_one_candidate",
            "unknown_candidate",
        ):
            relationship_type = "unknown_candidate"
        direction = candidate.get("direction")
        if direction not in (
            "source_to_target",
            "target_to_source",
            "bidirectional",
            "unknown",
        ):
            direction = "unknown"
        try:
            confidence = float(candidate.get("confidence") or 0)
        except (TypeError, ValueError):
            confidence = 0

        evidence = (
            candidate.get("evidence")
            if isinstance(candidate.get("evidence"), dict)
            else {}
        )
        evidence["summaries"] = (
            evidence.get("summaries")
            if isinstance(evidence.get("summaries"), list)
            else []
        )
        normalized_relationship_candidates.append(
            {
                **candidate,
                "relationship_id": str(
                    candidate.get("relationship_id") or f"relationship:{index + 1}"
                ),
                "workbook_id": str(
                    candidate.get("workbook_id")
                    or value.get("workbook_id")
                    or "workbook"
                ),
                "source_worksheet_id": str(candidate.get("source_worksheet_id") or ""),
                "source_worksheet_name": str(
                    candidate.get("source_worksheet_name") or "Source worksheet"
                ),
                "source_table": str(candidate.get("source_table") or ""),
                "source_column": str(candidate.get("source_column") or ""),
                "target_worksheet_id": str(candidate.get("target_worksheet_id") or ""),
                "target_worksheet_name": str(
                    candidate.get("target_worksheet_name") or "Target worksheet"
                ),
                "target_table": str(candidate.get("target_table") or ""),
                "target_column": str(candidate.get("target_column") or ""),
                "confidence": max(0, min(1, confidence)),
                "confidence_label": confidence_label,
                "relationship_type": relationship_type,
                "direction": direction,
                "evidence": evidence,
                "review_status": review_status,
                "reviewed_at": (
                    candidate.get("reviewed_at")
                    if isinstance(candidate.get("reviewed_at"), str)
                    else None
                ),
                "reviewed_by": (
                    candidate.get("reviewed_by")
                    if isinstance(candidate.get("reviewed_by"), str)
                    else None
                ),
                "review_notes": (
                    candidate.get("review_notes")
                    if isinstance(candidate.get("review_notes"), str)
                    else None
                ),
            }
        )
    accepted_contracts = (
        value.get("accepted_relationship_contracts")
        if isinstance(value.get("accepted_relationship_contracts"), list)
        else []
    )
    normalized_contracts: list[dict[str, Any]] = []
    for index, contract in enumerate(accepted_contracts):
        if not isinstance(contract, dict):
            continue
        relationship_type = contract.get("relationship_type")
        if relationship_type not in (
            "one_to_one_candidate",
            "one_to_many_candidate",
            "many_to_one_candidate",
            "unknown_candidate",
        ):
            relationship_type = "unknown_candidate"
        status = contract.get("status")
        if status not in ("active", "invalid", "stale"):
            status = "stale"
        validation_state = contract.get("validation_state")
        if validation_state not in ("valid", "warning", "broken"):
            validation_state = "warning"
        try:
            confidence = float(contract.get("confidence") or 0)
            overlap_ratio = float(contract.get("overlap_ratio") or 0)
            source_unique_ratio = float(contract.get("source_unique_ratio") or 0)
            target_unique_ratio = float(contract.get("target_unique_ratio") or 0)
        except (TypeError, ValueError):
            confidence = 0
            overlap_ratio = 0
            source_unique_ratio = 0
            target_unique_ratio = 0

        normalized_contracts.append(
            {
                **contract,
                "contract_id": str(
                    contract.get("contract_id") or f"contract:{index + 1}"
                ),
                "source_worksheet_id": str(contract.get("source_worksheet_id") or ""),
                "source_table_name": str(contract.get("source_table_name") or ""),
                "source_column_name": str(contract.get("source_column_name") or ""),
                "target_worksheet_id": str(contract.get("target_worksheet_id") or ""),
                "target_table_name": str(contract.get("target_table_name") or ""),
                "target_column_name": str(contract.get("target_column_name") or ""),
                "relationship_type": relationship_type,
                "confidence": max(0, min(1, confidence)),
                "accepted_from_candidate_id": str(
                    contract.get("accepted_from_candidate_id") or ""
                ),
                "accepted_at": str(contract.get("accepted_at") or ""),
                "accepted_by": (
                    contract.get("accepted_by")
                    if isinstance(contract.get("accepted_by"), str)
                    else None
                ),
                "status": status,
                "validation_state": validation_state,
                "validation_summary": (
                    contract.get("validation_summary")
                    if isinstance(contract.get("validation_summary"), list)
                    else []
                ),
                "overlap_ratio": max(0, min(1, overlap_ratio)),
                "source_unique_ratio": max(0, min(1, source_unique_ratio)),
                "target_unique_ratio": max(0, min(1, target_unique_ratio)),
                "inferred_type_compatible": bool(
                    contract.get("inferred_type_compatible")
                ),
                "last_validated_at": (
                    contract.get("last_validated_at")
                    if isinstance(contract.get("last_validated_at"), str)
                    else None
                ),
            }
        )

    normalized_metadata = {
        **value,
        "workbook_id": str(value.get("workbook_id") or "workbook"),
        "workspace_id": value.get("workspace_id"),
        "name": str(
            value.get("name")
            or value.get("source_file", {}).get("original_filename")
            or "Workbook"
        ),
        "status": (
            value.get("status")
            if value.get("status")
            in ("pending", "profiling", "ready", "partial", "error")
            else "partial"
        ),
        "worksheet_ids": worksheet_ids,
        "active_worksheet_id": active_worksheet_id,
        "worksheets": normalized_worksheets,
        "table_mappings": table_mappings,
        "relationship_candidates": normalized_relationship_candidates,
        "accepted_relationship_contracts": normalized_contracts,
        "ingestion_profile": (
            value.get("ingestion_profile")
            if isinstance(value.get("ingestion_profile"), dict)
            else {}
        ),
        "normalization": (
            value.get("normalization")
            if isinstance(value.get("normalization"), dict)
            else {}
        ),
    }
    normalized_metadata["accepted_relationship_contracts"] = (
        validate_relationship_contracts(normalized_metadata)
    )
    if "source_registry" in value:
        normalized_metadata["source_registry"] = validate_source_registry(
            value.get("source_registry")
        )
    if "relationship_source_validation_ledger" in value:
        normalized_metadata["relationship_source_validation_ledger"] = (
            normalize_relationship_source_validation_ledger(
                value.get("relationship_source_validation_ledger")
            )
        )
    if "relationship_acceptance_history" in value:
        normalized_metadata["relationship_acceptance_history"] = (
            normalize_relationship_acceptance_history(
                value.get("relationship_acceptance_history")
            )
        )
    return normalized_metadata


def normalize_workspace_name(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback

    trimmed_value = value.strip()
    return trimmed_value[:120] if trimmed_value else fallback


def normalize_workspace_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    datasets = (
        manifest.get("datasets") if isinstance(manifest.get("datasets"), list) else []
    )
    first_dataset = datasets[0] if datasets else {}
    fallback_name = (
        first_dataset.get("dataset_name") if isinstance(first_dataset, dict) else None
    )
    created_at = manifest.get("created_at") or datetime.now(timezone.utc).isoformat()

    manifest["version"] = manifest.get("version", WORKSPACE_MANIFEST_VERSION)
    manifest["workspace_id"] = str(manifest.get("workspace_id") or uuid4().hex)
    manifest["workspace_name"] = normalize_workspace_name(
        manifest.get("workspace_name"),
        str(fallback_name or "Untitled workspace"),
    )
    manifest["created_at"] = created_at
    manifest["updated_at"] = manifest.get("updated_at") or created_at
    manifest["last_opened_at"] = (
        manifest.get("last_opened_at") or manifest["updated_at"]
    )
    manifest["datasets"] = datasets

    if manifest.get("current_mode") not in ("human", "analyst"):
        manifest["current_mode"] = "human"
    if manifest.get("current_result_tab") not in ("preview", "filtered", "queried"):
        manifest["current_result_tab"] = "preview"
    if manifest.get("active_result_id") not in (None, "preview", "filtered", "queried"):
        manifest["active_result_id"] = manifest["current_result_tab"]
    if not isinstance(manifest.get("filter_metadata"), dict):
        manifest["filter_metadata"] = {}
    if not isinstance(manifest.get("query_builder_metadata"), dict):
        manifest["query_builder_metadata"] = {}
    if not isinstance(manifest.get("sql_workspace_metadata"), dict):
        manifest["sql_workspace_metadata"] = {}
    if isinstance(manifest.get("workbook_metadata"), dict):
        manifest["workbook_metadata"] = normalize_workbook_manifest_metadata(
            manifest["workbook_metadata"]
        )
    else:
        manifest.pop("workbook_metadata", None)
    for dataset in datasets:
        if isinstance(dataset, dict) and isinstance(
            dataset.get("workbook_metadata"), dict
        ):
            dataset["workbook_metadata"] = normalize_workbook_manifest_metadata(
                dataset["workbook_metadata"]
            )

    dataset_ids = {
        dataset.get("dataset_id")
        for dataset in datasets
        if isinstance(dataset, dict) and dataset.get("dataset_id")
    }
    if manifest.get("active_dataset_id") not in dataset_ids:
        manifest["active_dataset_id"] = next(
            (
                dataset.get("dataset_id")
                for dataset in datasets
                if isinstance(dataset, dict) and dataset.get("dataset_id")
            ),
            None,
        )

    return manifest


def save_workspace_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    manifest = normalize_workspace_manifest(json_safe_payload(manifest))
    manifest["updated_at"] = datetime.now(timezone.utc).isoformat()
    manifest = json_safe_payload(manifest)
    path = workspace_manifest_path(manifest["workspace_id"])
    try:
        manifest_json = json.dumps(manifest, indent=2)
    except TypeError as error:
        raise HTTPException(
            status_code=500,
            detail="Workspace manifest could not be serialized safely.",
        ) from error
    atomic_write_text(path, manifest_json)
    return manifest


def atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temp_file:
            temp_path = Path(temp_file.name)
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.replace(temp_path, path)
        temp_path = None
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass


def read_workspace_manifest(
    workspace_id: str, mark_opened: bool = True
) -> dict[str, Any]:
    path = workspace_manifest_path(workspace_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Workspace manifest not found")

    try:
        manifest = normalize_workspace_manifest(
            json.loads(path.read_text(encoding="utf-8"))
        )
    except json.JSONDecodeError as error:
        raise HTTPException(
            status_code=400, detail="Workspace manifest is invalid"
        ) from error

    if manifest.get("version") != WORKSPACE_MANIFEST_VERSION:
        raise HTTPException(
            status_code=400, detail="Workspace manifest version is not supported"
        )

    validate_workspace_manifest_files(manifest)
    hydrate_dataset_sessions_from_manifest(manifest)
    if mark_opened:
        manifest["last_opened_at"] = datetime.now(timezone.utc).isoformat()
        return save_workspace_manifest(manifest)
    return manifest


def workspace_manifest_health(manifest: dict[str, Any]) -> dict[str, Any]:
    messages: list[str] = []
    status = "recoverable"
    datasets = (
        manifest.get("datasets") if isinstance(manifest.get("datasets"), list) else []
    )

    if manifest.get("version") != WORKSPACE_MANIFEST_VERSION:
        messages.append("Unsupported manifest version.")
        status = "corrupted"
    if not manifest.get("workspace_id"):
        messages.append("Workspace id is missing.")
        status = "corrupted"
    if not datasets:
        messages.append("No datasets are registered in this workspace.")
        status = "stale" if status != "corrupted" else status

    for dataset_entry in datasets:
        if not isinstance(dataset_entry, dict) or not dataset_entry.get("dataset_id"):
            messages.append("Dataset manifest entry is invalid.")
            status = "corrupted"
            continue

        duckdb_path_value = dataset_entry.get("duckdb_path")
        uploaded_path_value = dataset_entry.get("uploaded_path")
        duckdb_path = Path(duckdb_path_value) if duckdb_path_value else None
        uploaded_path = Path(uploaded_path_value) if uploaded_path_value else None
        if (
            not duckdb_path
            or not uploaded_path
            or not duckdb_path.exists()
            or not uploaded_path.exists()
        ):
            messages.append(
                f"Dataset files are missing for {dataset_entry.get('dataset_name', 'dataset')}."
            )
            if status != "corrupted":
                status = "stale"
            continue

        workbook_metadata = dataset_entry.get("workbook_metadata")
        if isinstance(workbook_metadata, dict):
            workbook_messages = validate_workbook_manifest_tables(
                workbook_metadata, duckdb_path
            )
            if workbook_messages:
                messages.extend(workbook_messages)
                if status != "corrupted":
                    status = "stale"

    active_dataset_id = manifest.get("active_dataset_id")
    dataset_ids = {
        dataset.get("dataset_id")
        for dataset in datasets
        if isinstance(dataset, dict) and dataset.get("dataset_id")
    }
    if active_dataset_id and active_dataset_id not in dataset_ids:
        messages.append(
            "Active dataset reference is stale and will be reset on recovery."
        )
        if status == "recoverable":
            status = "stale"

    return {
        "status": status,
        "is_valid": status in ("active", "recoverable"),
        "messages": messages,
    }


def workspace_manifest_summary(
    manifest: dict[str, Any],
    status: str | None = None,
    messages: list[str] | None = None,
) -> dict[str, Any]:
    manifest = normalize_workspace_manifest(manifest)
    health = workspace_manifest_health(manifest)
    resolved_status = status or health["status"]
    resolved_messages = messages if messages is not None else health["messages"]
    active_dataset = next(
        (
            dataset
            for dataset in manifest.get("datasets", [])
            if dataset.get("dataset_id") == manifest.get("active_dataset_id")
        ),
        manifest.get("datasets", [None])[0] if manifest.get("datasets") else None,
    )

    return {
        "workspace_id": manifest["workspace_id"],
        "workspace_name": manifest["workspace_name"],
        "created_at": manifest["created_at"],
        "last_opened_at": manifest.get("last_opened_at") or manifest.get("updated_at"),
        "active_dataset": (
            {
                "dataset_id": active_dataset.get("dataset_id"),
                "dataset_name": active_dataset.get("dataset_name"),
                "row_count": active_dataset.get("row_count", 0),
                "column_count": active_dataset.get("column_count", 0),
            }
            if active_dataset
            else None
        ),
        "dataset_count": len(manifest.get("datasets", [])),
        "manifest_version": manifest.get("version"),
        "status": resolved_status,
        "recovery": {
            "can_recover": resolved_status in ("active", "recoverable"),
            "reason": resolved_messages[0] if resolved_messages else None,
        },
        "validation": {
            "is_valid": resolved_status in ("active", "recoverable"),
            "messages": resolved_messages,
        },
    }


def list_workspace_manifest_summaries() -> list[dict[str, Any]]:
    summaries: list[dict[str, Any]] = []
    for path in MANIFESTS_DIR.glob("*.json"):
        try:
            manifest = normalize_workspace_manifest(
                json.loads(path.read_text(encoding="utf-8"))
            )
            health = workspace_manifest_health(manifest)
            summaries.append(
                workspace_manifest_summary(
                    manifest,
                    status=health["status"],
                    messages=health["messages"],
                )
            )
        except (json.JSONDecodeError, OSError, TypeError):
            workspace_id = path.stem
            summaries.append(
                {
                    "workspace_id": workspace_id,
                    "workspace_name": workspace_id,
                    "created_at": "",
                    "last_opened_at": "",
                    "active_dataset": None,
                    "dataset_count": 0,
                    "manifest_version": None,
                    "status": "corrupted",
                    "recovery": {
                        "can_recover": False,
                        "reason": "Manifest JSON could not be read.",
                    },
                    "validation": {
                        "is_valid": False,
                        "messages": ["Manifest JSON could not be read."],
                    },
                }
            )

    return sorted(
        summaries,
        key=lambda summary: summary.get("last_opened_at")
        or summary.get("created_at")
        or "",
        reverse=True,
    )


def validate_workspace_manifest_files(manifest: dict[str, Any]) -> None:
    for dataset_entry in manifest.get("datasets", []):
        duckdb_path_value = dataset_entry.get("duckdb_path")
        uploaded_path_value = dataset_entry.get("uploaded_path")
        duckdb_path = Path(duckdb_path_value) if duckdb_path_value else None
        uploaded_path = Path(uploaded_path_value) if uploaded_path_value else None
        if (
            not duckdb_path
            or not uploaded_path
            or not duckdb_path.exists()
            or not uploaded_path.exists()
        ):
            raise HTTPException(
                status_code=404, detail="Workspace dataset files are missing"
            )
        workbook_metadata = dataset_entry.get("workbook_metadata")
        if isinstance(workbook_metadata, dict):
            workbook_messages = validate_workbook_manifest_tables(
                workbook_metadata,
                duckdb_path,
                include_active_source_warnings=False,
                include_compatibility_view_warning=False,
            )
            if workbook_messages:
                raise HTTPException(
                    status_code=404, detail="Workbook worksheet tables are missing"
                )


def validate_workbook_manifest_tables(
    workbook_metadata: dict[str, Any],
    duckdb_path: Path,
    *,
    include_active_source_warnings: bool = True,
    include_compatibility_view_warning: bool = True,
) -> list[str]:
    worksheets = (
        workbook_metadata.get("worksheets")
        if isinstance(workbook_metadata.get("worksheets"), list)
        else []
    )
    ready_table_names = [
        worksheet.get("table_name")
        for worksheet in worksheets
        if isinstance(worksheet, dict)
        and worksheet.get("status") == "ready"
        and worksheet.get("table_name")
    ]
    if not ready_table_names:
        return ["Workbook has no ready worksheets."]

    try:
        with duckdb.connect(str(duckdb_path), read_only=True) as connection:
            existing_tables = {
                row[0]
                for row in connection.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
                ).fetchall()
            }
            messages = [
                f"Workbook worksheet table is missing: {table_name}"
                for table_name in ready_table_names
                if table_name not in existing_tables
            ]
            if include_compatibility_view_warning and TABLE_NAME not in existing_tables:
                messages.append("Active workbook compatibility table is missing.")
            if include_active_source_warnings:
                messages.extend(
                    validate_active_analysis_source(workbook_metadata, existing_tables)
                )
            return messages
    except duckdb.Error:
        return ["Workbook DuckDB session could not be validated."]


def validate_active_analysis_source(
    workbook_metadata: dict[str, Any],
    existing_tables: set[str],
) -> list[str]:
    active_source = workbook_metadata.get("active_analysis_source")
    if not isinstance(active_source, dict):
        return []

    source_type = active_source.get("type")
    if source_type not in ("original", "cleaned_working_copy"):
        return [
            "Active analysis source type is invalid and will be reset during restore."
        ]

    worksheets = workbook_metadata.get("worksheets")
    worksheets = worksheets if isinstance(worksheets, list) else []
    worksheet = next(
        (
            candidate
            for candidate in worksheets
            if isinstance(candidate, dict)
            and candidate.get("worksheet_id") == active_source.get("worksheet_id")
        ),
        None,
    )
    if not worksheet:
        return [
            "Active analysis source worksheet is missing and will be reset during restore."
        ]

    original_table_name = worksheet.get("table_name")
    if not original_table_name or original_table_name not in existing_tables:
        return ["Active analysis source original worksheet table is missing."]
    if source_type == "original":
        return []

    cleaned_copies = workbook_metadata.get("cleaned_working_copies")
    cleaned_copies = cleaned_copies if isinstance(cleaned_copies, list) else []
    cleaned_copy = next(
        (
            candidate
            for candidate in cleaned_copies
            if isinstance(candidate, dict)
            and candidate.get("source_worksheet_id") == worksheet.get("worksheet_id")
        ),
        None,
    )
    cleaned_table_name = (
        cleaned_copy.get("cleaned_table_name") if cleaned_copy else None
    )
    if not cleaned_table_name or cleaned_table_name not in existing_tables:
        return [RESTORE_CLEANED_COPY_FALLBACK_WARNING]
    return []


def sanitize_restored_query_builder_metadata(
    manifest: dict[str, Any],
    valid_columns: set[str],
) -> bool:
    query_builder_metadata = manifest.get("query_builder_metadata")
    if not isinstance(query_builder_metadata, dict):
        return False

    sanitized = {**query_builder_metadata}
    for field in ("selected_columns", "group_by"):
        values = query_builder_metadata.get(field)
        if isinstance(values, list):
            sanitized[field] = [
                value
                for value in values
                if isinstance(value, str) and value in valid_columns
            ]

    aggregations = query_builder_metadata.get("aggregations")
    if isinstance(aggregations, list):
        sanitized["aggregations"] = [
            aggregation
            for aggregation in aggregations
            if isinstance(aggregation, dict)
            and (
                aggregation.get("column") in (None, "")
                or aggregation.get("column") in valid_columns
            )
        ]

    sort_column = query_builder_metadata.get("sort_column")
    if (
        isinstance(sort_column, str)
        and sort_column
        and sort_column not in valid_columns
    ):
        sanitized["sort_column"] = ""

    if sanitized == query_builder_metadata:
        return False
    manifest["query_builder_metadata"] = sanitized
    return True


def reconcile_restored_analysis_source(
    dataset_entry: dict[str, Any],
    manifest: dict[str, Any],
) -> bool:
    workbook_metadata = normalize_workbook_manifest_metadata(
        dataset_entry.get("workbook_metadata")
    )
    if not workbook_metadata:
        return False

    worksheets = workbook_metadata.get("worksheets")
    worksheets = worksheets if isinstance(worksheets, list) else []
    ready_worksheets = [
        worksheet
        for worksheet in worksheets
        if isinstance(worksheet, dict) and worksheet.get("status") == "ready"
    ]
    if not ready_worksheets:
        return False

    worksheet = next(
        (
            candidate
            for candidate in ready_worksheets
            if candidate.get("worksheet_id")
            == workbook_metadata.get("active_worksheet_id")
        ),
        ready_worksheets[0],
    )
    active_source = workbook_metadata.get("active_analysis_source")
    source_type = (
        active_source.get("type") if isinstance(active_source, dict) else "original"
    )
    source_worksheet_id = (
        active_source.get("worksheet_id") if isinstance(active_source, dict) else None
    )
    candidate_worksheet = next(
        (
            candidate
            for candidate in ready_worksheets
            if candidate.get("worksheet_id") == source_worksheet_id
        ),
        None,
    )
    should_persist = False
    fallback_warning: str | None = None
    if (
        source_type not in ("original", "cleaned_working_copy")
        or not candidate_worksheet
    ):
        source_type = "original"
        fallback_warning = "Active analysis source metadata was invalid during restore, so FiltraQueri returned to the original analysis table."
    else:
        worksheet = candidate_worksheet

    original_table_name = str(worksheet.get("table_name") or "")
    if not original_table_name:
        raise HTTPException(
            status_code=404, detail="Worksheet table mapping is missing"
        )

    duckdb_path = Path(str(dataset_entry.get("duckdb_path") or ""))
    try:
        with duckdb.connect(str(duckdb_path)) as connection:
            existing_tables = {
                row[0]
                for row in connection.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
                ).fetchall()
            }
            if original_table_name not in existing_tables:
                raise HTTPException(
                    status_code=404, detail="Worksheet table is missing"
                )

            trusted_table_name = original_table_name
            if source_type == "cleaned_working_copy":
                cleaned_copies = workbook_metadata.get("cleaned_working_copies")
                cleaned_copies = (
                    cleaned_copies if isinstance(cleaned_copies, list) else []
                )
                cleaned_copy = next(
                    (
                        candidate
                        for candidate in cleaned_copies
                        if isinstance(candidate, dict)
                        and candidate.get("source_worksheet_id")
                        == worksheet.get("worksheet_id")
                    ),
                    None,
                )
                cleaned_table_name = (
                    cleaned_copy.get("cleaned_table_name") if cleaned_copy else None
                )
                if cleaned_table_name and cleaned_table_name in existing_tables:
                    trusted_table_name = str(cleaned_table_name)
                else:
                    source_type = "original"
                    fallback_warning = RESTORE_CLEANED_COPY_FALLBACK_WARNING

            connection.execute(
                f"CREATE OR REPLACE VIEW {quote_identifier(TABLE_NAME)} AS SELECT * FROM {quote_identifier(trusted_table_name)}"
            )
            schema = profile_dataset(connection)
            row_count, column_count = table_stats(connection)
    except HTTPException:
        raise
    except duckdb.Error as error:
        raise HTTPException(
            status_code=400, detail=f"Workbook restore failed: {error}"
        ) from error

    active_analysis_source = {
        "type": source_type,
        "worksheet_id": worksheet.get("worksheet_id"),
        "table_name": trusted_table_name,
        "original_table_name": original_table_name,
        "activated_at": datetime.now(timezone.utc).isoformat(),
    }
    workbook_metadata["active_worksheet_id"] = worksheet.get("worksheet_id")
    workbook_metadata["active_analysis_source"] = active_analysis_source
    if fallback_warning:
        normalization = workbook_metadata.get("normalization")
        normalization = normalization if isinstance(normalization, dict) else {}
        warnings = normalization.get("warnings")
        warnings = warnings if isinstance(warnings, list) else []
        if fallback_warning not in warnings:
            warnings.append(fallback_warning)
        normalization["warnings"] = warnings
        workbook_metadata["normalization"] = normalization
        should_persist = True

    dataset_entry["schema"] = schema
    dataset_entry["row_count"] = row_count
    dataset_entry["column_count"] = column_count
    dataset_entry["workbook_metadata"] = workbook_metadata
    if manifest.get("active_dataset_id") == dataset_entry.get("dataset_id"):
        manifest["workbook_metadata"] = workbook_metadata
        should_persist = (
            sanitize_restored_query_builder_metadata(
                manifest,
                {column["name"] for column in schema},
            )
            or should_persist
        )
    return should_persist


def hydrate_dataset_sessions_from_manifest(manifest: dict[str, Any]) -> None:
    should_persist = False
    for dataset_entry in manifest.get("datasets", []):
        if isinstance(dataset_entry.get("workbook_metadata"), dict):
            should_persist = (
                reconcile_restored_analysis_source(dataset_entry, manifest)
                or should_persist
            )
        dataset_id = dataset_entry["dataset_id"]
        if dataset_id in dataset_sessions:
            continue

        metadata = {
            "dataset_id": dataset_id,
            "filename": sanitize_filename(dataset_entry["dataset_name"]),
            "original_filename": dataset_entry["dataset_name"],
            "table_name": TABLE_NAME,
            "uploaded_path": dataset_entry["uploaded_path"],
            "duckdb_path": dataset_entry["duckdb_path"],
            "uploaded_at": dataset_entry["created_at"],
            "row_count": dataset_entry["row_count"],
            "column_count": dataset_entry["column_count"],
            "schema": dataset_entry["schema"],
        }
        if isinstance(dataset_entry.get("workbook_metadata"), dict):
            metadata["workbook_metadata"] = normalize_workbook_manifest_metadata(
                dataset_entry["workbook_metadata"]
            )
        dataset_sessions[dataset_id] = metadata
    if should_persist:
        save_workspace_manifest(manifest)


def load_workspace_manifests() -> None:
    for path in MANIFESTS_DIR.glob("*.json"):
        try:
            manifest = normalize_workspace_manifest(
                json.loads(path.read_text(encoding="utf-8"))
            )
            if manifest.get("version") == WORKSPACE_MANIFEST_VERSION:
                validate_workspace_manifest_files(manifest)
                hydrate_dataset_sessions_from_manifest(manifest)
        except (json.JSONDecodeError, HTTPException, OSError, KeyError):
            continue


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


class WorkbookWorksheetSelectionRequest(BaseModel):
    worksheet_id: str = Field(..., min_length=1)


class WorkbookMissingValueColumnDecision(BaseModel):
    column_name: str = Field(..., min_length=1)
    strategy: str = Field(..., min_length=1)
    custom_value: str | None = None


class WorkbookMissingValueApplyRequest(BaseModel):
    worksheet_strategy: str = Field(..., min_length=1)
    column_decisions: list[WorkbookMissingValueColumnDecision] = Field(
        default_factory=list
    )


class WorkbookRelationshipReviewRequest(BaseModel):
    version: str | None = None
    candidate_id: str = Field(..., min_length=1)
    review_status: str
    notes: str | None = None
    expected_relationship_review_state_revision: str | None = None
    expected_candidate_revision_id: str | None = None
    expected_source_revision_id: str | None = None
    expected_target_revision_id: str | None = None
    expected_source_endpoint_signature_id: str | None = None
    expected_target_endpoint_signature_id: str | None = None
    expected_relationship_evidence_fingerprint: str | None = None


class WorkspaceManifestUpdate(BaseModel):
    workspace_name: str | None = None
    active_dataset_id: str | None = None
    active_result_id: str | None = None
    active_execution_id: str | None = None
    current_mode: str | None = None
    current_result_tab: str | None = None
    filter_metadata: dict[str, Any] | None = None
    query_builder_metadata: dict[str, Any] | None = None
    sql_workspace_metadata: dict[str, Any] | None = None


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
        sample_rows = connection.execute(f"""
            SELECT DISTINCT {identifier}
            FROM {TABLE_NAME}
            WHERE {identifier} IS NOT NULL
            LIMIT 12
            """).fetchall()
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

        # === Phase G1: additive distribution profile (failure-tolerant per branch) ===
        if inferred_type == "numeric":
            try:
                stats_row = connection.execute(f"""
                    SELECT MIN({identifier}), MAX({identifier}), AVG({identifier}),
                           MEDIAN({identifier}), STDDEV({identifier})
                    FROM {TABLE_NAME} WHERE {identifier} IS NOT NULL
                    """).fetchone()
                if stats_row and stats_row[0] is not None:
                    profile["numeric_stats"] = {
                        "min": float(stats_row[0]),
                        "max": float(stats_row[1]),
                        "mean": (
                            float(stats_row[2]) if stats_row[2] is not None else 0.0
                        ),
                        "median": (
                            float(stats_row[3]) if stats_row[3] is not None else 0.0
                        ),
                        "std": float(stats_row[4]) if stats_row[4] is not None else 0.0,
                    }
            except Exception:
                pass

            try:
                if profile.get("min") is not None and profile.get("max") is not None:
                    col_min = float(profile["min"])
                    col_max = float(profile["max"])
                    num_buckets = 10
                    if col_min == col_max:
                        single_count = connection.execute(
                            f"SELECT COUNT(*) FROM {TABLE_NAME} WHERE {identifier} IS NOT NULL"
                        ).fetchone()[0]
                        profile["histogram_buckets"] = [
                            {
                                "bucket_min": col_min,
                                "bucket_max": col_max,
                                "count": int(single_count),
                            }
                        ]
                    else:
                        bucket_width = (col_max - col_min) / num_buckets
                        histogram_rows = connection.execute(
                            f"""
                            SELECT
                                LEAST(CAST(FLOOR(({identifier} - ?) / ?) AS INTEGER), ?) AS bucket_idx,
                                COUNT(*) AS bucket_count
                            FROM {TABLE_NAME}
                            WHERE {identifier} IS NOT NULL
                            GROUP BY bucket_idx
                            ORDER BY bucket_idx
                            """,
                            [col_min, bucket_width, num_buckets - 1],
                        ).fetchall()
                        buckets = []
                        for bucket_idx, bucket_count in histogram_rows:
                            idx = int(bucket_idx)
                            b_min = col_min + idx * bucket_width
                            b_max = col_min + (idx + 1) * bucket_width
                            buckets.append(
                                {
                                    "bucket_min": float(b_min),
                                    "bucket_max": float(b_max),
                                    "count": int(bucket_count),
                                }
                            )
                        profile["histogram_buckets"] = buckets
            except Exception:
                pass

        elif inferred_type == "date":
            try:
                if profile.get("min") is not None and profile.get("max") is not None:
                    profile["date_range"] = {
                        "min": str(profile["min"]),
                        "max": str(profile["max"]),
                    }
            except Exception:
                pass

        elif inferred_type in ("categorical", "boolean"):
            try:
                top_rows = connection.execute(f"""
                    SELECT {identifier} AS top_value, COUNT(*) AS cnt
                    FROM {TABLE_NAME}
                    WHERE {identifier} IS NOT NULL
                    GROUP BY {identifier}
                    ORDER BY cnt DESC, top_value ASC
                    LIMIT 10
                    """).fetchall()
                profile["top_values"] = [
                    {
                        "value": str(value) if value is not None else "",
                        "count": int(cnt),
                    }
                    for value, cnt in top_rows
                ]
            except Exception:
                pass

        elif inferred_type == "text":
            try:
                length_row = connection.execute(f"""
                    SELECT MIN(LENGTH(CAST({identifier} AS VARCHAR))),
                           MAX(LENGTH(CAST({identifier} AS VARCHAR))),
                           AVG(LENGTH(CAST({identifier} AS VARCHAR)))
                    FROM {TABLE_NAME} WHERE {identifier} IS NOT NULL
                    """).fetchone()
                if length_row and length_row[0] is not None:
                    profile["text_length_stats"] = {
                        "min_length": int(length_row[0]),
                        "max_length": int(length_row[1]),
                        "avg_length": (
                            float(length_row[2]) if length_row[2] is not None else 0.0
                        ),
                    }
            except Exception:
                pass
        # === end Phase G1 ===

        profiles.append(profile)

    return profiles


def fetch_preview(
    connection: duckdb.DuckDBPyConnection,
    limit: int = DEFAULT_PREVIEW_LIMIT,
    page: int = 1,
    order_by: SortDefinition | None = None,
    valid_columns: set[str] | None = None,
    table_name: str = TABLE_NAME,
) -> list[dict[str, Any]]:
    params: list[Any] = [limit, (page - 1) * limit]
    order_clause = build_order_clause(order_by, valid_columns or set())
    result = connection.execute(
        f"SELECT * FROM {quote_identifier(table_name)} {order_clause} LIMIT ? OFFSET ?",
        params,
    )
    columns = [description[0] for description in result.description]
    rows = result.fetchall()
    return [dict(zip(columns, row)) for row in rows]


def table_stats(connection: duckdb.DuckDBPyConnection) -> tuple[int, int]:
    row_count = connection.execute(f"SELECT COUNT(*) FROM {TABLE_NAME}").fetchone()[0]
    column_count = len(fetch_schema(connection))
    return row_count, column_count


def persist_dataset_manifest_metadata(metadata: dict[str, Any]) -> None:
    workspace_id = metadata.get("dataset_id")
    workbook_metadata = metadata.get("workbook_metadata")
    if isinstance(workbook_metadata, dict):
        workspace_id = workbook_metadata.get("workspace_id") or workspace_id

    if not workspace_id:
        return

    path = workspace_manifest_path(str(workspace_id))
    if not path.exists():
        return

    manifest = read_workspace_manifest(str(workspace_id), mark_opened=False)
    manifest["active_dataset_id"] = metadata["dataset_id"]
    if isinstance(workbook_metadata, dict):
        manifest["workbook_metadata"] = normalize_workbook_manifest_metadata(
            workbook_metadata
        )

    for dataset_entry in manifest.get("datasets", []):
        if dataset_entry.get("dataset_id") != metadata["dataset_id"]:
            continue

        dataset_entry["schema"] = metadata["schema"]
        dataset_entry["row_count"] = metadata["row_count"]
        dataset_entry["column_count"] = metadata["column_count"]
        if isinstance(workbook_metadata, dict):
            dataset_entry["workbook_metadata"] = normalize_workbook_manifest_metadata(
                workbook_metadata
            )

    save_workspace_manifest(manifest)


def load_latest_dataset_metadata_for_review(metadata: dict[str, Any]) -> dict[str, Any]:
    workbook_metadata = metadata.get("workbook_metadata")
    workspace_id = metadata.get("dataset_id")
    if isinstance(workbook_metadata, dict):
        workspace_id = workbook_metadata.get("workspace_id") or workspace_id
    if not workspace_id:
        return deepcopy(metadata)

    path = workspace_manifest_path(str(workspace_id))
    if not path.exists():
        return deepcopy(metadata)
    try:
        manifest = normalize_workspace_manifest(
            json.loads(path.read_text(encoding="utf-8"))
        )
    except (OSError, json.JSONDecodeError):
        return deepcopy(metadata)

    latest = deepcopy(metadata)
    for dataset_entry in manifest.get("datasets", []):
        if not isinstance(dataset_entry, dict):
            continue
        if dataset_entry.get("dataset_id") != metadata.get("dataset_id"):
            continue
        latest["schema"] = dataset_entry.get("schema", latest.get("schema"))
        latest["row_count"] = dataset_entry.get("row_count", latest.get("row_count"))
        latest["column_count"] = dataset_entry.get(
            "column_count",
            latest.get("column_count"),
        )
        if isinstance(dataset_entry.get("workbook_metadata"), dict):
            latest["workbook_metadata"] = dataset_entry["workbook_metadata"]
        break
    else:
        if isinstance(manifest.get("workbook_metadata"), dict):
            latest["workbook_metadata"] = manifest["workbook_metadata"]
    return latest


def persist_dataset_manifest_metadata_for_review(metadata: dict[str, Any]) -> None:
    workspace_id = metadata.get("dataset_id")
    workbook_metadata = metadata.get("workbook_metadata")
    if isinstance(workbook_metadata, dict):
        workspace_id = workbook_metadata.get("workspace_id") or workspace_id
    if not workspace_id:
        return

    path = workspace_manifest_path(str(workspace_id))
    if not path.exists():
        return
    manifest = normalize_workspace_manifest(json.loads(path.read_text(encoding="utf-8")))
    manifest["active_dataset_id"] = metadata["dataset_id"]
    if isinstance(workbook_metadata, dict):
        manifest["workbook_metadata"] = normalize_workbook_manifest_metadata(
            workbook_metadata
        )
    for dataset_entry in manifest.get("datasets", []):
        if not isinstance(dataset_entry, dict):
            continue
        if dataset_entry.get("dataset_id") != metadata["dataset_id"]:
            continue
        dataset_entry["schema"] = metadata["schema"]
        dataset_entry["row_count"] = metadata["row_count"]
        dataset_entry["column_count"] = metadata["column_count"]
        if isinstance(workbook_metadata, dict):
            dataset_entry["workbook_metadata"] = normalize_workbook_manifest_metadata(
                workbook_metadata
            )
    save_workspace_manifest(manifest)


def build_filter_where_clause(
    filters: list[FilterDefinition],
    valid_columns: set[str],
) -> tuple[str, list[Any]]:
    conditions: list[str] = []
    params: list[Any] = []

    for filter_item in filters:
        if filter_item.column not in valid_columns:
            raise HTTPException(
                status_code=400, detail=f"Unknown column: {filter_item.column}"
            )

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
        raise HTTPException(
            status_code=400, detail="Sort direction must be ASC or DESC"
        )

    if valid_columns and order_by.column not in valid_columns:
        raise HTTPException(
            status_code=400, detail=f"Unknown sort column: {order_by.column}"
        )

    return f"ORDER BY {quote_identifier(order_by.column)} {sort_direction}"


def rows_to_dicts(
    result: duckdb.DuckDBPyConnection,
) -> tuple[list[str], list[dict[str, Any]]]:
    columns = [description[0] for description in result.description]
    rows = result.fetchall()
    return columns, [dict(zip(columns, row)) for row in rows]


def csv_response(
    columns: list[str], rows: list[dict[str, Any]], filename: str
) -> Response:
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
            raise HTTPException(
                status_code=400, detail=f"Unsupported aggregation: {function}"
            )

        if function == "COUNT" and not aggregation.column:
            expression = "COUNT(*)"
            default_alias = "count_rows"
        else:
            if not aggregation.column or aggregation.column not in valid_columns:
                raise HTTPException(
                    status_code=400, detail="Aggregation column is required"
                )

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

    non_grouped_columns = [
        column for column in selected_columns if column not in group_by
    ]
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
            raise HTTPException(
                status_code=400, detail="Sort direction must be ASC or DESC"
            )

        if sort_column not in output_columns and sort_column not in valid_columns:
            raise HTTPException(
                status_code=400, detail=f"Unknown sort column: {sort_column}"
            )

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
        raise HTTPException(
            status_code=400, detail="Only one SELECT statement is allowed"
        )

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


@app.on_event("startup")
def hydrate_workspace_manifests() -> None:
    load_workspace_manifests()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload filename is required")

    filename_lower = file.filename.lower()
    is_csv_upload = filename_lower.endswith(".csv")
    is_workbook_upload = filename_lower.endswith((".xlsx", ".xls"))

    if not is_csv_upload and not is_workbook_upload:
        raise HTTPException(
            status_code=400, detail="Only CSV and Excel workbook uploads are supported"
        )

    dataset_id = uuid4().hex
    safe_filename = sanitize_filename(file.filename)
    uploaded_path = UPLOADS_DIR / f"{dataset_id}_{safe_filename}"
    duckdb_path = SESSIONS_DIR / f"{dataset_id}.duckdb"

    try:
        with uploaded_path.open("wb") as destination:
            shutil.copyfileobj(file.file, destination)

        workbook_metadata = None

        if is_workbook_upload:
            uploaded_at = datetime.now(timezone.utc).isoformat()
            workbook_result = ingest_workbook(
                path=uploaded_path,
                original_filename=file.filename,
                dataset_id=dataset_id,
                duckdb_path=duckdb_path,
                uploaded_at=uploaded_at,
            )
            schema = workbook_result["schema"]
            preview = workbook_result["preview"]
            row_count = workbook_result["row_count"]
            column_count = workbook_result["column_count"]
            workbook_metadata = workbook_result["workbook_metadata"]
        else:
            with duckdb.connect(str(duckdb_path)) as connection:
                connection.execute(
                    f"CREATE TABLE {TABLE_NAME} AS SELECT * FROM read_csv_auto(?, HEADER=TRUE)",
                    [str(uploaded_path)],
                )
                schema = profile_dataset(connection)
                preview = fetch_preview(connection)
                row_count, column_count = table_stats(connection)
            uploaded_at = datetime.now(timezone.utc).isoformat()

    except duckdb.Error as error:
        uploaded_path.unlink(missing_ok=True)
        duckdb_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400, detail=f"Could not load CSV: {error}"
        ) from error
    except HTTPException:
        uploaded_path.unlink(missing_ok=True)
        duckdb_path.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    schema = json_safe_payload(schema)
    preview = json_safe_payload(preview)
    workbook_metadata = (
        json_safe_payload(workbook_metadata) if workbook_metadata else None
    )

    metadata = {
        "dataset_id": dataset_id,
        "filename": safe_filename,
        "original_filename": file.filename,
        "table_name": TABLE_NAME,
        "uploaded_path": str(uploaded_path),
        "duckdb_path": str(duckdb_path),
        "uploaded_at": uploaded_at,
        "row_count": row_count,
        "column_count": column_count,
        "schema": schema,
    }
    if workbook_metadata:
        metadata["workbook_metadata"] = workbook_metadata

    workspace_manifest = save_workspace_manifest(create_workspace_manifest(metadata))
    dataset_sessions[dataset_id] = metadata

    return {
        "dataset": metadata,
        "preview": preview,
        "workspace_manifest": workspace_manifest,
        "workbook_metadata": workbook_metadata,
    }


@app.get("/workspaces")
def list_workspaces() -> dict[str, Any]:
    return {"workspaces": list_workspace_manifest_summaries()}


@app.get("/workspaces/{workspace_id}")
def get_workspace_manifest(workspace_id: str) -> dict[str, Any]:
    return {"workspace": read_workspace_manifest(workspace_id)}


@app.put("/workspaces/{workspace_id}")
def update_workspace_manifest(
    workspace_id: str,
    request: WorkspaceManifestUpdate,
) -> dict[str, Any]:
    manifest = read_workspace_manifest(workspace_id)
    updates = request.model_dump(exclude_unset=True)

    for key, value in updates.items():
        if value is not None:
            if key == "workspace_name":
                manifest[key] = normalize_workspace_name(
                    value, manifest.get("workspace_name", "Untitled workspace")
                )
            else:
                manifest[key] = value

    if manifest.get("active_dataset_id") and not any(
        dataset["dataset_id"] == manifest["active_dataset_id"]
        for dataset in manifest.get("datasets", [])
    ):
        manifest["active_dataset_id"] = (
            manifest["datasets"][0]["dataset_id"] if manifest.get("datasets") else None
        )

    if manifest.get("current_result_tab") not in (
        None,
        "preview",
        "filtered",
        "queried",
    ):
        manifest["current_result_tab"] = "preview"
    if manifest.get("active_result_id") not in (None, "preview", "filtered", "queried"):
        manifest["active_result_id"] = manifest.get("current_result_tab") or "preview"
    if manifest.get("current_mode") not in (None, "human", "analyst"):
        manifest["current_mode"] = "human"

    return {"workspace": save_workspace_manifest(manifest)}


@app.delete("/workspaces/{workspace_id}/manifest")
def delete_workspace_manifest(workspace_id: str) -> dict[str, Any]:
    path = workspace_manifest_path(workspace_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Workspace manifest not found")

    try:
        manifest = normalize_workspace_manifest(
            json.loads(path.read_text(encoding="utf-8"))
        )
        health = workspace_manifest_health(manifest)
        status = health["status"]
    except (json.JSONDecodeError, OSError, TypeError):
        status = "corrupted"

    if status in ("active", "recoverable"):
        raise HTTPException(
            status_code=400,
            detail="Only stale or corrupted workspace manifests can be removed safely",
        )

    path.unlink(missing_ok=True)
    return {"removed": True, "workspace_id": workspace_id}


@app.get("/datasets/{dataset_id}")
def get_dataset(dataset_id: str) -> dict[str, Any]:
    return {"dataset": get_dataset_metadata(dataset_id)}


@app.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: str) -> dict[str, Any]:
    metadata = dataset_sessions.get(dataset_id)
    removed_artifacts: list[str] = []

    if metadata is None:
        # Fall back: scan manifests for orphaned references so the user can clean up
        # leftover state from datasets whose in-memory session was lost (e.g., backend
        # restart after upload but before we cached the manifest re-hydration).
        manifest_hit = False
        for manifest_path in MANIFESTS_DIR.glob("*.json"):
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
            datasets = manifest.get("datasets")
            if not isinstance(datasets, list):
                continue
            if any(
                isinstance(entry, dict) and entry.get("dataset_id") == dataset_id
                for entry in datasets
            ):
                manifest_hit = True
                break
        if not manifest_hit:
            raise HTTPException(status_code=404, detail="Dataset not found")

    if isinstance(metadata, dict):
        duckdb_path_value = metadata.get("duckdb_path")
        if duckdb_path_value:
            try:
                Path(duckdb_path_value).unlink(missing_ok=True)
                removed_artifacts.append("duckdb")
            except OSError:
                pass

        uploaded_path_value = metadata.get("uploaded_path")
        if uploaded_path_value:
            try:
                Path(uploaded_path_value).unlink(missing_ok=True)
                removed_artifacts.append("uploaded")
            except OSError:
                pass

    if dataset_sessions.pop(dataset_id, None) is not None:
        removed_artifacts.append("session")

    # Remove this dataset from any workspace manifests that reference it.
    # If a manifest has no other datasets after removal, drop the manifest file.
    for manifest_path in MANIFESTS_DIR.glob("*.json"):
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        datasets = manifest.get("datasets")
        if not isinstance(datasets, list):
            continue

        filtered_datasets = [
            entry
            for entry in datasets
            if not (isinstance(entry, dict) and entry.get("dataset_id") == dataset_id)
        ]
        changed = len(filtered_datasets) != len(datasets)

        if manifest.get("active_dataset_id") == dataset_id:
            manifest["active_dataset_id"] = None
            changed = True

        if not changed:
            continue

        manifest["datasets"] = filtered_datasets
        try:
            if not filtered_datasets:
                manifest_path.unlink(missing_ok=True)
                removed_artifacts.append(f"manifest:{manifest_path.stem}")
            else:
                atomic_write_text(manifest_path, json.dumps(manifest))
                removed_artifacts.append(f"manifest_update:{manifest_path.stem}")
        except OSError:
            pass

    return {
        "deleted": True,
        "dataset_id": dataset_id,
        "removed_artifacts": removed_artifacts,
    }


@app.get("/datasets/{dataset_id}/preview")
def get_dataset_preview(
    dataset_id: str,
    limit: int = DEFAULT_PREVIEW_LIMIT,
    page: int = 1,
    sort_by: str | None = None,
    sort_direction: str = "ASC",
    worksheet_id: str | None = None,
) -> dict[str, Any]:
    if limit < 1 or limit > MAX_QUERY_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"Preview limit must be between 1 and {MAX_QUERY_LIMIT}",
        )
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be 1 or greater")

    metadata = get_dataset_metadata(dataset_id)
    table_name = TABLE_NAME
    schema = metadata["schema"]
    total_count = metadata["row_count"]
    if worksheet_id:
        workbook_metadata = normalize_workbook_manifest_metadata(
            metadata.get("workbook_metadata")
        )
        if not workbook_metadata:
            raise HTTPException(
                status_code=400, detail="Dataset does not contain workbook metadata"
            )

        worksheet = next(
            (
                worksheet
                for worksheet in workbook_metadata.get("worksheets", [])
                if worksheet.get("worksheet_id") == worksheet_id
            ),
            None,
        )
        if not worksheet:
            raise HTTPException(status_code=404, detail="Worksheet was not found")
        if worksheet.get("status") != "ready":
            raise HTTPException(
                status_code=400, detail="Only ready worksheets can be previewed"
            )

        table_name = worksheet.get("table_name")
        if not table_name:
            raise HTTPException(
                status_code=400, detail="Worksheet table mapping is missing"
            )
        schema = (
            worksheet.get("schema") if isinstance(worksheet.get("schema"), list) else []
        )

    valid_columns = {column["name"] for column in schema}
    order_by = (
        SortDefinition(column=sort_by, direction=sort_direction) if sort_by else None
    )
    with get_connection(dataset_id) as connection:
        if worksheet_id:
            table_exists = connection.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'main' AND table_name = ?
                """,
                [table_name],
            ).fetchone()[0]
            if not table_exists:
                raise HTTPException(
                    status_code=404, detail="Worksheet table is missing"
                )
            total_count = connection.execute(
                f"SELECT COUNT(*) FROM {quote_identifier(table_name)}"
            ).fetchone()[0]

        rows = fetch_preview(
            connection, limit, page, order_by, valid_columns, table_name
        )

    return {
        "dataset_id": dataset_id,
        "rows": rows,
        "row_count": len(rows),
        "total_count": total_count,
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


@app.get("/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/original-layout")
def get_original_workbook_layout(
    dataset_id: str,
    worksheet_id: str,
    row_start: int = 1,
    row_limit: int = 200,
    column_start: int = 1,
    column_limit: int = 50,
) -> dict[str, Any]:
    if row_start < 1 or column_start < 1:
        raise HTTPException(
            status_code=400,
            detail="Original workbook layout starts must be 1 or greater",
        )
    if row_limit < 1 or column_limit < 1:
        raise HTTPException(
            status_code=400,
            detail="Original workbook layout limits must be 1 or greater",
        )

    metadata = get_dataset_metadata(dataset_id)
    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    worksheet = next(
        (
            worksheet
            for worksheet in workbook_metadata.get("worksheets", [])
            if worksheet.get("worksheet_id") == worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    if worksheet.get("status") not in ("ready", "empty"):
        raise HTTPException(
            status_code=400,
            detail="Worksheet is not available for original workbook view",
        )

    uploaded_path = metadata.get("uploaded_path")
    if not uploaded_path:
        raise HTTPException(
            status_code=404, detail="Original workbook file mapping is missing"
        )

    return extract_original_workbook_layout(
        workbook_path=Path(uploaded_path),
        worksheet_index=int(worksheet.get("original_index") or 0),
        worksheet_id=worksheet_id,
        row_start=row_start,
        row_limit=row_limit,
        column_start=column_start,
        column_limit=column_limit,
    )


def _get_cleaning_recipe_preview(
    dataset_id: str,
    worksheet_id: str,
    row_limit: int = 10,
    structural_decision_plan: Any | None = None,
    missing_value_plan: Any | None = None,
    transformation_plan: Any | None = None,
) -> dict[str, Any]:
    if row_limit < 1:
        raise HTTPException(
            status_code=400, detail="Cleaning recipe preview limit must be 1 or greater"
        )

    metadata = get_dataset_metadata(dataset_id)
    uploaded_path = metadata.get("uploaded_path")
    if not uploaded_path:
        raise HTTPException(
            status_code=404, detail="Original workbook file mapping is missing"
        )
    if Path(uploaded_path).suffix.lower() != ".xlsx":
        raise HTTPException(
            status_code=400,
            detail="Cleaning recipe preview currently supports XLSX workbooks only",
        )

    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    worksheet = next(
        (
            worksheet
            for worksheet in workbook_metadata.get("worksheets", [])
            if worksheet.get("worksheet_id") == worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    validate_structural_decision_plan_scope(structural_decision_plan, worksheet_id)
    validate_missing_value_plan_scope(missing_value_plan, worksheet_id)
    validate_transformation_plan_scope(transformation_plan, worksheet_id, worksheet)

    return build_cleaning_recipe_preview(
        workbook_path=Path(uploaded_path),
        worksheet=worksheet,
        row_limit=row_limit,
        structural_decision_plan=structural_decision_plan,
        missing_value_plan=missing_value_plan,
        transformation_plan=transformation_plan,
    )


@app.get(
    "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/cleaning-recipe-preview"
)
def get_cleaning_recipe_preview(
    dataset_id: str,
    worksheet_id: str,
    row_limit: int = 10,
) -> dict[str, Any]:
    return _get_cleaning_recipe_preview(
        dataset_id=dataset_id,
        worksheet_id=worksheet_id,
        row_limit=row_limit,
    )


@app.post(
    "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/cleaning-recipe-preview"
)
def preview_cleaning_recipe_with_structural_decisions(
    dataset_id: str,
    worksheet_id: str,
    request: WorkbookCleaningPreviewRequest,
) -> dict[str, Any]:
    return _get_cleaning_recipe_preview(
        dataset_id=dataset_id,
        worksheet_id=worksheet_id,
        row_limit=request.row_limit_preview,
        structural_decision_plan=request.structural_decision_plan,
        missing_value_plan=request.missing_value_plan,
        transformation_plan=request.transformation_plan,
    )


@app.post(
    "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/apply-cleaning-recipe"
)
def apply_workbook_cleaning_recipe(
    dataset_id: str,
    worksheet_id: str,
    request: WorkbookCleaningApplyRequest | None = None,
) -> dict[str, Any]:
    """K1 / H3C-1 — apply the existing cleaning recipe to a new working copy.

    Creates a new DuckDB table named ``cleaned_<safe_worksheet_id>`` for the
    cleaned rows. Does **not** mutate the original uploaded workbook file,
    the per-worksheet source tables, or the active analysis VIEW (``data``).
    Idempotent: re-applying for the same worksheet drops and recreates the
    same cleaned table. CSV uploads are rejected with a clear message. If
    the worksheet does not need any cleanup, returns ``no_recipe_needed``
    without writing anything.
    """
    if request is None:
        request = WorkbookCleaningApplyRequest()

    metadata = get_dataset_metadata(dataset_id)
    uploaded_path_value = metadata.get("uploaded_path")
    duckdb_path_value = metadata.get("duckdb_path")
    if not uploaded_path_value or not duckdb_path_value:
        raise HTTPException(
            status_code=400,
            detail="Dataset has no uploaded file or session storage",
        )

    uploaded_path = Path(uploaded_path_value)
    duckdb_path = Path(duckdb_path_value)

    if uploaded_path.suffix.lower() != ".xlsx":
        raise HTTPException(
            status_code=400,
            detail=(
                "Apply cleaning recipe currently supports XLSX workbooks only. "
                "CSV uploads are not supported by this endpoint."
            ),
        )

    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400,
            detail="Dataset does not contain workbook metadata",
        )

    worksheet = next(
        (
            candidate
            for candidate in workbook_metadata.get("worksheets", [])
            if candidate.get("worksheet_id") == worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail="Only ready worksheets can have a cleaning recipe applied",
        )
    active_analysis_source = workbook_metadata.get("active_analysis_source")
    if (
        isinstance(active_analysis_source, dict)
        and active_analysis_source.get("type") == "cleaned_working_copy"
        and active_analysis_source.get("worksheet_id") == worksheet_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Return to the original analysis table before recreating this cleaned working copy",
        )

    validate_structural_decision_plan_scope(
        request.structural_decision_plan, worksheet_id
    )
    validate_missing_value_plan_scope(request.missing_value_plan, worksheet_id)
    validate_transformation_plan_scope(
        request.transformation_plan, worksheet_id, worksheet
    )

    result = apply_cleaning_recipe_to_working_copy(
        workbook_path=uploaded_path,
        worksheet=worksheet,
        duckdb_path=duckdb_path,
        dataset_id=dataset_id,
        row_limit_preview=request.row_limit_preview,
        structural_decision_plan=request.structural_decision_plan,
        missing_value_plan=request.missing_value_plan,
        transformation_plan=request.transformation_plan,
    )

    # Persist a working-copy record only when something was actually written.
    # The no-op response intentionally does not touch the manifest so that
    # repeated calls on clean tables stay free of stale entries.
    if result.get("status") == "applied_to_working_copy":
        cleaned_copies_raw = workbook_metadata.get("cleaned_working_copies")
        cleaned_copies = [
            entry
            for entry in (
                cleaned_copies_raw if isinstance(cleaned_copies_raw, list) else []
            )
            if isinstance(entry, dict)
            and entry.get("source_worksheet_id") != worksheet_id
        ]
        created_at = datetime.now(timezone.utc).isoformat()
        cleaned_copies.append(
            {
                "cleaned_copy_id": uuid4().hex,
                "source_worksheet_id": worksheet_id,
                "source_table_name": worksheet.get("table_name"),
                "cleaned_table_name": result["cleaned_table_name"],
                "recipe_applied": result["recipe_applied"],
                "excluded": result["excluded"],
                "missing_value_summary": result.get("missing_value_summary"),
                "before": result["before"],
                "after": {
                    "row_count": result["after"]["row_count"],
                    "column_count": result["after"]["column_count"],
                    "columns": result["after"]["columns"],
                },
                "created_at": created_at,
                "reversible_link": {
                    "worksheet_id": worksheet_id,
                    "source_table_name": worksheet.get("table_name"),
                    "active_analysis_table": metadata.get("table_name") or TABLE_NAME,
                },
            }
        )
        workbook_metadata["cleaned_working_copies"] = cleaned_copies
        workbook_metadata["updated_at"] = created_at
        metadata["workbook_metadata"] = workbook_metadata
        dataset_sessions[dataset_id] = metadata
        persist_dataset_manifest_metadata(metadata)

    return result


@app.post(
    "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/apply-missing-value-decisions"
)
def apply_workbook_missing_value_decisions(
    dataset_id: str,
    worksheet_id: str,
    request: WorkbookMissingValueApplyRequest,
) -> dict[str, Any]:
    """K7: apply confirmed missing-value decisions to one cleaned copy only."""
    metadata = get_dataset_metadata(dataset_id)
    duckdb_path_value = metadata.get("duckdb_path")
    if not duckdb_path_value:
        raise HTTPException(status_code=400, detail="Dataset has no session storage")

    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    worksheet = next(
        (
            candidate
            for candidate in workbook_metadata.get("worksheets", [])
            if candidate.get("worksheet_id") == worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail="Only ready worksheets can apply missing-value decisions",
        )

    active_analysis_source = workbook_metadata.get("active_analysis_source")
    if (
        isinstance(active_analysis_source, dict)
        and active_analysis_source.get("type") == "cleaned_working_copy"
        and active_analysis_source.get("worksheet_id") == worksheet_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Return to the original analysis table before updating this cleaned working copy",
        )

    cleaned_copy = next(
        (
            candidate
            for candidate in workbook_metadata.get("cleaned_working_copies", [])
            if isinstance(candidate, dict)
            and candidate.get("source_worksheet_id") == worksheet_id
        ),
        None,
    )
    if not cleaned_copy or not cleaned_copy.get("cleaned_table_name"):
        raise HTTPException(
            status_code=404,
            detail="Create a cleaned working copy before applying missing-value decisions",
        )

    allowed_worksheet_strategies = {
        "leave_unchanged",
        "layout_space",
        "remove_mostly_blank_rows",
        "decide_per_column",
    }
    if request.worksheet_strategy not in allowed_worksheet_strategies:
        raise HTTPException(
            status_code=400, detail="Unsupported worksheet missing-value strategy"
        )

    result = apply_missing_value_decisions_to_cleaned_copy(
        duckdb_path=Path(str(duckdb_path_value)),
        cleaned_table_name=str(cleaned_copy["cleaned_table_name"]),
        worksheet_schema=(
            worksheet.get("schema") if isinstance(worksheet.get("schema"), list) else []
        ),
        worksheet_name=str(
            worksheet.get("display_name") or worksheet.get("sheet_name") or worksheet_id
        ),
        worksheet_strategy=request.worksheet_strategy,
        column_decisions=[
            {
                "column_name": decision.column_name,
                "strategy": decision.strategy,
                "custom_value": decision.custom_value,
            }
            for decision in request.column_decisions
        ],
    )

    applied_at = datetime.now(timezone.utc).isoformat()
    cleaned_copy["missing_value_decisions"] = {
        "worksheet_strategy": request.worksheet_strategy,
        "column_decisions": [
            {
                "column_name": decision.column_name,
                "strategy": decision.strategy,
                "custom_value": decision.custom_value,
            }
            for decision in request.column_decisions
        ],
        "applied_at": applied_at,
        "columns_changed": result["columns_changed"],
        "rows_removed": result["rows_removed"],
        "skipped_decisions": result["skipped_decisions"],
    }
    cleaned_copy_after = cleaned_copy.get("after")
    if isinstance(cleaned_copy_after, dict):
        cleaned_copy_after["row_count"] = result["row_count"]
    workbook_metadata["updated_at"] = applied_at
    metadata["workbook_metadata"] = workbook_metadata
    dataset_sessions[dataset_id] = metadata
    persist_dataset_manifest_metadata(metadata)
    return result


def activate_workbook_analysis_table(
    *,
    dataset_id: str,
    metadata: dict[str, Any],
    workbook_metadata: dict[str, Any],
    worksheet: dict[str, Any],
    table_name: str,
    source_type: str,
) -> dict[str, Any]:
    try:
        with get_connection(dataset_id) as connection:
            table_exists = connection.execute(
                """
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = 'main' AND table_name = ?
                """,
                [table_name],
            ).fetchone()[0]
            if not table_exists:
                raise HTTPException(
                    status_code=404, detail="Analysis source table is missing"
                )

            connection.execute(
                f"CREATE OR REPLACE VIEW {quote_identifier(TABLE_NAME)} AS SELECT * FROM {quote_identifier(table_name)}"
            )
            schema = profile_dataset(connection)
            preview = fetch_preview(connection)
            row_count, column_count = table_stats(connection)
    except HTTPException:
        raise
    except duckdb.Error as error:
        raise HTTPException(
            status_code=400, detail=f"Analysis source switch failed: {error}"
        ) from error

    activated_at = datetime.now(timezone.utc).isoformat()
    active_analysis_source = {
        "type": source_type,
        "worksheet_id": worksheet.get("worksheet_id"),
        "table_name": table_name,
        "original_table_name": worksheet.get("table_name"),
        "activated_at": activated_at,
    }
    workbook_metadata["active_worksheet_id"] = worksheet.get("worksheet_id")
    workbook_metadata["active_analysis_source"] = active_analysis_source
    workbook_metadata["updated_at"] = activated_at
    metadata.update(
        {
            "table_name": TABLE_NAME,
            "schema": schema,
            "row_count": row_count,
            "column_count": column_count,
            "workbook_metadata": workbook_metadata,
        }
    )
    dataset_sessions[dataset_id] = metadata
    persist_dataset_manifest_metadata(metadata)

    return {
        "dataset": metadata,
        "preview": preview,
        "workbook_metadata": workbook_metadata,
        "active_analysis_source": active_analysis_source,
    }


@app.post(
    "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/activate-cleaned-copy"
)
def activate_cleaned_working_copy(
    dataset_id: str,
    worksheet_id: str,
) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    worksheet = next(
        (
            candidate
            for candidate in workbook_metadata.get("worksheets", [])
            if candidate.get("worksheet_id") == worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400,
            detail="Only ready worksheets can use a cleaned working copy",
        )

    cleaned_copy = next(
        (
            candidate
            for candidate in workbook_metadata.get("cleaned_working_copies", [])
            if isinstance(candidate, dict)
            and candidate.get("source_worksheet_id") == worksheet_id
        ),
        None,
    )
    if not cleaned_copy or not cleaned_copy.get("cleaned_table_name"):
        raise HTTPException(
            status_code=404, detail="Cleaned working copy was not found"
        )

    return activate_workbook_analysis_table(
        dataset_id=dataset_id,
        metadata=metadata,
        workbook_metadata=workbook_metadata,
        worksheet=worksheet,
        table_name=str(cleaned_copy["cleaned_table_name"]),
        source_type="cleaned_working_copy",
    )


@app.post(
    "/datasets/{dataset_id}/workbook/worksheets/{worksheet_id}/activate-original-copy"
)
def activate_original_analysis_table(
    dataset_id: str,
    worksheet_id: str,
) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    worksheet = next(
        (
            candidate
            for candidate in workbook_metadata.get("worksheets", [])
            if candidate.get("worksheet_id") == worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400, detail="Only ready worksheets can be activated"
        )
    table_name = worksheet.get("table_name")
    if not table_name:
        raise HTTPException(
            status_code=400, detail="Worksheet table mapping is missing"
        )

    return activate_workbook_analysis_table(
        dataset_id=dataset_id,
        metadata=metadata,
        workbook_metadata=workbook_metadata,
        worksheet=worksheet,
        table_name=str(table_name),
        source_type="original",
    )


@app.post("/datasets/{dataset_id}/workbook/active-worksheet")
def select_workbook_worksheet(
    dataset_id: str,
    request: WorkbookWorksheetSelectionRequest,
) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    worksheet = next(
        (
            worksheet
            for worksheet in workbook_metadata.get("worksheets", [])
            if worksheet.get("worksheet_id") == request.worksheet_id
        ),
        None,
    )
    if not worksheet:
        raise HTTPException(status_code=404, detail="Worksheet was not found")
    if worksheet.get("status") != "ready":
        raise HTTPException(
            status_code=400, detail="Only ready worksheets can be selected"
        )

    table_name = worksheet.get("table_name")
    if not table_name:
        raise HTTPException(
            status_code=400, detail="Worksheet table mapping is missing"
        )

    return activate_workbook_analysis_table(
        dataset_id=dataset_id,
        metadata=metadata,
        workbook_metadata=workbook_metadata,
        worksheet=worksheet,
        table_name=str(table_name),
        source_type="original",
    )


@app.post("/datasets/{dataset_id}/workbook/relationship-review")
def review_workbook_relationship(
    dataset_id: str,
    request: WorkbookRelationshipReviewRequest,
) -> dict[str, Any]:
    review_status = request.review_status
    if review_status not in ("pending", "accepted", "dismissed"):
        raise HTTPException(
            status_code=400,
            detail="Review status must be pending, accepted, or dismissed",
        )
    if request.version is not None and request.version != SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION:
        raise HTTPException(
            status_code=400,
            detail={
                "reason_code": "request_version_unsupported",
                "supported_version": SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION,
            },
        )
    if request.version == SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION:
        missing_fields = [
            field
            for field in SOURCE_AWARE_EXPECTATION_FIELDS
            if not getattr(request, field)
        ]
        if missing_fields:
            raise HTTPException(
                status_code=400,
                detail={
                    "reason_code": "required_expectation_missing",
                    "missing_fields": missing_fields,
                },
            )
        if review_status != "accepted":
            raise HTTPException(
                status_code=400,
                detail={
                    "reason_code": "source_aware_review_status_unsupported",
                    "supported_review_status": "accepted",
                },
            )
        try:
            source_aware_token = reserve_relationship_review_token(
                dataset_id,
                request.candidate_id,
                str(request.expected_relationship_review_state_revision or ""),
            )
        except RelationshipSourceReviewError as error:
            raise HTTPException(
                status_code=error.status_code,
                detail={"reason_code": error.reason_code},
            ) from error
    else:
        source_aware_token = None

    base_metadata = get_dataset_metadata(dataset_id)
    if request.version == SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION:
        try:
            with relationship_review_cross_process_lock(dataset_id), relationship_review_lock(dataset_id):
                latest_metadata = load_latest_dataset_metadata_for_review(base_metadata)
                workbook_metadata = normalize_workbook_manifest_metadata(
                    latest_metadata.get("workbook_metadata")
                )
                if not workbook_metadata:
                    raise HTTPException(
                        status_code=400,
                        detail="Dataset does not contain workbook metadata",
                    )
                candidates = workbook_metadata.get("relationship_candidates")
                if not isinstance(candidates, list):
                    candidates = []
                candidate_index = next(
                    (
                        index
                        for index, candidate in enumerate(candidates)
                        if isinstance(candidate, dict)
                        and candidate.get("relationship_id") == request.candidate_id
                    ),
                    None,
                )
                if candidate_index is None:
                    raise HTTPException(
                        status_code=404,
                        detail={"reason_code": "candidate_missing"},
                    )
                candidate = candidates[candidate_index]
                try:
                    with get_connection(dataset_id) as connection:
                        authority = create_candidate_authority(
                            connection=connection,
                            workbook_metadata=workbook_metadata,
                            candidate=candidate,
                        )
                    current_revision = relationship_review_state_revision(
                        workbook_metadata,
                        authority,
                    )
                    persisted_revision = workbook_metadata.get(
                        "relationship_review_state_revision"
                    )
                    if (
                        isinstance(persisted_revision, str)
                        and persisted_revision
                        and persisted_revision
                        != request.expected_relationship_review_state_revision
                    ):
                        raise RelationshipSourceReviewError(
                            409,
                            "relationship_review_state_stale",
                            authority={
                                "relationship_review_state_revision": current_revision,
                                **authority,
                            },
                        )
                    existing_source_bound = (
                        workbook_metadata.get("relationship_source_validation_ledger")
                        if isinstance(
                            workbook_metadata.get("relationship_source_validation_ledger"),
                            dict,
                        )
                        else {}
                    )
                    existing_current = (
                        existing_source_bound.get(
                            "current_validation_by_relationship_id"
                        )
                        if isinstance(
                            existing_source_bound.get(
                                "current_validation_by_relationship_id"
                            ),
                            dict,
                        )
                        else {}
                    )
                    if existing_current.get(request.candidate_id):
                        raise RelationshipSourceReviewError(
                            409,
                            "relationship_review_state_stale",
                            authority={
                                "relationship_review_state_revision": current_revision,
                                **authority,
                            },
                        )
                    compare_source_aware_expectations(
                        request_values=request.model_dump(),
                        current_state_revision=current_revision,
                        candidate_authority=authority,
                    )
                except RelationshipSourceReviewError as error:
                    detail = {
                        "reason_code": error.reason_code,
                        "relationship_review_state_revision": error.authority.get(
                            "relationship_review_state_revision"
                        ),
                        "authority": {
                            key: value
                            for key, value in error.authority.items()
                            if key != "validation"
                        },
                    }
                    raise HTTPException(status_code=error.status_code, detail=detail) from error
                except (duckdb.Error, ValueError) as error:
                    raise HTTPException(
                        status_code=409,
                        detail={"reason_code": "evidence_missing_invalid"},
                    ) from error

                next_metadata = deepcopy(latest_metadata)
                next_workbook_metadata = deepcopy(workbook_metadata)
                next_candidates = list(next_workbook_metadata.get("relationship_candidates") or [])
                next_candidate = deepcopy(next_candidates[candidate_index])
                next_candidate["review_status"] = review_status
                next_candidate["reviewed_at"] = datetime.now(timezone.utc).isoformat()
                next_candidate["reviewed_by"] = "local-workspace"
                next_candidate["review_notes"] = (request.notes or "").strip()[:500] or None
                next_candidates[candidate_index] = next_candidate
                next_workbook_metadata["relationship_candidates"] = next_candidates
                next_workbook_metadata = upsert_contract_for_candidate(
                    next_workbook_metadata,
                    next_candidate,
                    review_status,
                )
                contracts = next_workbook_metadata.get("accepted_relationship_contracts") or []
                contract = next(
                    (
                        item
                        for item in contracts
                        if isinstance(item, dict)
                        and item.get("accepted_from_candidate_id") == request.candidate_id
                    ),
                    {},
                )
                ledger, validation_record_id = append_validation_record(
                    next_workbook_metadata.get("relationship_source_validation_ledger"),
                    authority["validation"],
                )
                history, acceptance_record_id = append_acceptance_record(
                    next_workbook_metadata.get("relationship_acceptance_history"),
                    relationship_id=request.candidate_id,
                    review_status=review_status,
                    validation=authority["validation"],
                    contract_id=str(contract.get("contract_id") or ""),
                )
                next_workbook_metadata["relationship_source_validation_ledger"] = ledger
                next_workbook_metadata["relationship_acceptance_history"] = history
                current_source_bound_relationships = (
                    next_workbook_metadata.get("current_source_bound_relationships")
                    if isinstance(
                        next_workbook_metadata.get("current_source_bound_relationships"),
                        dict,
                    )
                    else {}
                )
                next_workbook_metadata["current_source_bound_relationships"] = {
                    **current_source_bound_relationships,
                    request.candidate_id: {
                        "relationship_id": request.candidate_id,
                        "validation_record_id": validation_record_id,
                        "acceptance_record_id": acceptance_record_id,
                        "validation_id": authority["validation"]["assessmentId"],
                        "validation_identity": authority["validation"]["validationIdentity"],
                        "contract_id": str(contract.get("contract_id") or ""),
                        "source_blind": False,
                    }
                }
                next_workbook_metadata["updated_at"] = datetime.now(timezone.utc).isoformat()
                next_metadata["workbook_metadata"] = next_workbook_metadata
                try:
                    next_revision = relationship_review_state_revision(
                        next_workbook_metadata,
                        authority,
                    )
                    next_workbook_metadata["relationship_review_state_revision"] = next_revision
                    persist_dataset_manifest_metadata_for_review(next_metadata)
                except (OSError, TypeError, ValueError, HTTPException) as error:
                    if isinstance(error, HTTPException):
                        raise
                    raise HTTPException(
                        status_code=500,
                        detail={"reason_code": "persistence_failure"},
                    ) from error
                dataset_sessions[dataset_id] = next_metadata
                complete_relationship_review_token(str(source_aware_token))
                summary = {
                    "total": len(next_candidates),
                    "pending": sum(
                        1
                        for item in next_candidates
                        if item.get("review_status", "pending") == "pending"
                    ),
                    "accepted": sum(
                        1 for item in next_candidates if item.get("review_status") == "accepted"
                    ),
                    "dismissed": sum(
                        1 for item in next_candidates if item.get("review_status") == "dismissed"
                    ),
                }
                return {
                    "dataset": next_metadata,
                    "candidate": next_candidate,
                    "summary": summary,
                    "workbook_metadata": next_workbook_metadata,
                    "source_authority": {
                        **authority,
                        "relationshipReviewStateRevision": next_revision,
                    },
                }
        except Exception:
            release_relationship_review_token(str(source_aware_token))
            raise

    metadata = get_dataset_metadata(dataset_id)
    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    candidates = workbook_metadata.get("relationship_candidates")
    if not isinstance(candidates, list):
        candidates = []

    candidate_index = next(
        (
            index
            for index, candidate in enumerate(candidates)
            if isinstance(candidate, dict)
            and candidate.get("relationship_id") == request.candidate_id
        ),
        None,
    )
    if candidate_index is None:
        raise HTTPException(
            status_code=404, detail="Relationship candidate was not found"
        )

    next_metadata = deepcopy(metadata)
    workbook_metadata = deepcopy(workbook_metadata)
    candidates = list(workbook_metadata.get("relationship_candidates") or [])
    candidate = deepcopy(candidates[candidate_index])
    candidate["review_status"] = review_status
    candidate["reviewed_at"] = (
        datetime.now(timezone.utc).isoformat() if review_status != "pending" else None
    )
    candidate["reviewed_by"] = "local-workspace" if review_status != "pending" else None
    candidate["review_notes"] = (request.notes or "").strip()[:500] or None
    candidates[candidate_index] = candidate
    workbook_metadata["relationship_candidates"] = candidates
    workbook_metadata = upsert_contract_for_candidate(
        workbook_metadata, candidate, review_status
    )
    workbook_metadata["updated_at"] = datetime.now(timezone.utc).isoformat()
    next_metadata["workbook_metadata"] = workbook_metadata
    persist_dataset_manifest_metadata_for_review(next_metadata)
    dataset_sessions[dataset_id] = next_metadata

    summary = {
        "total": len(candidates),
        "pending": sum(
            1
            for item in candidates
            if item.get("review_status", "pending") == "pending"
        ),
        "accepted": sum(
            1 for item in candidates if item.get("review_status") == "accepted"
        ),
        "dismissed": sum(
            1 for item in candidates if item.get("review_status") == "dismissed"
        ),
    }

    return {
        "dataset": next_metadata,
        "candidate": candidate,
        "summary": summary,
        "workbook_metadata": workbook_metadata,
    }


@app.get("/datasets/{dataset_id}/workbook/contract-diagnostics")
def get_workbook_contract_diagnostics(dataset_id: str) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    workbook_metadata = normalize_workbook_manifest_metadata(
        metadata.get("workbook_metadata")
    )
    if not workbook_metadata:
        raise HTTPException(
            status_code=400, detail="Dataset does not contain workbook metadata"
        )

    existing_tables: set[str] = set()
    try:
        with get_connection(dataset_id) as connection:
            existing_tables = {
                row[0]
                for row in connection.execute(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
                ).fetchall()
            }
    except duckdb.Error as error:
        raise HTTPException(
            status_code=400, detail=f"Contract diagnostics failed: {error}"
        ) from error

    diagnostics = analyze_contract_diagnostics(workbook_metadata, existing_tables)
    return {
        "dataset_id": dataset_id,
        "workbook_id": workbook_metadata.get("workbook_id"),
        **diagnostics,
    }


@app.post("/datasets/{dataset_id}/filter")
def filter_dataset(dataset_id: str, request: FilterRequest) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    valid_columns = {column["name"] for column in metadata["schema"]}

    with get_connection(dataset_id) as connection:
        try:
            where_clause, params = build_filter_where_clause(
                request.filters, valid_columns
            )
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
            raise HTTPException(
                status_code=400, detail=f"Filter failed: {error}"
            ) from error

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
def query_builder_dataset(
    dataset_id: str, request: QueryBuilderRequest
) -> dict[str, Any]:
    metadata = get_dataset_metadata(dataset_id)
    valid_columns = {column["name"] for column in metadata["schema"]}

    with get_connection(dataset_id) as connection:
        try:
            sql, count_sql, params, count_params = build_query_builder_sql(
                request, valid_columns
            )
            result = connection.execute(sql, params)
            columns, rows = rows_to_dicts(result)
            total_count = connection.execute(count_sql, count_params).fetchone()[0]
        except duckdb.Error as error:
            raise HTTPException(
                status_code=400, detail=f"Query builder failed: {error}"
            ) from error

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
                    raise HTTPException(
                        status_code=400, detail="Query builder definition is required"
                    )

                export_query = request.query_builder.model_copy(
                    update={"page": 1, "limit": request.limit}
                )
                sql, _, params, _ = build_query_builder_sql(export_query, valid_columns)
                result = connection.execute(sql, params)

            elif source in ("preview", "filter"):
                where_clause, params = build_filter_where_clause(
                    request.filters, valid_columns
                )
                order_clause = build_order_clause(request.order_by, valid_columns)
                sql = (
                    f"SELECT * FROM {TABLE_NAME} {where_clause} {order_clause} LIMIT ?"
                )
                result = connection.execute(sql, [*params, request.limit])

            else:
                raise HTTPException(status_code=400, detail="Unsupported export source")

            columns, rows = rows_to_dicts(result)
        except duckdb.Error as error:
            raise HTTPException(
                status_code=400, detail=f"Export failed: {error}"
            ) from error

    return csv_response(columns, rows, f"{metadata['filename']}_export.csv")


@app.post("/datasets/{dataset_id}/query")
def query_dataset(dataset_id: str, request: QueryRequest) -> dict[str, Any]:
    with get_connection(dataset_id) as connection:
        try:
            result = run_limited_query(connection, request.sql, request.limit)
        except duckdb.Error as error:
            raise HTTPException(
                status_code=400, detail=f"Query failed: {error}"
            ) from error

    return {
        "dataset_id": dataset_id,
        **result,
    }
