export type NavigationRoutedDetailActivation = {
  readonly activationId: string;
  readonly routeId: string;
  readonly sourceRouteId: string;
  readonly preservationId: string;
  readonly integrityAssertionIds: ReadonlyArray<string>;
  readonly activationMode: "controlled-hash-route";
  readonly deepLinkReady: boolean;
  readonly globalRoutingMigration: false;
  readonly metadataOnly: true;
};

export const navigationRoutedDetailActivations = [
  {
    activationId: "activate:results-insight-detail",
    routeId: "detail:results-insight",
    sourceRouteId: "page:results",
    preservationId: "preserve:results-insight-detail",
    integrityAssertionIds: [
      "assert:results-insight-detail:origin-restoration",
      "assert:results-insight-detail:dataset-session-workbook-continuity",
      "assert:results-insight-detail:mode-continuity",
      "assert:results-insight-detail:pagination-preservation",
      "assert:results-insight-detail:filter-preservation",
      "assert:results-insight-detail:expanded-panel-preservation",
      "assert:results-insight-detail:selected-result-preservation",
    ],
    activationMode: "controlled-hash-route",
    deepLinkReady: true,
    globalRoutingMigration: false,
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<NavigationRoutedDetailActivation>;

export const navigationRoutedDetailActivationVersion = "s5-3a-routed-detail-activation-v1";

