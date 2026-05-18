import type {
  NavigationIntegrityAssertion,
  NavigationIntegrityExpectation,
  NavigationIntegrityScope,
} from "./integrityTypes";

export type CreateNavigationPreservationAssertionInput = {
  readonly assertionId: string;
  readonly preservationId: string;
  readonly scope: NavigationIntegrityScope;
  readonly expectation: NavigationIntegrityExpectation;
  readonly summary: string;
};

export const createNavigationPreservationAssertion = ({
  assertionId,
  preservationId,
  scope,
  expectation,
  summary,
}: CreateNavigationPreservationAssertionInput): NavigationIntegrityAssertion => ({
  assertionId,
  preservationId,
  scope,
  expectation,
  level: "metadata-only",
  summary,
  metadataOnly: true,
});

export const navigationPreservationExpectations: ReadonlyArray<NavigationIntegrityExpectation> = [
  "origin-restoration",
  "dataset-session-workbook-continuity",
  "mode-continuity",
  "pagination-preservation",
  "filter-preservation",
  "expanded-panel-preservation",
  "selected-result-preservation",
];

