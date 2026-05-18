import type {
  NavigationBackStateDescriptor,
  NavigationExpandedPanelStateReference,
  NavigationFilterStateReference,
  NavigationOriginDescriptor,
  NavigationPaginationStateReference,
  NavigationSelectedItemReference,
} from "./navigationPreservationTypes";

export type CreateNavigationBackStateInput = {
  readonly preservationId: string;
  readonly origin: NavigationOriginDescriptor;
  readonly filterState: NavigationFilterStateReference;
  readonly paginationState: NavigationPaginationStateReference;
  readonly expandedPanelState: NavigationExpandedPanelStateReference;
  readonly selectedItem: NavigationSelectedItemReference;
};

export const createNavigationBackStateDescriptor = ({
  preservationId,
  origin,
  filterState,
  paginationState,
  expandedPanelState,
  selectedItem,
}: CreateNavigationBackStateInput): NavigationBackStateDescriptor => ({
  preservationId,
  version: "s5-2c-preservation-v1",
  scope: "detail-to-dashboard",
  origin,
  filterState,
  paginationState,
  expandedPanelState,
  selectedItem,
});

