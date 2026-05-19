import type { NavigationOwningSurface } from "./navigationTypes";

export type NavigationRoutedDetailActivation = {
  readonly activationId: string;
  readonly routeId: string;
  readonly sourceRouteId: string;
  readonly preservationId: string;
  readonly owningSurface: NavigationOwningSurface;
  readonly integrityAssertionIds: ReadonlyArray<string>;
  readonly activationMode: "controlled-hash-route";
  readonly hashRouteAddressable: boolean;
  readonly restorationCapability: "hash_addressable_only";
  readonly globalRoutingMigration: false;
  readonly metadataOnly: true;
};

export const navigationRoutedDetailActivations = [
  {
    activationId: "activate:results-insight-detail",
    routeId: "detail:results-insight",
    sourceRouteId: "page:results",
    preservationId: "preserve:results-insight-detail",
    owningSurface: "results",
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
    hashRouteAddressable: true,
    restorationCapability: "hash_addressable_only",
    globalRoutingMigration: false,
    metadataOnly: true,
  },
  {
    activationId: "activate:dataset-intelligence-detail",
    routeId: "detail:dataset-intelligence",
    sourceRouteId: "page:dataset",
    preservationId: "preserve:dataset-intelligence-detail",
    owningSurface: "dataset",
    integrityAssertionIds: [
      "assert:dataset-intelligence-detail:origin-restoration",
      "assert:dataset-intelligence-detail:dataset-session-workbook-continuity",
      "assert:dataset-intelligence-detail:mode-continuity",
      "assert:dataset-intelligence-detail:pagination-preservation",
      "assert:dataset-intelligence-detail:filter-preservation",
      "assert:dataset-intelligence-detail:expanded-panel-preservation",
      "assert:dataset-intelligence-detail:selected-result-preservation",
    ],
    activationMode: "controlled-hash-route",
    hashRouteAddressable: true,
    restorationCapability: "hash_addressable_only",
    globalRoutingMigration: false,
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<NavigationRoutedDetailActivation>;

export const navigationRoutedDetailActivationVersion = "s5-3c-routed-detail-activation-v1";
