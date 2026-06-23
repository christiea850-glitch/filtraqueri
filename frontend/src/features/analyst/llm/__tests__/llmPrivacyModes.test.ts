/**
 * T-24B - Privacy mode foundation type fixtures.
 *
 * Pure fixture runner only. This does not build provider payloads, generate SQL,
 * insert SQL into Monaco, execute queries, call providers, call backend APIs,
 * persist storage, synthesize data, tokenize values, or render UI.
 */

import {
  AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES,
  AI_PRIVACY_RAW_DATA_PROHIBITED_CATEGORIES,
  AI_PRIVACY_TOKENIZED_PRIVATE_CATEGORIES,
  assertNoExecutionInvariants,
  createDefaultAIPrivacyDecision,
  createRefusedAIPrivacyDecision,
  isCategoryAllowedForMetadataOnly,
  isRawDataCategory,
  requiresPrivacyConsent,
  type AIPrivacyAuditSummary,
  type ShadowPayloadManifest,
} from "../llmPrivacyModes";

type PrivacyModeFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type PrivacyModeFixtureReport = {
  results: PrivacyModeFixtureResult[];
  passed: PrivacyModeFixtureResult[];
  failed: PrivacyModeFixtureResult[];
};

const fixture = (
  name: string,
  run: () => string[],
): { name: string; run: () => string[] } => ({ name, run });

const metadataCategories = new Set(AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES);

