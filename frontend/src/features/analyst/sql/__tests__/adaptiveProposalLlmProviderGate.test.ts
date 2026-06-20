/**
 * T-13M-9 - Adaptive Proposal LLM provider-gate foundation fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { AnalysisScopeSelection } from "../../../workbook";
import { detectBusinessIntent } from "../businessIntentGrounding";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import type { AdaptiveProposalLlmPayload } from "../adaptiveProposalLlmContract";
import {
  buildAdaptiveProposalLlmPayload,
  type AdaptiveProposalLlmPayloadWorksheet,
} from "../adaptiveProposalLlmPayloadBuilder";
import {
  evaluateAdaptiveProposalLlmProviderGate,
  type AdaptiveProposalLlmProviderGateResult,
} from "../adaptiveProposalLlmProviderGate";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmProviderGateFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  result: AdaptiveProposalLlmProviderGateResult;
  assert: (result: AdaptiveProposalLlmProviderGateResult) => string[];
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
  sample_values: ["raw sample must not be needed"],
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
  rowCount: 25,
  columnCount: schema.length,
});

const scope = (...tableNames: string[]): AnalysisScopeSelection[] =>
  tableNames.map((tableName) => ({
    worksheetId: `worksheet:${tableName}`,
    sourceType: "original",
    tableName,
    originalTableName: tableName,
  }));

const payloadFor = ({
  prompt,
  worksheets,
}: {
  prompt: string;
  worksheets: AdaptiveProposalLlmPayloadWorksheet[];
}): AdaptiveProposalLlmPayload => {
  const proposal = proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: scope(...worksheets.map((item) => item.tableName)),
    worksheets,
    acceptedRelationshipContracts: [],
  });

  return buildAdaptiveProposalLlmPayload({
    proposal,
    worksheets,
    acceptedRelationshipContracts: [],
  });
};

const eligiblePayload = payloadFor({
  prompt: "show order totals by status",
  worksheets: [
    worksheet("orders", [
      column("order_id", "numeric"),
      column("status", "categorical"),
      column("order_total", "numeric"),
    ]),
  ],
});

const restrictedPayload = payloadFor({
  prompt: "show access code status",
  worksheets: [
    worksheet("access_codes", [
      column("access_code"),
      column("status", "categorical"),
      column("created_at", "date"),
    ]),
  ],
});

const redactedPayload = payloadFor({
  prompt: "show customers",
  worksheets: [
    worksheet("customers", [
      column("customer_name"),
      column("customer_email"),
      column("phone_number"),
    ]),
  ],
});

const invalidFingerprintPayload: AdaptiveProposalLlmPayload = {
  ...eligiblePayload,
  proposal: {
    ...eligiblePayload.proposal,
    payloadFingerprint: "",
  },
};

const providerReady = (payload: AdaptiveProposalLlmPayload) =>
  evaluateAdaptiveProposalLlmProviderGate({
    payload,
    globalProviderMode: "metadata_only_provider_ready",
  });

const expectPlanningOnly = (result: AdaptiveProposalLlmProviderGateResult): string[] => [
  ...(result.planningOnly.sql === null ? [] : ["Gate must not expose SQL."]),
  ...(result.planningOnly.rendererStatus === "not_rendered" ? [] : ["Renderer must stay not_rendered."]),
  ...(result.planningOnly.rendererCanRender === false ? [] : ["Renderer canRender must stay false."]),
  ...(result.planningOnly.canInsertSql === false ? [] : ["Insert must stay disabled."]),
  ...(result.planningOnly.canRunSql === false ? [] : ["Run must stay disabled."]),
];

const fixtures: Fixture[] = [
  {
    name: "provider disabled blocks refinement",
    result: evaluateAdaptiveProposalLlmProviderGate({ payload: eligiblePayload }),
    assert: (result) => [
      ...(result.datasetEligibility === "provider_disabled" ? [] : ["Expected provider_disabled."]),
      ...(result.refinementStatus === "blocked" ? [] : ["Expected blocked refinement status."]),
      ...(result.blockedReasons.some((reason) => reason.code === "provider_disabled")
        ? []
        : ["Expected provider disabled reason."]),
    ],
  },
  {
    name: "eligible metadata-only payload requires consent",
    result: providerReady(eligiblePayload),
    assert: (result) => [
      ...(result.datasetEligibility === "eligible_metadata_only" ? [] : ["Expected eligible metadata-only."]),
      ...(result.requestConsent === "required" ? [] : ["Expected per-request consent requirement."]),
      ...(result.refinementStatus === "consent_required" ? [] : ["Expected consent_required status."]),
    ],
  },
  {
    name: "restricted columns block refinement",
    result: providerReady(restrictedPayload),
    assert: (result) => [
      ...(result.datasetEligibility === "restricted_blocked" ? [] : ["Expected restricted block."]),
      ...(result.blockedReasons.some((reason) => reason.code === "restricted_columns_present")
        ? []
        : ["Expected restricted column reason."]),
    ],
  },
  {
    name: "redaction too high blocks refinement",
    result: providerReady(redactedPayload),
    assert: (result) => [
      ...(result.datasetEligibility === "redaction_too_high" ? [] : ["Expected redaction-too-high block."]),
      ...(result.payloadSummary.redactionRatio > 0.5 ? [] : ["Expected redaction ratio above threshold."]),
    ],
  },
  {
    name: "invalid payload fingerprint blocks refinement",
    result: providerReady(invalidFingerprintPayload),
    assert: (result) => [
      ...(result.datasetEligibility === "payload_invalid" ? [] : ["Expected invalid payload block."]),
      ...(result.blockedReasons.some((reason) => reason.code === "payload_fingerprint_missing")
        ? []
        : ["Expected missing fingerprint reason."]),
    ],
  },
  {
    name: "eligible state does not call provider",
    result: providerReady(eligiblePayload),
    assert: (result) => [
      ...(result.providerCallAllowed === false ? [] : ["Provider calls must not be allowed in foundation."]),
      ...(result.providerCallMade === false ? [] : ["Provider call must not be made."]),
      ...(result.payloadSummary.providerCallMade === false ? [] : ["Payload summary must report no provider call."]),
    ],
  },
  {
    name: "planning-only invariants remain true",
    result: providerReady(eligiblePayload),
    assert: expectPlanningOnly,
  },
];

export function runAdaptiveProposalLlmProviderGateFixtures(): AdaptiveProposalLlmProviderGateFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.result);
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

export const allAdaptiveProposalLlmProviderGateFixturesPass = (): boolean =>
  runAdaptiveProposalLlmProviderGateFixtures().failed.length === 0;

