import type { NavigationContextPreservation } from "./navigationContext";
import type {
  NavigationOriginDescriptor,
  NavigationPreservationScope,
} from "./navigationPreservationTypes";
import type { NavigationRouteReference, NavigationWorkspaceMode } from "./navigationTypes";

export type CreateNavigationOriginInput = {
  readonly preservationId: string;
  readonly scope: NavigationPreservationScope;
  readonly originSurfaceId: string;
  readonly sourceRoute: NavigationRouteReference;
  readonly targetRoute: NavigationRouteReference;
  readonly mode: NavigationWorkspaceMode;
  readonly context: NavigationContextPreservation;
};

export const createNavigationOriginDescriptor = ({
  preservationId,
  scope,
  originSurfaceId,
  sourceRoute,
  targetRoute,
  mode,
  context,
}: CreateNavigationOriginInput): NavigationOriginDescriptor => ({
  preservationId,
  version: "s5-2c-preservation-v1",
  scope,
  originSurfaceId,
  sourceRoute,
  targetRoute,
  mode,
  context,
});

