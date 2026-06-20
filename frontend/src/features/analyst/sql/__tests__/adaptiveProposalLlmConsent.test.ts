/**
 * T-13M-9 - Adaptive Proposal LLM consent foundation fixtures.
 *
 * Pure fixture runner only. No provider calls, SQL generation, SQL rendering,
 * Monaco insertion, Run Query calls, backend/API calls, or execution behavior.
 */

import {
  ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY,
  createAdaptiveProposalLlmConsentState,
  summarizeAdaptiveProposalLlmConsent,
  type AdaptiveProposalLlmConsentState,
} from "../adaptiveProposalLlmConsent";
import type { AdaptiveProposalLlmProviderGatePayloadSummary } from "../adaptiveProposalLlmProviderGate";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type AdaptiveProposalLlmConsentFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  state: AdaptiveProposalLlmConsentState;
  assert: (state: AdaptiveProposalLlmConsentState) => string[];
};

const sanitizedPayloadSummary: AdaptiveProposalLlmProviderGatePayloadSummary = {
  payloadFingerprint: "payload:fingerprint:1",
  payloadScope: "metadata_only",
  tableCount: 1,
  includedColumnCount: 3,
  redactedColumnCount: 0,
  restrictedColumnCount: 0,
  sensitiveColumnCount: 0,
  excludedColumnCount: 0,
  redactionRatio: 0,
  rawRowsIncluded: false,
  sampleValuesIncluded: false,
  topValuesIncluded: false,
  sqlIncluded: false,
  promptTextIncluded: false,
  providerCallMade: false,
};

const createConsent = (
  overrides: Partial<Parameters<typeof createAdaptiveProposalLlmConsentState>[0]> = {},
) =>
  createAdaptiveProposalLlmConsentState({
    payloadFingerprint: sanitizedPayloadSummary.payloadFingerprint,
    providerMode: "metadata_only_provider_ready",
    payloadScope: "metadata_only",
    sanitizedPayloadSummary,
    ...overrides,
  });

const expectNoRawContent = (state: AdaptiveProposalLlmConsentState): string[] => {
  const serialized = JSON.stringify(state);
  return [
    ...(state.rawPromptTextIncluded === false ? [] : ["Consent must not include raw prompt text."]),
    ...(state.rawPayloadIncluded === false ? [] : ["Consent must not include raw payload."]),
    ...(state.providerCallMade === false ? [] : ["Consent must not call provider."]),
    ...(/raw prompt|raw sample|select \*/i.test(serialized)
      ? ["Consent state leaked raw prompt, sample, or SQL content."]
      : []),
  ];
};

const fixtures: Fixture[] = [
  {
    name: "per-request consent required for eligible payload",
    state: createConsent(),
    assert: (state) => [
      ...(state.status === "required" ? [] : ["Expected required consent."]),
      ...(state.payloadFingerprint === sanitizedPayloadSummary.payloadFingerprint
        ? []
        : ["Expected consent to bind payload fingerprint."]),
    ],
  },
  {
    name: "consent granted only matches exact payload fingerprint",
    state: createConsent({
      decision: "granted",
      decisionPayloadFingerprint: "payload:fingerprint:2",
      decidedAt: "2026-01-01T00:00:00.000Z",
    }),
    assert: (state) => [
      ...(state.status === "required" ? [] : ["Mismatched granted consent must still require consent."]),
    ],
  },
  {
    name: "consent denied blocks refinement",
    state: createConsent({
      decision: "denied",
      decisionPayloadFingerprint: sanitizedPayloadSummary.payloadFingerprint,
      decidedAt: "2026-01-01T00:00:00.000Z",
    }),
    assert: (state) => [
      ...(state.status === "denied" ? [] : ["Expected denied consent state."]),
    ],
  },
  {
    name: "expired consent blocks refinement",
    state: createConsent({
      decision: "granted",
      decisionPayloadFingerprint: sanitizedPayloadSummary.payloadFingerprint,
      decidedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: "2026-01-02T00:00:00.000Z",
      now: "2026-01-03T00:00:00.000Z",
    }),
    assert: (state) => [
      ...(state.status === "expired" ? [] : ["Expected expired consent state."]),
    ],
  },
  {
    name: "consent summary includes metadata-only safety copy",
    state: createConsent({
      decision: "granted",
      decisionPayloadFingerprint: sanitizedPayloadSummary.payloadFingerprint,
    }),
    assert: (state) => {
      const summary = summarizeAdaptiveProposalLlmConsent(state);
      return [
        ...(summary.status === "granted" ? [] : ["Expected granted summary."]),
        ...(summary.safetyLine === ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY.safetyLine
          ? []
          : ["Expected metadata-only safety line."]),
        ...(summary.nonSqlWarning === ADAPTIVE_PROPOSAL_LLM_PROVIDER_COPY.nonSqlWarning
          ? []
          : ["Expected non-SQL warning."]),
      ];
    },
  },
  {
    name: "consent does not include raw prompt text or raw payload",
    state: createConsent(),
    assert: expectNoRawContent,
  },
];

export function runAdaptiveProposalLlmConsentFixtures(): AdaptiveProposalLlmConsentFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert(fixture.state);
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

export const allAdaptiveProposalLlmConsentFixturesPass = (): boolean =>
  runAdaptiveProposalLlmConsentFixtures().failed.length === 0;

