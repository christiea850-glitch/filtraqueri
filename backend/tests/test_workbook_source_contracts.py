import copy
import json
import math
import subprocess
import unittest
from pathlib import Path

from backend.app.workbook_source_contracts import (
    JS_MAX_SAFE_INTEGER,
    JS_MIN_SAFE_INTEGER,
    UnsupportedWorksheetSourceContractValueError,
    UnsupportedWorksheetSourceContractVersionError,
    a1_fnv1a_32,
    assert_supported_contract_version,
    canonicalize_for_worksheet_source,
    create_deterministic_worksheet_source_fingerprint,
    iter_utf16_code_units,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
GOLDEN_VECTOR_PATH = REPO_ROOT / "test-fixtures" / "worksheet-source-revision-golden-vectors.v1.json"


def load_vectors() -> list[dict]:
    payload = json.loads(GOLDEN_VECTOR_PATH.read_text(encoding="utf-8"))
    return list(payload["vectors"])


class WorksheetSourceContractParityTests(unittest.TestCase):
    def test_golden_vectors_match_expected_canonical_payloads(self) -> None:
        for vector in load_vectors():
            with self.subTest(vector=vector["name"]):
                self.assertEqual(
                    canonicalize_for_worksheet_source(vector["payload"]),
                    vector["expectedCanonical"],
                )

    def test_golden_vectors_match_expected_fingerprints(self) -> None:
        for vector in load_vectors():
            with self.subTest(vector=vector["name"]):
                self.assertEqual(
                    create_deterministic_worksheet_source_fingerprint(
                        vector["prefix"],
                        vector["payload"],
                    ),
                    vector["expectedFingerprint"],
                )

    def test_reordered_object_keys_are_identical(self) -> None:
        left = {"b": 2, "a": {"d": 4, "c": 3}}
        right = {"a": {"c": 3, "d": 4}, "b": 2}
        self.assertEqual(canonicalize_for_worksheet_source(left), canonicalize_for_worksheet_source(right))
        self.assertEqual(
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", left),
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", right),
        )

    def test_reordered_arrays_are_different(self) -> None:
        left = ["a", "b", "c"]
        right = ["c", "b", "a"]
        self.assertNotEqual(canonicalize_for_worksheet_source(left), canonicalize_for_worksheet_source(right))
        self.assertNotEqual(
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", left),
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", right),
        )

    def test_nested_caller_input_is_not_mutated(self) -> None:
        payload = {"b": [{"y": 2, "x": 1}], "a": True}
        before = copy.deepcopy(payload)
        canonicalize_for_worksheet_source(payload)
        create_deterministic_worksheet_source_fingerprint("canonical-fixture", payload)
        self.assertEqual(payload, before)

    def test_nested_caller_input_order_and_values_are_not_mutated(self) -> None:
        payload = {
            "z": [{"beta": [3, 2, 1], "alpha": {"inner_b": False, "inner_a": None}}],
            "a": ["first", "second"],
        }
        before = copy.deepcopy(payload)
        before_json = json.dumps(before, ensure_ascii=False, separators=(",", ":"))
        canonicalize_for_worksheet_source(payload)
        self.assertEqual(payload, before)
        self.assertEqual(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), before_json)
        create_deterministic_worksheet_source_fingerprint("canonical-fixture", payload)
        self.assertEqual(payload, before)
        self.assertEqual(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), before_json)
        self.assertEqual(list(payload.keys()), ["z", "a"])
        self.assertEqual(payload["z"][0]["beta"], [3, 2, 1])

    def test_repeated_calls_are_byte_identical(self) -> None:
        payload = {"z": [3, 2, 1], "a": {"c": None, "b": False}}
        canonical = canonicalize_for_worksheet_source(payload)
        fingerprint = create_deterministic_worksheet_source_fingerprint("canonical-fixture", payload)
        self.assertEqual(canonicalize_for_worksheet_source(payload), canonical)
        self.assertEqual(
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", payload),
            fingerprint,
        )

    def test_unicode_uses_javascript_utf16_code_units(self) -> None:
        canonical = canonicalize_for_worksheet_source("emoji \U0001f600 value")
        self.assertEqual(canonical, '"emoji \U0001f600 value"')
        self.assertEqual(len(canonical), 15)
        self.assertEqual(len(iter_utf16_code_units(canonical)), 16)
        self.assertEqual(
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", "emoji \U0001f600 value"),
            "canonical-fixture:16:6ca95b07",
        )

    def test_negative_zero_matches_a1_json_stringify_behavior(self) -> None:
        self.assertEqual(canonicalize_for_worksheet_source(-0.0), "0")
        self.assertEqual(
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", -0.0),
            create_deterministic_worksheet_source_fingerprint("canonical-fixture", 0),
        )

    def test_javascript_safe_integer_boundaries(self) -> None:
        accepted = [
            (JS_MAX_SAFE_INTEGER, "9007199254740991"),
            (JS_MIN_SAFE_INTEGER, "-9007199254740991"),
        ]
        for value, expected in accepted:
            with self.subTest(value=value):
                self.assertEqual(canonicalize_for_worksheet_source(value), expected)

        rejected = [
            2**53,
            -(2**53),
            2**53 + 1,
            -(2**53 + 1),
        ]
        for value in rejected:
            with self.subTest(value=value):
                with self.assertRaisesRegex(
                    UnsupportedWorksheetSourceContractValueError,
                    "JavaScript safe-integer range",
                ):
                    canonicalize_for_worksheet_source(value)

    def test_nested_unsafe_integers_fail_closed(self) -> None:
        unsafe = 2**53
        for payload in [[1, unsafe], {"safe": 1, "unsafe": unsafe}]:
            with self.subTest(payload=payload):
                with self.assertRaisesRegex(
                    UnsupportedWorksheetSourceContractValueError,
                    "JavaScript safe-integer range",
                ):
                    canonicalize_for_worksheet_source(payload)
                with self.assertRaisesRegex(
                    UnsupportedWorksheetSourceContractValueError,
                    "JavaScript safe-integer range",
                ):
                    create_deterministic_worksheet_source_fingerprint("canonical-fixture", payload)

    def test_booleans_keep_boolean_precedence_over_integers(self) -> None:
        self.assertEqual(canonicalize_for_worksheet_source(True), "true")
        self.assertEqual(canonicalize_for_worksheet_source(False), "false")
        self.assertEqual(canonicalize_for_worksheet_source({"t": True, "f": False}), '{"f":false,"t":true}')

    def test_unsupported_values_fail_closed(self) -> None:
        unsupported_values = [
            ("tuple", ("a", "b")),
            ("set", {"a", "b"}),
            ("bytes", b"bytes"),
            ("custom-object", object()),
            ("non-string-key", {1: "one"}),
        ]
        for label, value in unsupported_values:
            with self.subTest(value=label):
                with self.assertRaises(UnsupportedWorksheetSourceContractValueError):
                    canonicalize_for_worksheet_source(value)

    def test_non_finite_numbers_fail_closed(self) -> None:
        for value in [math.nan, math.inf, -math.inf]:
            with self.subTest(value=value):
                with self.assertRaises(UnsupportedWorksheetSourceContractValueError):
                    canonicalize_for_worksheet_source(value)

    def test_unsupported_contract_versions_fail_closed(self) -> None:
        with self.assertRaises(UnsupportedWorksheetSourceContractVersionError):
            assert_supported_contract_version(
                "worksheet-source-identity:v999",
                "worksheet-source-identity:v1",
                "Worksheet source identity",
            )

    def test_structural_field_change_changes_fingerprint(self) -> None:
        vector = next(item for item in load_vectors() if item["name"] == "structural-schema-payload-ordered-columns")
        changed = copy.deepcopy(vector["payload"])
        changed["columns"][0]["name"] = "alpha_key"
        self.assertNotEqual(
            create_deterministic_worksheet_source_fingerprint(vector["prefix"], changed),
            vector["expectedFingerprint"],
        )

    def test_evidence_field_change_changes_fingerprint(self) -> None:
        vector = next(item for item in load_vectors() if item["name"] == "relationship-evidence-payload-v1")
        changed = copy.deepcopy(vector["payload"])
        changed["evidence"]["distinctCount"] = 8
        self.assertNotEqual(
            create_deterministic_worksheet_source_fingerprint(vector["prefix"], changed),
            vector["expectedFingerprint"],
        )

    def test_materialization_only_revision_changes_remain_distinguishable(self) -> None:
        first = next(item for item in load_vectors() if item["name"] == "source-revision-materialization-v1")
        second = next(item for item in load_vectors() if item["name"] == "source-revision-materialization-v2")
        self.assertNotEqual(first["expectedFingerprint"], second["expectedFingerprint"])

    def test_fnv_identity_is_not_security_authorization(self) -> None:
        first = create_deterministic_worksheet_source_fingerprint("canonical-fixture", {"a": 1})
        second = create_deterministic_worksheet_source_fingerprint("canonical-fixture", {"a": 1})
        self.assertEqual(first, second)
        self.assertIsInstance(a1_fnv1a_32(canonicalize_for_worksheet_source({"a": 1})), int)

    def test_cross_language_vectors_match_closed_a1_exports(self) -> None:
        node_script = """
import fs from 'node:fs';
import { canonicalizeForWorksheetSource, createDeterministicWorksheetSourceFingerprint } from './frontend/src/features/workbook/worksheetSourceRevision.ts';
const fixture = JSON.parse(fs.readFileSync('./test-fixtures/worksheet-source-revision-golden-vectors.v1.json', 'utf8'));
if (fixture.vectors.length !== 27) {
  throw new Error(`Expected 27 vectors, received ${fixture.vectors.length}.`);
}
const results = fixture.vectors.map((vector) => ({
  name: vector.name,
  canonical: canonicalizeForWorksheetSource(vector.payload),
  fingerprint: createDeterministicWorksheetSourceFingerprint(vector.prefix, vector.payload),
}));
console.log(JSON.stringify(results));
"""
        result = subprocess.run(
            ["node", "--experimental-strip-types", "--input-type=module", "-e", node_script],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
            encoding="utf-8",
            text=True,
        )
        a1_results = {item["name"]: item for item in json.loads(result.stdout)}
        self.assertEqual(len(a1_results), 27)
        for vector in load_vectors():
            with self.subTest(vector=vector["name"]):
                self.assertEqual(a1_results[vector["name"]]["canonical"], vector["expectedCanonical"])
                self.assertEqual(a1_results[vector["name"]]["fingerprint"], vector["expectedFingerprint"])


if __name__ == "__main__":
    unittest.main()
