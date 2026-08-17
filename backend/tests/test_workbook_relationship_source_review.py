from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
import copy
import duckdb
import json
import multiprocessing
import os
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from fastapi import HTTPException
from openpyxl import Workbook

from backend.app import main
from backend.app.main import app
from backend.app.workbook_relationship_source_review import (
    RELATIONSHIP_EVIDENCE_POLICY_VERSION,
    RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION,
    SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION,
    append_acceptance_record,
    append_validation_record,
    create_candidate_authority,
    create_relationship_evidence_fingerprint,
    deterministic_values_for_column,
    normalize_relationship_acceptance_history,
    normalize_relationship_source_validation_ledger,
    relationship_review_state_revision,
)


def write_relationship_workbook(path: Path) -> None:
    workbook = Workbook()
    people = workbook.active
    people.title = "People"
    people.append(["id", "name"])
    people.append([1, "Ada"])
    people.append([2, "Bea"])
    orders = workbook.create_sheet("Orders")
    orders.append(["person_id", "amount"])
    orders.append([1, 10])
    orders.append([1, 20])
    orders.append([2, 30])
    workbook.save(path)


def configure_process_storage(uploads: str, sessions: str, manifests: str) -> None:
    main.UPLOADS_DIR = Path(uploads)
    main.SESSIONS_DIR = Path(sessions)
    main.MANIFESTS_DIR = Path(manifests)
    main.dataset_sessions.clear()
    main.relationship_review_locks.clear()
    main.relationship_review_tokens.clear()


def lock_holder_process(
    uploads: str,
    sessions: str,
    manifests: str,
    dataset_id: str,
    ready_event,
    release_event,
    result_queue,
) -> None:
    configure_process_storage(uploads, sessions, manifests)
    with main.relationship_review_cross_process_lock(dataset_id):
        result_queue.put(("holder_acquired", main.relationship_review_cross_process_lock_path(dataset_id).exists()))
        ready_event.set()
        release_event.wait(10)


def lock_attempt_process(
    uploads: str,
    sessions: str,
    manifests: str,
    dataset_id: str,
    result_queue,
    started_event=None,
) -> None:
    configure_process_storage(uploads, sessions, manifests)
    if started_event is not None:
        started_event.set()
    started = time.monotonic()
    with main.relationship_review_cross_process_lock(dataset_id):
        result_queue.put(("attempt_acquired", round(time.monotonic() - started, 2)))


def crashing_lock_process(
    uploads: str,
    sessions: str,
    manifests: str,
    dataset_id: str,
    ready_event,
) -> None:
    configure_process_storage(uploads, sessions, manifests)
    with main.relationship_review_cross_process_lock(dataset_id):
        ready_event.set()
        os._exit(7)


def source_aware_review_process(
    uploads: str,
    sessions: str,
    manifests: str,
    workspace_id: str,
    dataset_id: str,
    request: dict,
    result_queue,
) -> None:
    configure_process_storage(uploads, sessions, manifests)
    try:
        manifest = json.loads(main.workspace_manifest_path(workspace_id).read_text(encoding="utf-8"))
        manifest = main.normalize_workspace_manifest(manifest)
        dataset_entry = next(
            item
            for item in manifest["datasets"]
            if item["dataset_id"] == dataset_id
        )
        main.dataset_sessions[dataset_id] = {
            "dataset_id": dataset_id,
            "original_filename": dataset_entry["dataset_name"],
            "uploaded_path": dataset_entry["uploaded_path"],
            "duckdb_path": dataset_entry["duckdb_path"],
            "schema": dataset_entry["schema"],
            "row_count": dataset_entry["row_count"],
            "column_count": dataset_entry["column_count"],
            "uploaded_at": dataset_entry["created_at"],
            "workbook_metadata": dataset_entry["workbook_metadata"],
        }
        result = main.review_workbook_relationship(
            dataset_id,
            main.WorkbookRelationshipReviewRequest(**request),
        )
        result_queue.put((200, {"candidate_id": result["candidate"]["relationship_id"]}))
    except HTTPException as error:
        result_queue.put((error.status_code, error.detail))
    except Exception as error:
        result_queue.put(("error", repr(error)))


