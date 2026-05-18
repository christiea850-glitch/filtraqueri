import type {
  NavigationIntegrityAssertion,
  NavigationIntegritySummary,
} from "./integrityTypes";

export const summarizeNavigationIntegrity = (
  preservationId: string,
  assertions: ReadonlyArray<NavigationIntegrityAssertion>,
): NavigationIntegritySummary => {
  const matchingAssertions = assertions.filter((assertion) => assertion.preservationId === preservationId);
  const verifiedCount = matchingAssertions.filter((assertion) => assertion.level === "verified").length;
  const futureReviewCount = matchingAssertions.filter((assertion) => assertion.level === "future-review").length;

  return {
    summaryId: `navigation-integrity-summary:${preservationId}`,
    preservationId,
    assertionCount: matchingAssertions.length,
    verifiedCount,
    futureReviewCount,
    metadataOnly: true,
  };
};

export const validateNavigationIntegrityAssertions = (
  assertions: ReadonlyArray<NavigationIntegrityAssertion>,
): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const assertion of assertions) {
    if (!assertion.assertionId || seen.has(assertion.assertionId)) {
      issues.push(`duplicate-or-empty:${assertion.assertionId}`);
    }
    seen.add(assertion.assertionId);

    if (!assertion.metadataOnly) {
      issues.push(`not-metadata-only:${assertion.assertionId}`);
    }
  }

  return issues.sort((left, right) => left.localeCompare(right));
};

