from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from openpyxl import Workbook

from backend.app import main
from backend.app.main import app
from backend.app.workbook_ingestion import ingest_workbook
from backend.app.workbook_source_registry import (
    WORKBOOK_SOURCE_REGISTRY_VERSION,
    create_original_source_registry,
    validate_source_registry,
)


def write_workbook(path: Path, second_value: str = "two") -> None:
    workbook = Workbook()
    first = workbook.active
    first.title = "Alpha"
    first.append(["id", "label"])
    first.append([1, "one"])
    first.append([2, second_value])
    second = workbook.create_sheet("Beta")
    second.append(["id", "description"])
    second.append([1, "secondary"])
    workbook.save(path)


class WorkbookSourceRegistryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory()
        root = Path(self.temp_dir.name)
        self.uploads = root / "uploads"
        self.sessions = root / "sessions"
        self.manifests = root / "manifests"
        self.uploads.mkdir()
        self.sessions.mkdir()
        self.manifests.mkdir()
        self.original_dirs = (main.UPLOADS_DIR, main.SESSIONS_DIR, main.MANIFESTS_DIR)
        main.UPLOADS_DIR = self.uploads
        main.SESSIONS_DIR = self.sessions
        main.MANIFESTS_DIR = self.manifests
        main.dataset_sessions.clear()

    def tearDown(self) -> None:
        main.UPLOADS_DIR, main.SESSIONS_DIR, main.MANIFESTS_DIR = self.original_dirs
        main.dataset_sessions.clear()
        self.temp_dir.cleanup()

    def ingest_fixture(self, dataset_id: str = "dataset-alpha", second_value: str = "two") -> dict:
        workbook_path = self.uploads / f"{dataset_id}.xlsx"
        write_workbook(workbook_path, second_value)
        return ingest_workbook(
            path=workbook_path,
            original_filename="source.xlsx",
            dataset_id=dataset_id,
            duckdb_path=self.sessions / f"{dataset_id}.duckdb",
            uploaded_at="2026-08-15T00:00:00+00:00",
        )

    def test_upload_persists_and_hydrates_original_source_registry(self) -> None:
        workbook_path = self.uploads / "upload.xlsx"
        write_workbook(workbook_path)

        with TestClient(app) as client, workbook_path.open("rb") as handle:
            response = client.post(
                "/datasets/upload",
                files={"file": ("upload.xlsx", handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        registry = payload["dataset"]["workbook_metadata"]["source_registry"]
        self.assertEqual(registry["version"], WORKBOOK_SOURCE_REGISTRY_VERSION)
        self.assertTrue(registry["readiness"]["ready"])
        self.assertEqual(len(registry["sources"]), 2)
        self.assertEqual(len(registry["revisions"]), 2)
        self.assertTrue(all(source["source_kind"] == "original" for source in registry["sources"]))

        manifest_path = next(self.manifests.glob("*.json"))
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        hydrated_once = main.read_workspace_manifest(manifest["workspace_id"], mark_opened=False)
        hydrated_twice = main.read_workspace_manifest(manifest["workspace_id"], mark_opened=False)
        self.assertEqual(
            hydrated_once["workbook_metadata"]["source_registry"],
            hydrated_twice["workbook_metadata"]["source_registry"],
        )

    def test_registry_creation_distinguishes_worksheets_and_materialization(self) -> None:
        first = self.ingest_fixture(dataset_id="dataset-one", second_value="two")
        second = self.ingest_fixture(dataset_id="dataset-two", second_value="changed")

        first_registry = first["workbook_metadata"]["source_registry"]
        second_registry = second["workbook_metadata"]["source_registry"]
        self.assertEqual(len({source["source_id"] for source in first_registry["sources"]}), 2)
        self.assertEqual(len(first_registry["current_revision_by_source_id"]), 2)
        self.assertNotEqual(
            first_registry["revisions"][0]["materialization_fingerprint"]["digest"],
            second_registry["revisions"][0]["materialization_fingerprint"]["digest"],
        )
        self.assertFalse("secondary" in json.dumps(first_registry))

    def test_same_canonical_inputs_reproduce_registry(self) -> None:
        first = self.ingest_fixture(dataset_id="stable-dataset")
        registry = first["workbook_metadata"]["source_registry"]
        workbook_path = self.uploads / "stable-dataset.xlsx"
        rebuilt = create_original_source_registry(
            dataset_id="stable-dataset",
            workbook_id="stable-dataset",
            uploaded_file_path=workbook_path,
            worksheets=[],
        )
        self.assertEqual(rebuilt["sources"], [])
        self.assertEqual(validate_source_registry(registry), registry)

    def test_structural_schema_changes_revision_but_profile_counts_do_not(self) -> None:
        result = self.ingest_fixture(dataset_id="schema-dataset")
        registry = result["workbook_metadata"]["source_registry"]
        revision = registry["revisions"][0]
        structural = revision["structural_schema_fingerprint"]
        changed_profile = json.loads(json.dumps(structural))
        changed_profile["columns"][0]["profileOnly"] = 123
        self.assertNotEqual(changed_profile, structural)
        self.assertEqual(structural["columns"][0]["ordinal"], 0)
        self.assertNotEqual(
            structural["fingerprint"],
            registry["revisions"][1]["structural_schema_fingerprint"]["fingerprint"],
        )

    def test_validation_fails_closed_for_tampered_and_unsupported_registry(self) -> None:
        result = self.ingest_fixture()
        registry = json.loads(json.dumps(result["workbook_metadata"]["source_registry"]))
        registry["revisions"][0]["revision"]["revisionId"] = "tampered"
        invalid = validate_source_registry(registry)
        self.assertFalse(invalid["readiness"]["ready"])
        self.assertIn("source_revision_invalid", invalid["readiness"]["reason_codes"])

        unsupported = validate_source_registry({"version": "workbook-source-registry:v999"})
        self.assertFalse(unsupported["readiness"]["ready"])
        self.assertIn("source_registry_version_unsupported", unsupported["readiness"]["reason_codes"])

    def test_legacy_manifest_without_registry_remains_readable_without_rewrite(self) -> None:
        workbook_path = self.uploads / "legacy.xlsx"
        write_workbook(workbook_path)
        result = ingest_workbook(
            path=workbook_path,
            original_filename="legacy.xlsx",
            dataset_id="legacy",
            duckdb_path=self.sessions / "legacy.duckdb",
            uploaded_at="2026-08-15T00:00:00+00:00",
        )
        workbook_metadata = result["workbook_metadata"]
        workbook_metadata.pop("source_registry", None)
        manifest = main.create_workspace_manifest(
            {
                "dataset_id": "legacy",
                "original_filename": "legacy.xlsx",
                "uploaded_path": str(workbook_path),
                "duckdb_path": str(self.sessions / "legacy.duckdb"),
                "schema": result["schema"],
                "row_count": result["row_count"],
                "column_count": result["column_count"],
                "uploaded_at": "2026-08-15T00:00:00+00:00",
                "workbook_metadata": workbook_metadata,
            }
        )
        manifest_path = main.workspace_manifest_path("legacy")
        main.atomic_write_text(manifest_path, json.dumps(manifest, indent=2))
        loaded = main.read_workspace_manifest("legacy", mark_opened=False)
        self.assertNotIn("source_registry", loaded["workbook_metadata"])
        before = manifest_path.read_text(encoding="utf-8")
        loaded = main.read_workspace_manifest("legacy", mark_opened=False)
        self.assertNotIn("source_registry", loaded["workbook_metadata"])
        self.assertEqual(manifest_path.read_text(encoding="utf-8"), before)

    def test_atomic_write_preserves_old_manifest_on_replace_failure(self) -> None:
        path = self.manifests / "atomic.json"
        path.write_text('{"old": true}', encoding="utf-8")
        with patch("backend.app.main.os.replace", side_effect=OSError("replace failed")):
            with self.assertRaises(OSError):
                main.atomic_write_text(path, '{"new": true}')
        self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"old": True})
        self.assertEqual(list(self.manifests.glob("*.tmp")), [])

    def test_upload_session_state_does_not_advance_when_manifest_persistence_fails(self) -> None:
        workbook_path = self.uploads / "upload-fails.xlsx"
        write_workbook(workbook_path)
        with patch("backend.app.main.atomic_write_text", side_effect=OSError("write failed")):
            with TestClient(app, raise_server_exceptions=False) as client, workbook_path.open("rb") as handle:
                response = client.post(
                    "/datasets/upload",
                    files={"file": ("upload-fails.xlsx", handle, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(main.dataset_sessions, {})


if __name__ == "__main__":
    unittest.main()