class WorkbookRelationshipSourceReviewTests(unittest.TestCase):
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
        main.relationship_review_locks.clear()
        main.relationship_review_tokens.clear()

    def tearDown(self) -> None:
        main.UPLOADS_DIR, main.SESSIONS_DIR, main.MANIFESTS_DIR = self.original_dirs
        main.dataset_sessions.clear()
        main.relationship_review_locks.clear()
        main.relationship_review_tokens.clear()
        self.temp_dir.cleanup()

    def upload_fixture(self) -> tuple[str, dict, dict]:
        workbook_path = self.uploads / "relationships.xlsx"
        write_relationship_workbook(workbook_path)
        with TestClient(app) as client, workbook_path.open("rb") as handle:
            response = client.post(
                "/datasets/upload",
                files={
                    "file": (
                        "relationships.xlsx",
                        handle,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        dataset = payload["dataset"]
        workbook_metadata = dataset["workbook_metadata"]
        self.assertGreaterEqual(len(workbook_metadata["relationship_candidates"]), 1)
        return dataset["dataset_id"], dataset, workbook_metadata["relationship_candidates"][0]

    def authority_request(self, dataset_id: str, candidate: dict) -> dict:
        workbook_metadata = main.get_dataset_metadata(dataset_id)["workbook_metadata"]
        with main.get_connection(dataset_id) as connection:
            authority = create_candidate_authority(
                connection=connection,
                workbook_metadata=workbook_metadata,
                candidate=candidate,
            )
        revision = relationship_review_state_revision(workbook_metadata, authority)
        return {
            "version": SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION,
            "candidate_id": candidate["relationship_id"],
            "review_status": "accepted",
            "expected_relationship_review_state_revision": revision,
            "expected_candidate_revision_id": authority["candidateRevisionId"],
            "expected_source_revision_id": authority["sourceRevisionId"],
            "expected_target_revision_id": authority["targetRevisionId"],
            "expected_source_endpoint_signature_id": authority["sourceEndpoint"]["endpointSignatureId"],
            "expected_target_endpoint_signature_id": authority["targetEndpoint"]["endpointSignatureId"],
            "expected_relationship_evidence_fingerprint": authority["relationshipEvidenceFingerprint"]["fingerprint"],
        }

    def post_review(self, dataset_id: str, request: dict):
        with TestClient(app, raise_server_exceptions=False) as client:
            return client.post(
                f"/datasets/{dataset_id}/workbook/relationship-review",
                json=request,
            )

    def test_legacy_request_remains_compatible_and_source_blind(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        response = self.post_review(
            dataset_id,
            {
                "candidate_id": candidate["relationship_id"],
                "review_status": "accepted",
                "notes": "accepted from existing UI",
            },
        )
        self.assertEqual(response.status_code, 200)
        metadata = response.json()["workbook_metadata"]
        self.assertEqual(metadata["relationship_candidates"][0]["review_status"], "accepted")
        self.assertIn("accepted_relationship_contracts", metadata)
        self.assertNotIn("relationship_source_validation_ledger", metadata)
        self.assertNotIn("relationship_acceptance_history", metadata)

    def test_versioned_request_requires_complete_expectations(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        unsupported = self.post_review(
            dataset_id,
            {
                "version": "relationship-review-source-aware:v999",
                "candidate_id": candidate["relationship_id"],
                "review_status": "accepted",
            },
        )
        self.assertEqual(unsupported.status_code, 400)
        self.assertEqual(unsupported.json()["detail"]["reason_code"], "request_version_unsupported")

        partial = self.post_review(
            dataset_id,
            {
                "version": SOURCE_AWARE_RELATIONSHIP_REVIEW_REQUEST_VERSION,
                "candidate_id": candidate["relationship_id"],
                "review_status": "accepted",
            },
        )
        self.assertEqual(partial.status_code, 400)
        self.assertEqual(partial.json()["detail"]["reason_code"], "required_expectation_missing")

    def test_source_aware_acceptance_persists_immutable_ledger_and_history(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        request = self.authority_request(dataset_id, candidate)
        response = self.post_review(dataset_id, request)
        self.assertEqual(response.status_code, 200, response.text)
        metadata = response.json()["workbook_metadata"]
        ledger = metadata["relationship_source_validation_ledger"]
        history = metadata["relationship_acceptance_history"]
        self.assertEqual(ledger["version"], RELATIONSHIP_SOURCE_VALIDATION_LEDGER_VERSION)
        self.assertEqual(len(ledger["records"]), 1)
        self.assertEqual(len(history["records"]), 1)
        validation = ledger["records"][0]["validation"]
        self.assertEqual(history["records"][0]["validation_id"], validation["assessmentId"])
        self.assertEqual(
            metadata["current_source_bound_relationships"][candidate["relationship_id"]]["validation_id"],
            validation["assessmentId"],
        )
        self.assertNotIn("Ada", json.dumps(ledger))
        self.assertNotIn("Bea", json.dumps(ledger))
        self.assertEqual(
            validation["evidenceFingerprint"]["policyVersion"],
            RELATIONSHIP_EVIDENCE_POLICY_VERSION,
        )

        manifest = json.loads(next(self.manifests.glob("*.json")).read_text(encoding="utf-8"))
        reloaded = main.read_workspace_manifest(manifest["workspace_id"], mark_opened=False)
        self.assertEqual(
            reloaded["workbook_metadata"]["relationship_source_validation_ledger"],
            ledger,
        )

    def test_forged_expectations_and_stale_retry_mutate_nothing(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        original = copy.deepcopy(main.get_dataset_metadata(dataset_id)["workbook_metadata"])
        for field in (
            "expected_candidate_revision_id",
            "expected_source_revision_id",
            "expected_target_revision_id",
            "expected_source_endpoint_signature_id",
            "expected_target_endpoint_signature_id",
            "expected_relationship_evidence_fingerprint",
        ):
            request = self.authority_request(dataset_id, candidate)
            request[field] = f"forged:{field}"
            response = self.post_review(dataset_id, request)
            self.assertEqual(response.status_code, 409, field)
            self.assertEqual(
                main.get_dataset_metadata(dataset_id)["workbook_metadata"],
                original,
            )

        original_request = self.authority_request(dataset_id, candidate)
        accepted = self.post_review(dataset_id, original_request)
        self.assertEqual(accepted.status_code, 200)
        stale = self.post_review(dataset_id, original_request)
        self.assertEqual(stale.status_code, 409)
        self.assertEqual(stale.json()["detail"]["reason_code"], "relationship_review_state_stale")

    def test_missing_endpoint_invalid_registry_and_cleaned_context_reject(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()

        metadata = main.get_dataset_metadata(dataset_id)
        missing_endpoint = copy.deepcopy(metadata)
        missing_endpoint["workbook_metadata"]["relationship_candidates"][0]["source_column"] = "missing"
        main.dataset_sessions[dataset_id] = missing_endpoint
        request = self.authority_request_from_metadata_fails(dataset_id, candidate)
        self.assertEqual(request, "endpoint_missing")

        main.dataset_sessions[dataset_id] = metadata
        invalid_registry = copy.deepcopy(metadata)
        invalid_registry["workbook_metadata"]["source_registry"] = {"version": "workbook-source-registry:v999"}
        main.dataset_sessions[dataset_id] = invalid_registry
        self.assertEqual(
            self.authority_request_from_metadata_fails(dataset_id, candidate),
            "source_registry_invalid",
        )

        main.dataset_sessions[dataset_id] = metadata
        cleaned = copy.deepcopy(metadata)
        cleaned["workbook_metadata"]["source_registry"]["sources"][0]["source_kind"] = "cleaned_working_copy"
        cleaned["workbook_metadata"]["source_registry"]["revisions"][0]["source_kind"] = "cleaned_working_copy"
        main.dataset_sessions[dataset_id] = cleaned
        self.assertEqual(
            self.authority_request_from_metadata_fails(dataset_id, candidate),
            "cleaned_or_mixed_source_unsupported",
        )

    def authority_request_from_metadata_fails(self, dataset_id: str, candidate: dict) -> str:
        workbook_metadata = main.get_dataset_metadata(dataset_id)["workbook_metadata"]
        with main.get_connection(dataset_id) as connection:
            try:
                create_candidate_authority(
                    connection=connection,
                    workbook_metadata=workbook_metadata,
                    candidate=workbook_metadata["relationship_candidates"][0],
                )
            except Exception as error:
                return getattr(error, "reason_code", str(error))
        return "unexpected_success"

    def test_ledger_history_helpers_are_idempotent_and_fail_closed_for_tampering(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        workbook_metadata = main.get_dataset_metadata(dataset_id)["workbook_metadata"]
        with main.get_connection(dataset_id) as connection:
            authority = create_candidate_authority(
                connection=connection,
                workbook_metadata=workbook_metadata,
                candidate=candidate,
            )
        ledger, _ = append_validation_record({}, authority["validation"])
        ledger, _ = append_validation_record(ledger, authority["validation"])
        self.assertEqual(len(ledger["records"]), 1)
        history, _ = append_acceptance_record(
            {},
            relationship_id=candidate["relationship_id"],
            review_status="accepted",
            validation=authority["validation"],
            contract_id="contract",
        )
        history, _ = append_acceptance_record(
            history,
            relationship_id=candidate["relationship_id"],
            review_status="accepted",
            validation=authority["validation"],
            contract_id="contract",
        )
        self.assertEqual(len(history["records"]), 1)

        tampered = copy.deepcopy(ledger)
        tampered["records"][0]["validation"]["assessmentId"] = "forged"
        self.assertFalse(
            normalize_relationship_source_validation_ledger(tampered)["readiness"]["ready"]
        )
        unsupported = normalize_relationship_acceptance_history({"version": "relationship-source-acceptance-history:v999"})
        self.assertFalse(unsupported["readiness"]["ready"])

    def test_persistence_failure_preserves_session_for_source_aware_and_legacy(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        before = copy.deepcopy(main.get_dataset_metadata(dataset_id))
        with patch("backend.app.main.atomic_write_text", side_effect=OSError("write failed")):
            source_aware = self.post_review(dataset_id, self.authority_request(dataset_id, candidate))
        self.assertEqual(source_aware.status_code, 500)
        self.assertEqual(main.get_dataset_metadata(dataset_id), before)

        with patch("backend.app.main.atomic_write_text", side_effect=OSError("write failed")):
            legacy = self.post_review(
                dataset_id,
                {
                    "candidate_id": candidate["relationship_id"],
                    "review_status": "accepted",
                },
            )
        self.assertEqual(legacy.status_code, 500)
        self.assertEqual(main.get_dataset_metadata(dataset_id), before)

    def test_two_concurrent_source_aware_acceptances_have_one_winner(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        request = self.authority_request(dataset_id, candidate)

        def submit() -> int:
            return self.post_review(dataset_id, request).status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = sorted(executor.map(lambda _: submit(), range(2)))
        self.assertEqual(statuses, [200, 409])
        ledger = main.get_dataset_metadata(dataset_id)["workbook_metadata"]["relationship_source_validation_ledger"]
        self.assertEqual(len(ledger["records"]), 1)

    def test_cross_process_lock_anchor_is_handle_owned_and_persistent(self) -> None:
        lock_path = main.relationship_review_cross_process_lock_path("dataset-lock")
        with main.relationship_review_cross_process_lock("dataset-lock"):
            self.assertTrue(lock_path.exists())
        self.assertTrue(lock_path.exists())
        with main.relationship_review_cross_process_lock("dataset-lock"):
            self.assertTrue(lock_path.exists())

    def test_real_process_lock_excludes_waiter_and_recovers_after_crash(self) -> None:
        ctx = multiprocessing.get_context("spawn")
        ready = ctx.Event()
        release = ctx.Event()
        waiter_started = ctx.Event()
        results = ctx.Queue()
        holder = ctx.Process(
            target=lock_holder_process,
            args=(
                str(self.uploads),
                str(self.sessions),
                str(self.manifests),
                "dataset-process-lock",
                ready,
                release,
                results,
            ),
        )
        holder.start()
        self.assertTrue(ready.wait(10))
        self.assertEqual(results.get(timeout=10), ("holder_acquired", True))
        waiter = ctx.Process(
            target=lock_attempt_process,
            args=(
                str(self.uploads),
                str(self.sessions),
                str(self.manifests),
                "dataset-process-lock",
                results,
                waiter_started,
            ),
        )
        waiter.start()
        self.assertTrue(waiter_started.wait(10))
        time.sleep(0.3)
        self.assertTrue(results.empty())
        release.set()
        holder.join(10)
        waiter.join(10)
        self.assertEqual(holder.exitcode, 0)
        self.assertEqual(waiter.exitcode, 0)
        acquired = results.get(timeout=10)
        self.assertEqual(acquired[0], "attempt_acquired")
        self.assertGreaterEqual(acquired[1], 0.25)

        crash_results = ctx.Queue()
        crash_ready = ctx.Event()
        crashing = ctx.Process(
            target=crashing_lock_process,
            args=(
                str(self.uploads),
                str(self.sessions),
                str(self.manifests),
                "dataset-process-crash",
                crash_ready,
            ),
        )
        crashing.start()
        self.assertTrue(crash_ready.wait(10))
        crashing.join(10)
        self.assertEqual(crashing.exitcode, 7)
        after_crash = ctx.Process(
            target=lock_attempt_process,
            args=(
                str(self.uploads),
                str(self.sessions),
                str(self.manifests),
                "dataset-process-crash",
                crash_results,
            ),
        )
        after_crash.start()
        after_crash.join(10)
        self.assertEqual(after_crash.exitcode, 0)
        self.assertEqual(crash_results.get(timeout=10)[0], "attempt_acquired")

    def test_real_process_source_aware_acceptance_has_one_winner(self) -> None:
        dataset_id, _, candidate = self.upload_fixture()
        request = self.authority_request(dataset_id, candidate)
        manifest = json.loads(next(self.manifests.glob("*.json")).read_text(encoding="utf-8"))
        workspace_id = manifest["workspace_id"]
        ctx = multiprocessing.get_context("spawn")
        results = ctx.Queue()
        processes = [
            ctx.Process(
                target=source_aware_review_process,
                args=(
                    str(self.uploads),
                    str(self.sessions),
                    str(self.manifests),
                    workspace_id,
                    dataset_id,
                    request,
                    results,
                ),
            )
            for _ in range(2)
        ]
        for process in processes:
            process.start()
        for process in processes:
            process.join(20)
            self.assertEqual(process.exitcode, 0)
        outcomes = [results.get(timeout=10) for _ in processes]
        statuses = sorted(outcome[0] for outcome in outcomes)
        self.assertEqual(statuses, [200, 409], outcomes)

        persisted = json.loads(next(self.manifests.glob("*.json")).read_text(encoding="utf-8"))
        workbook_metadata = persisted["workbook_metadata"]
        ledger = workbook_metadata["relationship_source_validation_ledger"]
        history = workbook_metadata["relationship_acceptance_history"]
        self.assertEqual(len(ledger["records"]), 1)
        self.assertEqual(len(history["records"]), 1)
        relationship_id = candidate["relationship_id"]
        self.assertEqual(
            ledger["current_validation_by_relationship_id"][relationship_id],
            ledger["records"][0]["validation"]["assessmentId"],
        )
        self.assertEqual(
            history["current_acceptance_by_relationship_id"][relationship_id],
            history["records"][0]["acceptance_record_id"],
        )
        reloaded = main.read_workspace_manifest(workspace_id, mark_opened=False)
        self.assertEqual(
            reloaded["workbook_metadata"]["relationship_source_validation_ledger"]["readiness"]["ready"],
            True,
        )
        stale = self.post_review(dataset_id, request)
        self.assertEqual(stale.status_code, 409)

    def test_in_process_lock_registry_does_not_evict_active_lock(self) -> None:
        acquired_entries: list[int] = []

        def wait_for_active() -> None:
            with main.relationship_review_lock("active-dataset"):
                acquired_entries.append(id(main.relationship_review_locks["active-dataset"]))

        with ThreadPoolExecutor(max_workers=1) as executor:
            with main.relationship_review_lock("active-dataset"):
                active_entry = main.relationship_review_locks["active-dataset"]
                future = executor.submit(wait_for_active)
                time.sleep(0.1)
                for index in range(main.MAX_RELATIONSHIP_REVIEW_LOCKS + 25):
                    with main.relationship_review_lock(f"idle-{index}"):
                        pass
                self.assertIs(main.relationship_review_locks["active-dataset"], active_entry)
            future.result(timeout=10)
        self.assertEqual(acquired_entries, [id(active_entry)])
        self.assertLessEqual(len(main.relationship_review_locks), main.MAX_RELATIONSHIP_REVIEW_LOCKS + 1)

    def test_deterministic_sampling_is_order_restart_and_null_stable(self) -> None:
        rows_a = [("3",), (None,), ("1",), ("2",), ("",), ("2",)]
        rows_b = list(reversed(rows_a))
        with duckdb.connect(":memory:") as first, duckdb.connect(":memory:") as second:
            for connection, rows in ((first, rows_a), (second, rows_b)):
                connection.execute('CREATE TABLE sample ("id" VARCHAR)')
                connection.executemany('INSERT INTO sample VALUES (?)', rows)
            self.assertEqual(
                deterministic_values_for_column(first, "sample", "id"),
                deterministic_values_for_column(second, "sample", "id"),
            )

        with duckdb.connect(":memory:") as first, duckdb.connect(":memory:") as second:
            for connection, values in (
                (first, range(main.MAX_QUERY_LIMIT + 20)),
                (second, reversed(range(main.MAX_QUERY_LIMIT + 20))),
            ):
                connection.execute('CREATE TABLE source ("id" INTEGER)')
                connection.execute('CREATE TABLE target ("id" INTEGER)')
                connection.executemany('INSERT INTO source VALUES (?)', [(value,) for value in values])
                connection.executemany('INSERT INTO target VALUES (?)', [(value,) for value in range(main.MAX_QUERY_LIMIT + 20)])
            source_column = {"name": "id", "type": "INTEGER", "inferred_type": "numeric", "unique_count": main.MAX_QUERY_LIMIT + 20}
            worksheet = {"row_count": main.MAX_QUERY_LIMIT + 20}
            candidate = {
                "source_table": "source",
                "source_column": "id",
                "target_table": "target",
                "target_column": "id",
                "relationship_type": "one_to_one_candidate",
            }
            first_evidence = create_relationship_evidence_fingerprint(
                connection=first,
                candidate=candidate,
                source_column=source_column,
                target_column=source_column,
                source_worksheet=worksheet,
                target_worksheet=worksheet,
            )
            second_evidence = create_relationship_evidence_fingerprint(
                connection=second,
                candidate=candidate,
                source_column=source_column,
                target_column=source_column,
                source_worksheet=worksheet,
                target_worksheet=worksheet,
            )
            self.assertEqual(first_evidence, second_evidence)
            self.assertEqual(
                first_evidence,
                create_relationship_evidence_fingerprint(
                    connection=first,
                    candidate=candidate,
                    source_column=source_column,
                    target_column=source_column,
                    source_worksheet=worksheet,
                    target_worksheet=worksheet,
                ),
            )

    def test_changed_sampled_evidence_changes_identity_and_invalid_numeric_fails(self) -> None:
        with duckdb.connect(":memory:") as connection:
            connection.execute('CREATE TABLE source ("id" INTEGER)')
            connection.execute('CREATE TABLE target_a ("id" INTEGER)')
            connection.execute('CREATE TABLE target_b ("id" INTEGER)')
            connection.executemany('INSERT INTO source VALUES (?)', [(1,), (2,), (3,)])
            connection.executemany('INSERT INTO target_a VALUES (?)', [(1,), (2,), (3,)])
            connection.executemany('INSERT INTO target_b VALUES (?)', [(1,), (4,), (5,)])
            column = {"name": "id", "type": "INTEGER", "inferred_type": "numeric", "unique_count": 3}
            worksheet = {"row_count": 3}
            first = create_relationship_evidence_fingerprint(
                connection=connection,
                candidate={
                    "source_table": "source",
                    "source_column": "id",
                    "target_table": "target_a",
                    "target_column": "id",
                    "relationship_type": "one_to_one_candidate",
                },
                source_column=column,
                target_column=column,
                source_worksheet=worksheet,
                target_worksheet=worksheet,
            )
            second = create_relationship_evidence_fingerprint(
                connection=connection,
                candidate={
                    "source_table": "source",
                    "source_column": "id",
                    "target_table": "target_b",
                    "target_column": "id",
                    "relationship_type": "one_to_one_candidate",
                },
                source_column=column,
                target_column=column,
                source_worksheet=worksheet,
                target_worksheet=worksheet,
            )
            self.assertNotEqual(first["fingerprint"], second["fingerprint"])
            with self.assertRaises(Exception):
                create_relationship_evidence_fingerprint(
                    connection=connection,
                    candidate={
                        "source_table": "source",
                        "source_column": "id",
                        "target_table": "target_a",
                        "target_column": "id",
                        "relationship_type": "one_to_one_candidate",
                    },
                    source_column={**column, "unique_count": float("nan")},
                    target_column=column,
                    source_worksheet=worksheet,
                    target_worksheet=worksheet,
                )


if __name__ == "__main__":
    unittest.main()