const fixtures = [
  fixture("default privacy decision is refused and no-LLM", () => {
    const decision = createDefaultAIPrivacyDecision();
    return [
      ...(decision.status === "refused" ? [] : ["Expected default decision to be refused."]),
      ...(decision.privacyMode === "no_llm" ? [] : ["Expected no-LLM default privacy mode."]),
      ...(decision.allowedCategories.length === 0
        ? []
        : ["Expected no categories allowed by default no-LLM mode."]),
    ];
  }),
  fixture("metadata-only mode allows only metadata categories", () => {
    const decision = createRefusedAIPrivacyDecision(
      "Metadata-only audit fixture.",
      "metadata_only_llm",
    );
    return [
      ...(decision.allowedCategories.length === AI_PRIVACY_METADATA_ONLY_ALLOWED_CATEGORIES.length
        ? []
        : ["Expected metadata-only category count."]),
      ...(decision.allowedCategories.every((category) => metadataCategories.has(category))
        ? []
        : ["Expected only metadata categories to be allowed."]),
      ...(!decision.allowedCategories.some(isRawDataCategory)
        ? []
        : ["Expected metadata-only mode to exclude raw-data categories."]),
    ];
  }),
  fixture("raw rows are blocked", () =>
    isRawDataCategory("raw_rows") &&
    AI_PRIVACY_RAW_DATA_PROHIBITED_CATEGORIES.includes("raw_rows")
      ? []
      : ["Expected raw rows to be blocked."],
  ),
  fixture("tokenization vault category is blocked", () =>
    isRawDataCategory("tokenization_vault") &&
    AI_PRIVACY_RAW_DATA_PROHIBITED_CATEGORIES.includes("tokenization_vault")
      ? []
      : ["Expected tokenization vault to be blocked from provider payloads."],
  ),
  fixture("level 2 requires consent", () =>
    requiresPrivacyConsent("masked_synthetic_sample_llm")
      ? []
      : ["Expected masked/synthetic sample mode to require consent."],
  ),
  fixture("level 3 is private deferred caution", () => {
    const decision = createRefusedAIPrivacyDecision(
      "Tokenized private mode deferred.",
      "reversible_tokenized_private",
    );
    return [
      ...(requiresPrivacyConsent("reversible_tokenized_private")
        ? []
        : ["Expected tokenized private mode to require consent."]),
      ...(decision.auditSummary.providerCategory === "private_model"
        ? []
        : ["Expected tokenized private mode to be private-model scoped."]),
      ...(decision.refusalReasons.some((reason) => /deferred|private\/self-hosted/i.test(reason))
        ? []
        : ["Expected Level 3 caution/defer reason."]),
      ...(AI_PRIVACY_TOKENIZED_PRIVATE_CATEGORIES.includes("tokenized_values")
        ? []
        : ["Expected tokenized values to be isolated to private-tokenized category set."]),
    ];
  }),
  fixture("level 4 raw-data mode is prohibited", () => {
    const decision = createRefusedAIPrivacyDecision(
      "Raw-data mode prohibited.",
      "raw_data_prohibited",
    );
    return [
      ...(decision.privacyLevel === "raw_data_prohibited"
        ? []
        : ["Expected raw-data-prohibited privacy level."]),
      ...(decision.status === "refused" ? [] : ["Expected raw-data mode to be refused."]),
      ...(decision.refusalReasons.some((reason) => /prohibited/i.test(reason))
        ? []
        : ["Expected raw-data prohibition reason."]),
    ];
  }),
  fixture("no-execution invariants are always true", () => {
    const decisions = [
      createDefaultAIPrivacyDecision(),
      createRefusedAIPrivacyDecision("Metadata fixture.", "metadata_only_llm"),
      createRefusedAIPrivacyDecision("Synthetic fixture.", "masked_synthetic_sample_llm"),
      createRefusedAIPrivacyDecision("Tokenized fixture.", "reversible_tokenized_private"),
      createRefusedAIPrivacyDecision("Raw fixture.", "raw_data_prohibited"),
    ];
    return decisions.every(assertNoExecutionInvariants)
      ? []
      : ["Expected every decision to preserve no-execution invariants."];
  }),
  fixture("privacy audit summary records raw rows not included", () => {
    const summary: AIPrivacyAuditSummary = createRefusedAIPrivacyDecision(
      "Audit summary fixture.",
      "metadata_only_llm",
    ).auditSummary;
    return [
      ...(!summary.rawRowsIncluded ? [] : ["Expected rawRowsIncluded to be false."]),
      ...(summary.rawRowsBlocked ? [] : ["Expected raw rows to be blocked."]),
      ...(!summary.sqlExecutionAllowed ? [] : ["Expected SQL execution to be disallowed."]),
      ...(summary.deterministicValidationRequired
        ? []
        : ["Expected deterministic validation to be required."]),
    ];
  }),
  fixture("shadow payload manifest type keeps raw values excluded", () => {
    const manifest: ShadowPayloadManifest = {
      payloadFingerprint: null,
      privacyMode: "metadata_only_llm",
      includedCategories: ["dataset_metadata", "worksheet_metadata"],
      excludedCategories: ["raw_rows", "sample_values", "tokenization_vault"],
      suppressionPolicySummary: "No shadow rows in metadata-only mode.",
      rareValueThreshold: 5,
      schemaAliasingUsed: false,
      tokenVaultUsed: false,
      rawValuesIncluded: false,
    };
    return [
      ...(!manifest.rawValuesIncluded ? [] : ["Expected raw values to be excluded."]),
      ...(manifest.rareValueThreshold >= 5
        ? []
        : ["Expected rare-value threshold to preserve k>=5 principle."]),
      ...(!manifest.tokenVaultUsed ? [] : ["Expected no token vault in metadata-only manifest."]),
    ];
  }),
  fixture("helpers do not expose SQL, provider, backend, storage, or run capability", () => {
    const serialized = JSON.stringify({
      defaultDecision: createDefaultAIPrivacyDecision(),
      metadataDecision: createRefusedAIPrivacyDecision("Metadata fixture.", "metadata_only_llm"),
      isRaw: isRawDataCategory("raw_rows"),
      isMetadataAllowed: isCategoryAllowedForMetadataOnly("column_metadata"),
      consent: requiresPrivacyConsent("masked_synthetic_sample_llm"),
    });
    const forbidden = [
      "SELECT ",
      "INSERT ",
      "UPDATE ",
      "DELETE ",
      "fetch(",
      "XMLHttpRequest",
      "localStorage",
      "sessionStorage",
      "providerCallMade\":true",
      "runQuery",
      "insertSql",
    ];
    return forbidden.some((token) => serialized.includes(token))
      ? ["Expected privacy mode helpers to remain metadata-only and side-effect free."]
      : [];
  }),
];

export function runLlmPrivacyModeFixtures(): PrivacyModeFixtureReport {
  const results = fixtures.map((item) => {
    const failureReasons = item.run();
    return {
      name: item.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

