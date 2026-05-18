import type { NavigationContextPreservation } from "./navigationContext";
import type { NavigationRouteReference, NavigationWorkspaceMode } from "./navigationTypes";

export type NavigationPreservationScope =
  | "inline-preview-to-detail"
  | "detail-to-dashboard"
  | "future-workspace-return"
  | "future-deep-link-restoration";

export type NavigationPreservationVersion = "s5-2c-preservation-v1";

export type NavigationFilterStateReference = {
  readonly activeFilterLabels: ReadonlyArray<string>;
  readonly filterCount: number;
};

export type NavigationPaginationStateReference = {
  readonly page: number | null;
  readonly totalPages: number | null;
  readonly rowsPerPage: number | null;
};

export type NavigationExpandedPanelStateReference = {
  readonly expandedPanelIds: ReadonlyArray<string>;
  readonly collapsedPanelIds: ReadonlyArray<string>;
};

export type NavigationSelectedItemReference = {
  readonly selectedItemId: string | null;
  readonly selectedItemLabel: string | null;
  readonly selectedItemType: string | null;
};

export type NavigationPreservationIdentity = {
  readonly preservationId: string;
  readonly version: NavigationPreservationVersion;
  readonly scope: NavigationPreservationScope;
};

export type NavigationOriginDescriptor = NavigationPreservationIdentity & {
  readonly originSurfaceId: string;
  readonly sourceRoute: NavigationRouteReference;
  readonly targetRoute: NavigationRouteReference;
  readonly mode: NavigationWorkspaceMode;
  readonly context: NavigationContextPreservation;
};

export type NavigationBackStateDescriptor = NavigationPreservationIdentity & {
  readonly origin: NavigationOriginDescriptor;
  readonly filterState: NavigationFilterStateReference;
  readonly paginationState: NavigationPaginationStateReference;
  readonly expandedPanelState: NavigationExpandedPanelStateReference;
  readonly selectedItem: NavigationSelectedItemReference;
};

