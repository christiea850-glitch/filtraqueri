export type NavigationIntegrityScope =
  | "preview-to-detail"
  | "detail-to-dashboard"
  | "future-workspace-return"
  | "future-deep-link";

export type NavigationIntegrityExpectation =
  | "origin-restoration"
  | "dataset-session-workbook-continuity"
  | "mode-continuity"
  | "pagination-preservation"
  | "filter-preservation"
  | "expanded-panel-preservation"
  | "selected-result-preservation";

export type NavigationIntegrityLevel = "verified" | "metadata-only" | "future-review";

export type NavigationIntegrityAssertion = {
  readonly assertionId: string;
  readonly preservationId: string;
  readonly scope: NavigationIntegrityScope;
  readonly expectation: NavigationIntegrityExpectation;
  readonly level: NavigationIntegrityLevel;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type NavigationIntegritySummary = {
  readonly summaryId: string;
  readonly preservationId: string;
  readonly assertionCount: number;
  readonly verifiedCount: number;
  readonly futureReviewCount: number;
  readonly metadataOnly: true;
};

