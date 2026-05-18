import type { NavigationPreservationScope } from "./navigationPreservationTypes";

export type NavigationPreservationRegistryEntry = {
  readonly preservationId: string;
  readonly scope: NavigationPreservationScope;
  readonly originSurfaceId: string;
  readonly sourceRouteId: string;
  readonly targetRouteId: string;
  readonly preservesFilters: boolean;
  readonly preservesPagination: boolean;
  readonly preservesExpandedPanels: boolean;
  readonly preservesSelectedItem: boolean;
  readonly preservesDatasetSessionWorkbook: boolean;
  readonly metadataOnly: true;
};

export const navigationPreservationRegistry = [
  {
    preservationId: "preserve:results-insight-detail",
    scope: "inline-preview-to-detail",
    originSurfaceId: "results-investigation-surface",
    sourceRouteId: "page:results",
    targetRouteId: "detail:results-insight",
    preservesFilters: true,
    preservesPagination: true,
    preservesExpandedPanels: true,
    preservesSelectedItem: true,
    preservesDatasetSessionWorkbook: true,
    metadataOnly: true,
  },
  {
    preservationId: "preserve:dataset-intelligence-detail",
    scope: "inline-preview-to-detail",
    originSurfaceId: "dataset-summary-panel",
    sourceRouteId: "page:dataset",
    targetRouteId: "detail:dataset-intelligence",
    preservesFilters: true,
    preservesPagination: true,
    preservesExpandedPanels: true,
    preservesSelectedItem: true,
    preservesDatasetSessionWorkbook: true,
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<NavigationPreservationRegistryEntry>;

export const navigationPreservationRegistryVersion = "s5-2d-preservation-registry-v1";
