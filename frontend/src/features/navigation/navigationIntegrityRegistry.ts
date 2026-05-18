import type { NavigationIntegrityAssertion } from "./integrityTypes";
import { createNavigationPreservationAssertion } from "./preservationAssertions";
import {
  summarizeNavigationIntegrity,
  validateNavigationIntegrityAssertions,
} from "./navigationIntegrity";

const resultsInsightPreservationId = "preserve:results-insight-detail";
const datasetIntelligencePreservationId = "preserve:dataset-intelligence-detail";

const createStandardAssertions = (
  preservationId: string,
  assertionPrefix: string,
): ReadonlyArray<NavigationIntegrityAssertion> => [
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:origin-restoration`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "origin-restoration",
    summary: "Back behavior should return to the originating dashboard surface.",
  }),
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:dataset-session-workbook-continuity`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "dataset-session-workbook-continuity",
    summary: "Dataset, session, workbook, and worksheet context should remain stable.",
  }),
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:mode-continuity`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "mode-continuity",
    summary: "Human or Analyst mode should not be changed by detail back behavior.",
  }),
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:pagination-preservation`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "pagination-preservation",
    summary: "Result pagination references should remain available to the origin surface.",
  }),
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:filter-preservation`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "filter-preservation",
    summary: "Filter references should remain available to the origin surface.",
  }),
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:expanded-panel-preservation`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "expanded-panel-preservation",
    summary: "Expanded or collapsed panel references should remain available to the origin surface.",
  }),
  createNavigationPreservationAssertion({
    assertionId: `${assertionPrefix}:selected-result-preservation`,
    preservationId,
    scope: "detail-to-dashboard",
    expectation: "selected-result-preservation",
    summary: "Selected result or item references should remain available to the origin surface.",
  }),
];

export const navigationIntegrityAssertions = [
  ...createStandardAssertions(resultsInsightPreservationId, "assert:results-insight-detail"),
  ...createStandardAssertions(datasetIntelligencePreservationId, "assert:dataset-intelligence-detail"),
] as const satisfies ReadonlyArray<NavigationIntegrityAssertion>;

export const navigationIntegritySummaries = [
  summarizeNavigationIntegrity(resultsInsightPreservationId, navigationIntegrityAssertions),
  summarizeNavigationIntegrity(datasetIntelligencePreservationId, navigationIntegrityAssertions),
] as const;

export const navigationIntegrityIssues = validateNavigationIntegrityAssertions(navigationIntegrityAssertions);

export const navigationIntegrityRegistryVersion = "s5-2e-navigation-integrity-v1";

