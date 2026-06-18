/**
 * T-13M-8 - Adaptive Proposal LLM metadata payload fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AcceptedRelationshipContract,
  AnalysisScopeSelection,
} from "../../../workbook";
import { detectBusinessIntent } from "../businessIntentGrounding";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import {
  buildAdaptiveProposalLlmPayload,
  summarizeAdaptiveProposalLlmPayload,
  type AdaptiveProposalLlmPayloadWorksheet,
} from "../adaptiveProposalLlmPayloadBuilder";
import type { AdaptiveProposalLlmPayload } from "../adaptiveProposalLlmContract";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmPayloadBuilderFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: (payload: AdaptiveProposalLlmPayload) => string[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type,
  inferred_type,
  null_count: 0,
  unique_count: 10,
  sample_values: ["raw sample should never leave schema"],
  top_values: [{ value: "raw top value", count: 3 }],
});

const worksheet = (
  tableName: string,
  schema: SchemaColumn[],
): AdaptiveProposalLlmPayloadWorksheet => ({
  worksheetId: `worksheet:${tableName}`,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema,
  rowCount: 100,
  columnCount: schema.length,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

const contract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}:${targetTableName}`,
  sourceWorksheetId: `worksheet:${sourceTableName}`,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: `worksheet:${targetTableName}`,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}:${targetTableName}`,
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: [],
  overlapRatio: 1,
  sourceUniqueRatio: 0.5,
  targetUniqueRatio: 1,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
});

const prompt = "which tenants have access code issues by property";
const worksheets = [
  worksheet("tenants", [
    column("tenant_id", "numeric"),
    column("tenant_name"),
    column("tenant_email"),
    column("status", "categorical"),
    column("property_id", "numeric"),
  ]),
  worksheet("access_codes", [
    column("access_code"),
    column("tenant_id", "numeric"),
    column("status", "categorical"),
    column("created_at", "date"),
  ]),
  worksheet("properties", [
    column("property_id", "numeric"),
    column("region", "categorical"),
    column("unit_count", "numeric"),
  ]),
];
const contracts = [
  contract("tenants", "property_id", "properties", "property_id"),
  contract("access_codes", "tenant_id", "tenants", "tenant_id"),
];
const proposal = proposeAdaptiveReport({
  prompt,
  detectedIntent: detectBusinessIntent(prompt),
  appliedScopeSelections: scope("tenants", "access_codes", "properties"),
  worksheets,
  acceptedRelationshipContracts: contracts,
});
const payload = buildAdaptiveProposalLlmPayload({
  proposal,
  worksheets,
  acceptedRelationshipContracts: contracts,
  selectedGuidanceDialect: "duckdb",
});

const expectNoForbiddenPayloadContent = (value: unknown): string[] => {
  const serialized = JSON.stringify(value);
  const forbidden = [
    /raw sample should never leave schema/i,
    /raw top value/i,
    /sample_values/i,
    /top_values/i,
    /sqlDraft/i,
    /generatedSql/i,
    /queryResults/i,
    /which tenants have access code issues by property/i,
  ];
  return forbidden.some((pattern) => pattern.test(serialized))
    ? ["Payload includes forbidden raw/sample/top/prompt/SQL content."]
    : [];
};

const fixtures: Fixture[] = [
  {
    name: "safe metadata payload includes no raw rows, samples, SQL, or prompt text",
    assert: (current) => [
      ...expectNoForbiddenPayloadContent(current),
      ...(current.schemaVersion === "adaptive-proposal-llm:v1" ? [] : ["Expected payload schema v1."]),
    ],
  },
  {
    name: "restricted columns are excluded and block provider opening",
    assert: (current) => {
      const serialized = JSON.stringify(current);
      return [
        ...(serialized.includes("\"columnName\":\"access_code\"")
          ? ["Restricted access_code column name leaked."]
          : []),
        ...(current.governance.restrictedColumnCount > 0 ? [] : ["Expected restricted column count."]),
        ...(current.governance.providerStatus === "closed" ? [] : ["Provider must remain closed."]),
      ];
    },
  },
  {
    name: "PII high-risk columns are redacted or omitted",
    assert: (current) => {
      const serialized = JSON.stringify(current);
      return [
        ...(serialized.includes("tenant_email") ? ["Sensitive tenant_email column name leaked."] : []),
        ...(serialized.includes("tenant_name") ? ["Sensitive tenant_name column name leaked."] : []),
        ...(current.governance.redactedColumnCount >= 2 ? [] : ["Expected redacted PII columns."]),
      ];
    },
  },
  {
    name: "safe and caution columns may be included as metadata only",
    assert: (current) => {
      const serialized = JSON.stringify(current);
      return [
        ...(serialized.includes("status") ? [] : ["Expected safe/caution status metadata."]),
        ...(serialized.includes("region") ? [] : ["Expected safe/caution region metadata."]),
      ];
    },
  },
  {
    name: "payload provenance flags are false",
    assert: (current) => [
      ...(current.provenance.rawRowsIncluded === false ? [] : ["rawRowsIncluded must be false."]),
      ...(current.provenance.sampleValuesIncluded === false ? [] : ["sampleValuesIncluded must be false."]),
      ...(current.provenance.topValuesIncluded === false ? [] : ["topValuesIncluded must be false."]),
      ...(current.provenance.sqlIncluded === false ? [] : ["sqlIncluded must be false."]),
      ...(current.provenance.promptTextIncluded === false ? [] : ["promptTextIncluded must be false."]),
      ...(current.provenance.providerCallMade === false ? [] : ["providerCallMade must be false."]),
    ],
  },
  {
    name: "provider remains closed and disabled",
    assert: (current) => [
      ...(current.governance.providerStatus === "closed" ? [] : ["Provider status must be closed."]),
      ...(current.governance.providerMode === "provider_disabled"
        ? []
        : ["Provider mode must be disabled."]),
      ...(current.governance.consentStatus === "not_requested"
        ? []
        : ["Consent must not be requested by this foundation."]),
    ],
  },
  {
    name: "fingerprint and summary are deterministic",
    assert: (current) => {
      const repeated = buildAdaptiveProposalLlmPayload({
        proposal,
        worksheets,
        acceptedRelationshipContracts: contracts,
        selectedGuidanceDialect: "duckdb",
      });
      return [
        ...(JSON.stringify(current) === JSON.stringify(repeated)
          ? []
          : ["Expected deterministic payload output."]),
        ...(current.proposal.payloadFingerprint === proposal.payloadFingerprint
          ? []
          : ["Expected deterministic proposal fingerprint to be retained."]),
        ...(summarizeAdaptiveProposalLlmPayload(current) === summarizeAdaptiveProposalLlmPayload(repeated)
          ? []
          : ["Expected deterministic payload summary."]),
      ];
    },
  },
];

export function runAdaptiveProposalLlmPayloadBuilderFixtures(): AdaptiveProposalLlmPayloadBuilderFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(payload);
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

export const allAdaptiveProposalLlmPayloadBuilderFixturesPass = (): boolean =>
  runAdaptiveProposalLlmPayloadBuilderFixtures().failed.length === 0;
