/**
 * T-13M-10 - Adaptive Proposal LLM consent UI shell fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { SchemaColumn, DatasetMetadata } from "../../../dataset/datasetTypes";
import type { AnalysisScopeSelection } from "../../../workbook";
import { detectBusinessIntent } from "../businessIntentGrounding";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import type { AdaptiveReportProposal } from "../adaptiveReportProposal";
import type { AdaptiveProposalLlmValidationResult } from "../adaptiveProposalLlmContract";
import {
  createAdaptiveProposalLlmConsentShellViewModel,
  type AdaptiveProposalLlmConsentShellStatus,
  type AdaptiveProposalLlmConsentShellViewModel,
} from "../adaptiveProposalLlmConsentShellAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmConsentShellFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  model: AdaptiveProposalLlmConsentShellViewModel | null;
  assert: (model: AdaptiveProposalLlmConsentShellViewModel | null) => string[];
};

const RAW_SAMPLE = "raw sample should not render";
const RAW_TOP_VALUE = "raw top value should not render";
const RAW_PROMPT = "show order totals by raw customer prompt text";
const RAW_SQL = "select * from orders";
const RAW_RESULT = "query result row";

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 10,
  sample_values: [RAW_SAMPLE],
  top_values: [{ value: RAW_TOP_VALUE, count: 5 }],
});

const datasetFor = (schema: SchemaColumn[]): DatasetMetadata => ({
  dataset_id: "dataset:orders",
  filename: "orders.csv",
  original_filename: "orders.csv",
  table_name: "orders",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 25,
  column_count: schema.length,
  schema,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

const proposalFor = (prompt = RAW_PROMPT): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: scope("orders"),
    worksheets: [
      {
        worksheetId: "worksheet:orders",
        displayName: "orders",
        sheetName: "orders",
        tableName: "orders",
        schema: [
          column("order_id", "numeric"),
          column("status", "categorical"),
          column("order_total", "numeric"),
        ],
      },
    ],
    acceptedRelationshipContracts: [],
  });

const baseProposal = proposalFor();
const baseDataset = datasetFor([
  column("order_id", "numeric"),
  column("status", "categorical"),
  column("order_total", "numeric"),
]);
const restrictedDataset = datasetFor([
  column("access_code"),
  column("status", "categorical"),
  column("created_at", "date"),
]);
const redactedDataset = datasetFor([
  column("customer_name"),
  column("customer_email"),
  column("phone_number"),
]);
const rejectedValidation: AdaptiveProposalLlmValidationResult = {
  ok: false,
  response: null,
  issues: [
    {
      severity: "error",
      code: "invalid_shape",
      message: "Malformed metadata-only response.",
    },
  ],
};

const createModel = ({
  dataset = baseDataset,
  globalProviderMode = "provider_disabled",
  displayStatus,
  validation = null,
  changedFields = [],
}: {
  dataset?: DatasetMetadata;
  globalProviderMode?: Parameters<typeof createAdaptiveProposalLlmConsentShellViewModel>[0]["globalProviderMode"];
  displayStatus?: AdaptiveProposalLlmConsentShellStatus;
  validation?: AdaptiveProposalLlmValidationResult | null;
  changedFields?: readonly string[];
} = {}) =>
  createAdaptiveProposalLlmConsentShellViewModel({
    proposal: baseProposal,
    dataset,
    globalProviderMode,
    displayStatus,
    validation,
    changedFields,
  });

const serializedModel = (model: AdaptiveProposalLlmConsentShellViewModel | null): string =>
  JSON.stringify(model);

const expectShellSafety = (
  model: AdaptiveProposalLlmConsentShellViewModel | null,
): string[] => {
  if (!model) return ["Expected consent shell model."];

  return [
    ...(model.ctaLabel === "Use metadata-only AI refinement" ? [] : ["Expected metadata-only CTA label."]),
    ...(model.ctaDisabled === true ? [] : ["CTA must remain disabled."]),
    ...(model.providerCallMade === false ? [] : ["Shell must not call a provider."]),
    ...(model.noSqlGenerated === true ? [] : ["Shell must not generate SQL."]),
    ...(model.noInsertAvailable === true ? [] : ["Shell must not expose insert capability."]),
    ...(model.noRunAvailable === true ? [] : ["Shell must not expose run capability."]),
    ...(model.rawPromptTextShown === false ? [] : ["Shell must not show raw prompt text."]),
    ...(model.rawPayloadShown === false ? [] : ["Shell must not show raw payload."]),
    ...(model.rawProviderResponseShown === false ? [] : ["Shell must not show raw provider response."]),
  ];
};

const expectNoRawContent = (
  model: AdaptiveProposalLlmConsentShellViewModel | null,
): string[] => {
  const serialized = serializedModel(model);
  const forbidden = [RAW_SAMPLE, RAW_TOP_VALUE, RAW_PROMPT, RAW_SQL, RAW_RESULT];
  return forbidden.some((value) => serialized.includes(value))
    ? ["Shell model leaked raw prompt/text/rows/samples/SQL/results."]
    : [];
};

const expectStatus = (
  model: AdaptiveProposalLlmConsentShellViewModel | null,
  status: AdaptiveProposalLlmConsentShellStatus,
  chipLabel: string,
): string[] => {
  if (!model) return ["Expected consent shell model."];
  return [
    ...(model.status === status ? [] : [`Expected status ${status}; got ${model.status}.`]),
    ...(model.chipLabel === chipLabel ? [] : [`Expected chip ${chipLabel}; got ${model.chipLabel}.`]),
  ];
};

const fixtures: Fixture[] = [
  {
    name: "provider disabled shell shows disabled CTA and no data sent copy",
    model: createModel(),
    assert: (model) => [
      ...expectStatus(model, "provider_disabled", "Provider disabled"),
      ...expectShellSafety(model),
      ...(model?.disabledHelper === "Provider access is disabled. No data has been sent."
        ? []
        : ["Expected disabled no-data helper."]),
      ...(model?.providerDisabledCopy.includes("no provider call can be made")
        ? []
        : ["Expected provider-disabled preview copy."]),
    ],
  },
  {
    name: "metadata-only eligible state shows eligible chip but still no provider call",
    model: createModel({
      globalProviderMode: "metadata_only_provider_ready",
      displayStatus: "metadata_only_eligible",
    }),
    assert: (model) => [
      ...expectStatus(model, "metadata_only_eligible", "Metadata-only eligible"),
      ...expectShellSafety(model),
    ],
  },
  {
    name: "consent required state shows consent copy but does not call provider",
    model: createModel({ globalProviderMode: "metadata_only_provider_ready" }),
    assert: (model) => [
      ...expectStatus(model, "consent_required", "Consent required"),
      ...expectShellSafety(model),
      ...(model?.payloadSummary.consentStatus === "required"
        ? []
        : ["Expected consent status required."]),
    ],
  },
  {
    name: "restricted blocked state shows restricted blocked copy and no CTA action",
    model: createModel({
      dataset: restrictedDataset,
      globalProviderMode: "metadata_only_provider_ready",
    }),
    assert: (model) => [
      ...expectStatus(model, "restricted_blocked", "Blocked: restricted fields"),
      ...expectShellSafety(model),
      ...(model && model.blockedReasons.length > 0 ? [] : ["Expected restricted blocked reason."]),
    ],
  },
  {
    name: "redaction-too-high blocked state shows redaction blocked copy",
    model: createModel({
      dataset: redactedDataset,
      globalProviderMode: "metadata_only_provider_ready",
    }),
    assert: (model) => [
      ...expectStatus(model, "redaction_too_high_blocked", "Blocked: too much context redacted"),
      ...expectShellSafety(model),
      ...(model && model.payloadSummary.redactedColumnCount > 0
        ? []
        : ["Expected redacted column count."]),
    ],
  },
  {
    name: "validation rejected state says original outline unchanged",
    model: createModel({ validation: rejectedValidation }),
    assert: (model) => [
      ...expectStatus(model, "validation_rejected", "AI response rejected"),
      ...expectShellSafety(model),
      ...(model?.originalOutlineUnchanged === true
        ? []
        : ["Expected original outline unchanged flag."]),
    ],
  },
  {
    name: "refined planning-only state shows changed-field summary only",
    model: createModel({ changedFields: ["metrics", "warnings"] }),
    assert: (model) => [
      ...expectStatus(model, "refined_planning_only", "Planning outline refined"),
      ...expectShellSafety(model),
      ...(model?.changedFields.join(",") === "metrics,warnings"
        ? []
        : ["Expected changed-field summary."]),
    ],
  },
  {
    name: "payload exclusions copy is present",
    model: createModel(),
    assert: (model) => [
      ...(model?.payloadExclusions.includes("raw rows") ? [] : ["Expected raw rows exclusion."]),
      ...(model?.payloadExclusions.includes("top values") ? [] : ["Expected top values exclusion."]),
      ...(model?.payloadExclusions.includes("provider responses")
        ? []
        : ["Expected provider response exclusion."]),
    ],
  },
  {
    name: "payload summary shows counts only and no raw prompt/text/rows/samples/SQL/results",
    model: createModel(),
    assert: (model) => [
      ...(model?.payloadSummary.tableCount === 1 ? [] : ["Expected table count only."]),
      ...(model && model.payloadSummary.includedColumnCount > 0
        ? []
        : ["Expected included column count."]),
      ...(model?.payloadSummary.payloadFingerprint ? [] : ["Expected payload fingerprint."]),
      ...expectNoRawContent(model),
    ],
  },
  {
    name: "CTA remains disabled in this slice",
    model: createModel({ globalProviderMode: "metadata_only_provider_ready" }),
    assert: expectShellSafety,
  },
  {
    name: "consent shell creation does not mutate proposal",
    model: (() => {
      const before = JSON.stringify(baseProposal);
      const model = createModel({ globalProviderMode: "metadata_only_provider_ready" });
      return JSON.stringify(baseProposal) === before ? model : null;
    })(),
    assert: (model) => (model ? expectShellSafety(model) : ["Proposal was mutated."]),
  },
  {
    name: "no SQL/render/insert/run capability exposed",
    model: createModel({ displayStatus: "refined_planning_only", changedFields: ["title"] }),
    assert: expectShellSafety,
  },
];

export function runAdaptiveProposalLlmConsentShellFixtures(): AdaptiveProposalLlmConsentShellFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.model);
    return {
      name: fixture.name,
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

export const allAdaptiveProposalLlmConsentShellFixturesPass = (): boolean =>
  runAdaptiveProposalLlmConsentShellFixtures().failed.length === 0;
