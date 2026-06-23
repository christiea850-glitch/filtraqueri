/**
 * T-24H-1 - AI consent disclosure fixtures.
 *
 * Pure fixture runner only. This does not render UI, request/store consent,
 * call providers, call backend APIs, build provider payloads, synthesize data,
 * tokenize values, generate SQL, insert SQL, or run queries.
 */

import {
  AI_CONSENT_DISCLOSURE_LEVEL_COPY,
  AI_MANUAL_CONTROL_DISCLOSURE,
  createAIConsentPayloadDisclosureSummary,
  createAIModeChipViewModel,
  getAIConsentDisclosureForPrivacyMode,
  isAIConsentBlocked,
  isAIConsentGranted,
  requiresAIConsentDisclosure,
} from "../llmConsentDisclosure";
import type { AIPrivacyAuditSummary } from "../llmPrivacyModes";

type ConsentDisclosureFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ConsentDisclosureFixtureReport = {
  results: ConsentDisclosureFixtureResult[];
  passed: ConsentDisclosureFixtureResult[];
  failed: ConsentDisclosureFixtureResult[];
};

const fixture = (name: string, run: () => string[]) => ({ name, run });

const textForLevel = (level: 0 | 1 | 2 | 3 | 4): string => {
  const copy = AI_CONSENT_DISCLOSURE_LEVEL_COPY.find((item) => item.level === level);
  return JSON.stringify(copy).toLowerCase();
};

const fixtures = [
  fixture("level 0 says no LLM/provider payload", () => {
    const text = textForLevel(0);
    return text.includes("no llm") && text.includes("no provider payload")
      ? []
      : ["Expected Level 0 disclosure to say no LLM and no provider payload."];
  }),
  fixture("level 1 says metadata-only and no raw rows/values", () => {
    const text = textForLevel(1);
    return text.includes("metadata-only") && text.includes("raw rows") && text.includes("sample values") && text.includes("top values")
      ? []
      : ["Expected Level 1 disclosure to say metadata-only and block raw rows/values."];
  }),
  fixture("level 2 says privacy-preserved shadow data and consent required", () => {
    const copy = getAIConsentDisclosureForPrivacyMode("masked_synthetic_sample_llm");
    const text = JSON.stringify(copy).toLowerCase();
    return text.includes("privacy-preserved shadow data") && copy.consentRequired && requiresAIConsentDisclosure("masked_synthetic_sample_llm")
      ? []
      : ["Expected Level 2 disclosure to say privacy-preserved shadow data and require consent."];
  }),
  fixture("level 3 says private/deferred and token vault not sent", () => {
    const text = textForLevel(3);
    return text.includes("private") && text.includes("deferred") && text.includes("token vaults out of provider payloads")
      ? []
      : ["Expected Level 3 disclosure to say private/deferred and token vault not sent."];
  }),
  fixture("level 4 says raw-data mode prohibited", () =>
    textForLevel(4).includes("raw-data llm mode is prohibited")
      ? []
      : ["Expected Level 4 disclosure to prohibit raw-data mode."],
  ),
  fixture("mode chip can represent closed/disabled provider boundary", () => {
    const chip = createAIModeChipViewModel("metadata_only_llm", "closed");
    return chip.boundaryStatus === "closed" && chip.disabled && chip.riskCodes.includes("provider_boundary_closed")
      ? []
      : ["Expected mode chip to represent a closed disabled provider boundary."];
  }),
  fixture("manual controls require manual Insert SQL and Run Query", () =>
    AI_MANUAL_CONTROL_DISCLOSURE.insertSqlRequiresUserAction &&
    AI_MANUAL_CONTROL_DISCLOSURE.runQueryRequiresUserAction &&
    AI_MANUAL_CONTROL_DISCLOSURE.llmCannotInsertSql &&
    AI_MANUAL_CONTROL_DISCLOSURE.llmCannotRunQuery
      ? []
      : ["Expected manual Insert SQL and manual Run Query controls."],
  ),
  fixture("consent granted helper only returns true for granted", () => {
    const statuses = ["not_required", "required", "granted", "revoked", "expired", "blocked_by_policy"] as const;
    return statuses.filter(isAIConsentGranted).join(",") === "granted"
      ? []
      : ["Expected only granted status to count as granted."];
  }),
  fixture("blocked helper flags expired/revoked/policy-blocked", () => {
    const blocked = ["revoked", "expired", "blocked_by_policy"] as const;
    const open = ["not_required", "required", "granted"] as const;
    return blocked.every(isAIConsentBlocked) && open.every((status) => !isAIConsentBlocked(status))
      ? []
      : ["Expected revoked, expired, and policy-blocked statuses to be blocked."];
  }),
  fixture("helpers stay side-effect free and do not expose unsafe behavior", () => {
    const audit: AIPrivacyAuditSummary = {
      privacyLevel: "metadata_only",
      privacyMode: "metadata_only_llm",
      includedCategories: ["dataset_metadata"],
      excludedCategories: ["raw_rows", "sample_values", "top_values", "sql_drafts", "query_results", "provider_response", "tokenization_vault"],
      providerCategory: "external_provider",
      consentRequired: false,
      consentGranted: false,
      rawRowsIncluded: false,
      rawRowsBlocked: true,
      sqlExecutionAllowed: false,
      deterministicValidationRequired: true,
    };
    const serialized = JSON.stringify({
      copy: getAIConsentDisclosureForPrivacyMode("metadata_only_llm"),
      chip: createAIModeChipViewModel("metadata_only_llm", "closed"),
      payload: createAIConsentPayloadDisclosureSummary(audit),
    });
    const forbidden = ["<div", "React.createElement", "fetch(", "XMLHttpRequest", "localStorage", "sessionStorage", "SELECT ", "INSERT ", "runQueryAllowed\":true", "providerCallAllowed\":true"];
    return forbidden.some((token) => serialized.includes(token))
      ? ["Expected helpers not to render UI, call providers/backend/storage, generate SQL, insert SQL, or run queries."]
      : [];
  }),
];

export function runLlmConsentDisclosureFixtures(): ConsentDisclosureFixtureReport {
  const results = fixtures.map((item) => {
    const failureReasons = item.run();
    return { name: item.name, ok: failureReasons.length === 0, failureReasons };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
