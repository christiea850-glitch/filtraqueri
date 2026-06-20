/**
 * T-13M-9 - Adaptive Proposal LLM audit snapshot fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import type { AdaptiveProposalLlmValidationResult } from "../adaptiveProposalLlmContract";
import {
  createAdaptiveProposalLlmAuditSnapshot,
  summarizeAdaptiveProposalLlmAuditSnapshot,
  type AdaptiveProposalLlmAuditSnapshot,
} from "../adaptiveProposalLlmAuditSnapshot";
import { createAdaptiveProposalLlmConsentState } from "../adaptiveProposalLlmConsent";
import type { AdaptiveProposalLlmProviderGateResult } from "../adaptiveProposalLlmProviderGate";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmAuditSnapshotFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  snapshot: AdaptiveProposalLlmAuditSnapshot;
  assert: (snapshot: AdaptiveProposalLlmAuditSnapshot) => string[];
};

const gate: AdaptiveProposalLlmProviderGateResult = {
  globalProviderMode: "metadata_only_provider_ready",
  datasetEligibility: "eligible_metadata_only",
  requestConsent: "required",
  refinementStatus: "consent_required",
  providerCallAllowed: false,
  providerCallMade: false,
  payloadScope: "metadata_only",
  payloadSummary: {
    payloadFingerprint: "payload:fingerprint:1",
    payloadScope: "metadata_only",
    tableCount: 2,
    includedColumnCount: 5,
    redactedColumnCount: 2,
    restrictedColumnCount: 0,
    sensitiveColumnCount: 2,
    excludedColumnCount: 0,
    redactionRatio: 2 / 7,
    rawRowsIncluded: false,
    sampleValuesIncluded: false,
    topValuesIncluded: false,
    sqlIncluded: false,
    promptTextIncluded: false,
    providerCallMade: false,
  },
  blockedReasons: [],
  planningOnly: {
    sql: null,
    rendererStatus: "not_rendered",
    rendererCanRender: false,
    canInsertSql: false,
    canRunSql: false,
  },
};

const restrictedGate: AdaptiveProposalLlmProviderGateResult = {
  ...gate,
  datasetEligibility: "restricted_blocked",
  refinementStatus: "blocked",
  payloadSummary: {
    ...gate.payloadSummary,
    restrictedColumnCount: 1,
    excludedColumnCount: 1,
  },
  blockedReasons: [
    {
      code: "restricted_columns_present",
      message: "Restricted columns block metadata-only provider refinement.",
    },
  ],
};

const consent = createAdaptiveProposalLlmConsentState({
  payloadFingerprint: gate.payloadSummary.payloadFingerprint,
  providerMode: "metadata_only_provider_ready",
  payloadScope: "metadata_only",
  decision: "granted",
  decisionPayloadFingerprint: gate.payloadSummary.payloadFingerprint,
  sanitizedPayloadSummary: gate.payloadSummary,
});

const rejectedValidation: AdaptiveProposalLlmValidationResult = {
  ok: false,
  response: null,
  issues: [
    {
      severity: "error",
      code: "sql_like_content",
      message: "SQL-like content is not allowed.",
    },
  ],
};

const baseSnapshot = createAdaptiveProposalLlmAuditSnapshot({
  gate,
  consent,
  timestamp: "2026-01-01T00:00:00.000Z",
});

const forbiddenContentPatterns = [
  /raw sample should never leave/i,
  /which tenants have access/i,
  /\bselect\s+\*\s+from\b/i,
  /queryResults/i,
  /clipboard/i,
  /api[_-]?key/i,
  /provider response body/i,
];

const expectNoForbiddenStoredContent = (
  snapshot: AdaptiveProposalLlmAuditSnapshot,
): string[] => {
  const serialized = JSON.stringify(snapshot);
  return forbiddenContentPatterns.some((pattern) => pattern.test(serialized))
    ? ["Snapshot stored forbidden raw prompt, rows, samples, SQL, query, clipboard, API, or provider response content."]
    : [];
};

const fixtures: Fixture[] = [
  {
    name: "snapshot records eligibility decision and provenance flags",
    snapshot: baseSnapshot,
    assert: (snapshot) => [
      ...(snapshot.eligibilityDecision === "eligible_metadata_only"
        ? []
        : ["Expected eligibility decision."]),
      ...(snapshot.provenance.rawRowsIncluded === false ? [] : ["rawRowsIncluded must be false."]),
      ...(snapshot.provenance.sampleValuesIncluded === false ? [] : ["sampleValuesIncluded must be false."]),
      ...(snapshot.provenance.topValuesIncluded === false ? [] : ["topValuesIncluded must be false."]),
      ...(snapshot.provenance.sqlIncluded === false ? [] : ["sqlIncluded must be false."]),
      ...(snapshot.provenance.promptTextIncluded === false ? [] : ["promptTextIncluded must be false."]),
      ...(snapshot.provenance.providerCallMade === false ? [] : ["providerCallMade must be false."]),
    ],
  },
  {
    name: "snapshot records restricted redacted and excluded counts",
    snapshot: createAdaptiveProposalLlmAuditSnapshot({
      gate: restrictedGate,
      consent,
      timestamp: "2026-01-01T00:00:00.000Z",
    }),
    assert: (snapshot) => [
      ...(snapshot.governanceCounts.restrictedColumnCount === 1 ? [] : ["Expected restricted count."]),
      ...(snapshot.governanceCounts.redactedColumnCount === 2 ? [] : ["Expected redacted count."]),
      ...(snapshot.governanceCounts.excludedColumnCount === 1 ? [] : ["Expected excluded count."]),
    ],
  },
  {
    name: "snapshot never stores raw payload raw prompt rows samples SQL drafts query results or raw provider response",
    snapshot: baseSnapshot,
    assert: (snapshot) => [
      ...expectNoForbiddenStoredContent(snapshot),
      ...(snapshot.rawPromptTextStored === false ? [] : ["Raw prompt must not be stored."]),
      ...(snapshot.rawPayloadStored === false ? [] : ["Raw payload must not be stored."]),
      ...(snapshot.rawProviderResponseStored === false ? [] : ["Raw provider response must not be stored."]),
    ],
  },
  {
    name: "validation rejected snapshot preserves original proposal",
    snapshot: createAdaptiveProposalLlmAuditSnapshot({
      gate,
      consent,
      validation: rejectedValidation,
      mergeResult: {
        changed: false,
        changedFields: [],
        originalProposalPreserved: true,
      },
    }),
    assert: (snapshot) => [
      ...(snapshot.refinementStatus === "validation_rejected"
        ? []
        : ["Expected validation rejected status."]),
      ...(snapshot.mergeResult?.originalProposalPreserved === true
        ? []
        : ["Expected original proposal preservation summary."]),
      ...(snapshot.mergeResult?.changed === false ? [] : ["Rejected validation must not change proposal."]),
    ],
  },
  {
    name: "refined snapshot records changed fields summary only",
    snapshot: createAdaptiveProposalLlmAuditSnapshot({
      gate,
      consent,
      mergeResult: {
        changed: true,
        changedFields: ["title", "proposalNarrative"],
        originalProposalPreserved: false,
      },
    }),
    assert: (snapshot) => {
      const summary = summarizeAdaptiveProposalLlmAuditSnapshot(snapshot);
      return [
        ...(summary.changedFields.join(",") === "title,proposalNarrative"
          ? []
          : ["Expected changed fields summary."]),
        ...expectNoForbiddenStoredContent(snapshot),
      ];
    },
  },
  {
    name: "providerCallMade remains false in foundation",
    snapshot: baseSnapshot,
    assert: (snapshot) => [
      ...(snapshot.providerCallMade === false ? [] : ["Provider call must remain false."]),
      ...(snapshot.sanitizedPayloadSummary.providerCallMade === false
        ? []
        : ["Payload summary provider call must remain false."]),
    ],
  },
  {
    name: "no SQL generated no insert performed and no run performed remain true",
    snapshot: baseSnapshot,
    assert: (snapshot) => [
      ...(snapshot.noSqlGenerated === true ? [] : ["noSqlGenerated must remain true."]),
      ...(snapshot.noInsertPerformed === true ? [] : ["noInsertPerformed must remain true."]),
      ...(snapshot.noRunPerformed === true ? [] : ["noRunPerformed must remain true."]),
    ],
  },
];

export function runAdaptiveProposalLlmAuditSnapshotFixtures(): AdaptiveProposalLlmAuditSnapshotFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.snapshot);
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

export const allAdaptiveProposalLlmAuditSnapshotFixturesPass = (): boolean =>
  runAdaptiveProposalLlmAuditSnapshotFixtures().failed.length === 0;
