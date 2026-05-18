import type { NavigationContextPreservation } from "./navigationContext";
import type { NavigationRouteReference } from "./navigationTypes";

export type NavigationScrollPosition = {
  readonly x: number;
  readonly y: number;
};

export type NavigationPaginationState = {
  readonly page: number | null;
  readonly rowsPerPage: number | null;
};

export type NavigationBackBehaviorState = {
  readonly previousRoute: NavigationRouteReference | null;
  readonly scrollPosition: NavigationScrollPosition | null;
  readonly selectedItemId: string | null;
  readonly filters: ReadonlyArray<string>;
  readonly pagination: NavigationPaginationState | null;
  readonly expandedPanelIds: ReadonlyArray<string>;
  readonly context: NavigationContextPreservation;
};

export type NavigationBackBehaviorPolicy = {
  readonly preserveScrollPosition: boolean;
  readonly preserveSelectedItem: boolean;
  readonly preserveFilters: boolean;
  readonly preservePagination: boolean;
  readonly preserveExpandedPanels: boolean;
  readonly preserveDatasetContext: boolean;
  readonly preserveSessionContext: boolean;
  readonly preserveWorkbookContext: boolean;
};

export const defaultNavigationBackBehaviorPolicy: NavigationBackBehaviorPolicy = {
  preserveScrollPosition: true,
  preserveSelectedItem: true,
  preserveFilters: true,
  preservePagination: true,
  preserveExpandedPanels: true,
  preserveDatasetContext: true,
  preserveSessionContext: true,
  preserveWorkbookContext: true,
};

