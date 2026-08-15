"""Pure A1-compatible worksheet-source canonicalization helpers.

These helpers intentionally mirror the closed frontend A1 contract in
``frontend/src/features/workbook/worksheetSourceRevision.ts``. The FNV-1a
fingerprint is deterministic identity only; it is not collision-resistant and
must not be used as cryptographic authorization.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping
from decimal import Decimal
from typing import Any


class WorksheetSourceContractError(ValueError):
    """Raised when a worksheet-source contract value cannot be represented."""


class UnsupportedWorksheetSourceContractValueError(WorksheetSourceContractError):
    """Raised for values outside the A1-compatible canonical value domain."""


class UnsupportedWorksheetSourceContractVersionError(WorksheetSourceContractError):
    """Raised for unsupported versioned worksheet-source contract payloads."""


FNV_1A_32_OFFSET_BASIS = 2166136261
FNV_1A_32_PRIME = 16777619
FNV_1A_32_MASK = 0xFFFFFFFF
JS_MAX_SAFE_INTEGER = 9007199254740991
JS_MIN_SAFE_INTEGER = -9007199254740991


def _json_stringify_string(value: str) -> str:
    if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
        raise UnsupportedWorksheetSourceContractValueError(
            "Strings with unpaired surrogate code points are unsupported."
        )
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _normalize_exponent(value: str) -> str:
    mantissa, exponent = value.lower().split("e", 1)
    sign = ""
    if exponent.startswith(("+", "-")):
        sign = exponent[0]
        exponent = exponent[1:]
    exponent = exponent.lstrip("0") or "0"
    if sign == "-":
        return f"{mantissa}e-{exponent}"
    if sign == "+":
        return f"{mantissa}e+{exponent}"
    return f"{mantissa}e{exponent}"


def _json_stringify_number(value: int | float) -> str:
    if isinstance(value, bool):
        raise UnsupportedWorksheetSourceContractValueError("Boolean values are not numbers.")

    if isinstance(value, int):
        if value < JS_MIN_SAFE_INTEGER or value > JS_MAX_SAFE_INTEGER:
            raise UnsupportedWorksheetSourceContractValueError(
                "Integers outside the JavaScript safe-integer range are unsupported."
            )
        return str(value)

    if not math.isfinite(value):
        raise UnsupportedWorksheetSourceContractValueError("Non-finite numbers are unsupported.")

    if value == 0:
        return "0"

    absolute_value = abs(value)
    if value.is_integer() and absolute_value < 1e21:
        return str(int(value))

    if absolute_value >= 1e21 or absolute_value < 1e-6:
        return _normalize_exponent(repr(value))

    if "e" in repr(value).lower():
        decimal_value = Decimal(str(value))
        return format(decimal_value, "f").rstrip("0").rstrip(".")

    return repr(value)


def _js_key_sort_value(value: str) -> tuple[int, ...]:
    encoded = value.encode("utf-16-le")
    return tuple(encoded[index] | (encoded[index + 1] << 8) for index in range(0, len(encoded), 2))


def canonicalize_for_worksheet_source(value: Any) -> str:
    """Return the canonical payload string used by the A1 worksheet-source helper."""

    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        return _json_stringify_string(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return _json_stringify_number(value)
    if isinstance(value, float):
        return _json_stringify_number(value)
    if isinstance(value, list):
        return "[" + ",".join(canonicalize_for_worksheet_source(item) for item in value) + "]"
    if isinstance(value, Mapping):
        for key in value.keys():
            if not isinstance(key, str):
                raise UnsupportedWorksheetSourceContractValueError(
                    "Worksheet-source contract object keys must be strings."
                )
        return (
            "{"
            + ",".join(
                f"{_json_stringify_string(key)}:{canonicalize_for_worksheet_source(value[key])}"
                for key in sorted(value.keys(), key=_js_key_sort_value)
            )
            + "}"
        )

    raise UnsupportedWorksheetSourceContractValueError(
        f"Unsupported worksheet-source contract value type: {type(value).__name__}."
    )


def iter_utf16_code_units(value: str) -> tuple[int, ...]:
    """Return JavaScript ``charCodeAt`` units for a Python string."""

    encoded = value.encode("utf-16-le")
    return tuple(encoded[index] | (encoded[index + 1] << 8) for index in range(0, len(encoded), 2))


def a1_fnv1a_32(value: str) -> int:
    """Return the A1 FNV-1a 32-bit hash over JavaScript UTF-16 code units."""

    hash_value = FNV_1A_32_OFFSET_BASIS
    for code_unit in iter_utf16_code_units(value):
        hash_value ^= code_unit
        hash_value = (hash_value * FNV_1A_32_PRIME) & FNV_1A_32_MASK
    return hash_value


def create_deterministic_worksheet_source_fingerprint(prefix: str, value: Any) -> str:
    """Return the A1 ``prefix:length:hash`` deterministic identity string."""

    if not isinstance(prefix, str) or not prefix:
        raise UnsupportedWorksheetSourceContractValueError("Fingerprint prefix is required.")
    canonical = canonicalize_for_worksheet_source(value)
    js_length = len(iter_utf16_code_units(canonical))
    return f"{prefix}:{js_length}:{a1_fnv1a_32(canonical):08x}"


def assert_supported_contract_version(actual: str, expected: str, label: str) -> None:
    if actual != expected:
        raise UnsupportedWorksheetSourceContractVersionError(f"{label} version is unsupported.")
