/**
 * T-24C - Shadow data sensitive-column policy fixtures.
 *
 * Pure fixture runner only. This does not build provider payloads, generate SQL,
 * insert SQL into Monaco, execute queries, call providers, call backend APIs,
 * persist storage, synthesize data, tokenize values, or render UI.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import { classifySensitiveColumn } from "../llmSensitiveColumnClassifier";
import {
  getDefaultRareValueThresholdForPrivacyMode,
  isRawValueProhibitedForSensitivity,
  isTokenizationAllowedForPrivacyMode,
  requiresRareValueSuppression,
  resolveShadowValuePolicyForSensitivity,
} from "../llmShadowDataPolicy";
import type { AIPrivacyMode } from "../llmPrivacyModes";

type ShadowDataPolicyFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type ShadowDataPolicyFixtureReport = {
  results: ShadowDataPolicyFixtureResult[];
  passed: ShadowDataPolicyFixtureResult[];
  failed: ShadowDataPolicyFixtureResult[];
};

const column = (
  name: string,
  inferredType: SchemaColumn["inferred_type"] = "text",
  overrides: Partial<SchemaColumn> = {},
): Pick<
  SchemaColumn,
  "name" | "inferred_type" | "unique_count" | "numeric_stats" | "date_range" | "text_length_stats"
> => ({
  name,
  inferred_type: inferredType,
  unique_count: 4,
  numeric_stats: undefined,
  date_range: undefined,
  text_length_stats: undefined,
  ...overrides,
});

const classificationFor = (
  name: string,
  inferredType: SchemaColumn["inferred_type"] = "text",
  worksheetName = "Property workbook",
) =>
  classifySensitiveColumn({
    column: column(name, inferredType),
    worksheetName,
    trustedTableName: worksheetName.toLowerCase().replace(/\s+/g, "_"),
  });

const decisionFor = (
  name: string,
  privacyMode: AIPrivacyMode = "masked_synthetic_sample_llm",
  inferredType: SchemaColumn["inferred_type"] = "text",
  worksheetName = "Property workbook",
) =>
  resolveShadowValuePolicyForSensitivity({
    columnName: name,
    classification: classificationFor(name, inferredType, worksheetName),
    privacyMode,
    uniqueCount: 4,
    rowCount: 4,
  });

const fixtures: Array<{
  name: string;
  run: () => string[];
}> = [
  {
    name: "restricted columns resolve to prohibit and block raw values",
    run: () => {
      const classification = classificationFor("access_code");
      const decision = resolveShadowValuePolicyForSensitivity({
        columnName: "access_code",
        classification,
        privacyMode: "masked_synthetic_sample_llm",
        uniqueCount: 4,
        rowCount: 4,
      });
      return [
        ...(classification.level === "restricted" ? [] : ["Expected restricted level."]),
        ...(decision.recommendedShadowValuePolicy === "prohibit"
          ? []
          : ["Expected restricted column to be prohibited."]),
        ...(!decision.rawValueAllowed ? [] : ["Expected raw value to be blocked."]),
        ...(requiresRareValueSuppression(decision)
          ? []
          : ["Expected restricted column to require suppression."]),
      ];
    },
  },
  {
    name: "direct personal identifiers do not allow raw values",
    run: () => {
      const decision = decisionFor("tenant_name");
      return [
        ...(decision.sensitivityCategory === "direct_personal_identifier"
          ? []
          : ["Expected direct personal identifier category."]),
        ...(!decision.rawValueAllowed ? [] : ["Expected raw value to be blocked."]),
        ...(decision.recommendedShadowValuePolicy === "mask"
          ? []
          : ["Expected direct identifier to mask in shadow sample mode."]),
      ];
    },
  },
  {
    name: "health sensitive columns do not allow raw values",
    run: () => {
      const decision = decisionFor(
        "diagnosis_code",
        "masked_synthetic_sample_llm",
        "text",
        "Patient health workbook",
      );
      return [
        ...(decision.sensitivityCategory === "health_or_sensitive"
          ? []
          : ["Expected health sensitivity category."]),
        ...(!decision.rawValueAllowed ? [] : ["Expected raw health value to be blocked."]),
        ...(decision.recommendedShadowValuePolicy === "suppress"
          ? []
          : ["Expected health sensitive column to suppress."]),
      ];
    },
  },
  {
    name: "free-text sensitive columns require suppression or review",
    run: () => {
      const decision = decisionFor("maintenance_notes");
      return [
        ...(decision.sensitivityCategory === "free_text_sensitive"
          ? []
          : ["Expected free text sensitive category."]),
        ...(decision.recommendedShadowValuePolicy === "suppress"
          ? []
          : ["Expected free text to suppress."]),
        ...(requiresRareValueSuppression(decision)
          ? []
          : ["Expected free text to require suppression or review."]),
      ];
    },
  },
  {
    name: "safe business metrics are metadata safe but do not allow raw provider samples",
    run: () => {
      const decision = decisionFor(
        "total_revenue",
        "masked_synthetic_sample_llm",
        "numeric",
        "Revenue summary",
      );
      const metadataDecision = decisionFor(
        "total_revenue",
        "metadata_only_llm",
        "numeric",
        "Revenue summary",
      );
      return [
        ...(decision.sensitivityCategory === "safe_business_metric"
          ? []
          : ["Expected safe business metric category."]),
        ...(decision.metadataAllowed ? [] : ["Expected metadata to be allowed."]),
        ...(!decision.rawValueAllowed ? [] : ["Expected raw provider values to remain blocked."]),
        ...(!metadataDecision.sampleAllowed
          ? []
          : ["Expected metadata-only mode to avoid provider samples."]),
      ];
    },
  },
  {
    name: "metadata-only privacy mode does not allow tokenization",
    run: () => {
      const decision = decisionFor("tenant_id", "metadata_only_llm", "categorical");
      return [
        ...(!isTokenizationAllowedForPrivacyMode("metadata_only_llm")
          ? []
          : ["Expected metadata-only mode to disallow tokenization."]),
        ...(!decision.tokenizationAllowed
          ? []
          : ["Expected metadata-only decision to disallow tokenization."]),
      ];
    },
  },
  {
    name: "tokenization is allowed only in private tokenized mode and marked caution defer",
    run: () => {
      const metadataDecision = decisionFor("tenant_id", "metadata_only_llm", "categorical");
      const privateDecision = decisionFor(
        "tenant_id",
        "reversible_tokenized_private",
        "categorical",
      );
      return [
        ...(!metadataDecision.tokenizationAllowed
          ? []
          : ["Expected non-private mode to block tokenization."]),
        ...(privateDecision.tokenizationAllowed
          ? []
          : ["Expected private tokenized mode to allow tokenization for identifiers."]),
        ...(privateDecision.tokenizationCaution
          ? []
          : ["Expected tokenization caution flag."]),
        ...(privateDecision.warnings.some((warning) => /caution|defer/i.test(warning))
          ? []
          : ["Expected tokenization warning to mention caution/defer."]),
      ];
    },
  },
  {
    name: "rare-value threshold defaults to at least five",
    run: () => {
      const modes: AIPrivacyMode[] = [
        "no_llm",
        "metadata_only_llm",
        "masked_synthetic_sample_llm",
        "reversible_tokenized_private",
        "raw_data_prohibited",
      ];
      return modes.every((mode) => getDefaultRareValueThresholdForPrivacyMode(mode) >= 5)
        ? []
        : ["Expected every privacy mode to default to k>=5 rare value threshold."];
    },
  },
  {
    name: "rare-value suppression is required for sample and shadow modes",
    run: () => {
      const sensitiveDecision = decisionFor("customer_email", "masked_synthetic_sample_llm");
      const privateDecision = decisionFor(
        "tenant_id",
        "reversible_tokenized_private",
        "categorical",
      );
      return [
        ...(requiresRareValueSuppression(sensitiveDecision)
          ? []
          : ["Expected sensitive shadow sample mode to require rare-value suppression."]),
        ...(requiresRareValueSuppression(privateDecision)
          ? []
          : ["Expected tokenized private mode to require rare-value suppression."]),
      ];
    },
  },
  {
    name: "raw value helper blocks sensitive and restricted classifications",
    run: () => {
      const restricted = classificationFor("api_key");
      const sensitive = classificationFor("phone_number");
      const safe = classificationFor("total_count", "numeric");
      return [
        ...(isRawValueProhibitedForSensitivity(restricted)
          ? []
          : ["Expected restricted raw values to be prohibited."]),
        ...(isRawValueProhibitedForSensitivity(sensitive)
          ? []
          : ["Expected sensitive raw values to be prohibited."]),
        ...(isRawValueProhibitedForSensitivity(safe)
          ? []
          : ["Expected classifier-level never-send raw value flag to block safe raw values too."]),
      ];
    },
  },
  {
    name: "helpers do not expose SQL, provider, backend, storage, or run capability",
    run: () => {
      const decision = decisionFor("tenant_name");
      const serialized = JSON.stringify({
        decision,
        threshold: getDefaultRareValueThresholdForPrivacyMode("masked_synthetic_sample_llm"),
        tokenizationAllowed: isTokenizationAllowedForPrivacyMode("metadata_only_llm"),
        rawBlocked: isRawValueProhibitedForSensitivity(classificationFor("access_code")),
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
        ? ["Expected shadow data policy helpers to remain metadata-only and side-effect free."]
        : [];
    },
  },
];

export function runLlmShadowDataPolicyFixtures(): ShadowDataPolicyFixtureReport {
  const results = fixtures.map((fixtureItem) => {
    const failureReasons = fixtureItem.run();
    return {
      name: fixtureItem.name,
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
