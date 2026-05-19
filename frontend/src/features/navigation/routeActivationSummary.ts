import type { NavigationIntegrityAssertion } from "./integrityTypes";
import type { NavigationPreservationRegistryEntry } from "./preservationRegistry";
import type { RouteActivationIntegrityRegistryEntry } from "./routeActivationIntegrityRegistry";
import type { NavigationRouteRegistryEntry } from "./navigationTypes";

export type RouteActivationReadinessState =
  | "active"
  | "governance_ready"
  | "partially_linked"
  | "inactive"
  | "pattern_template"
  | "future_workspace_candidate";

export type RouteActivationSummary = {
  readonly summaryId: string;
  readonly routeId: string;
  readonly routeLabel: string;
  readonly activationId: string | null;
  readonly preservationId: string | null;
  readonly integrityAssertionIds: ReadonlyArray<string>;
  readonly activationScope: "controlled-hash-route" | "not-activated" | "future-workspace";
  readonly owningSurface: string;
  readonly readiness: RouteActivationReadinessState;
  readonly preservationDescriptorLinked: boolean;
  readonly integrityLinked: boolean;
  readonly ownershipLinked: boolean;
  readonly unsupportedState: boolean;
  readonly metadataOnly: true;
};

export type RouteActivationSummaryInput = {
  readonly routes: ReadonlyArray<NavigationRouteRegistryEntry>;
  readonly activationIntegrityEntries: ReadonlyArray<RouteActivationIntegrityRegistryEntry>;
  readonly preservations: ReadonlyArray<NavigationPreservationRegistryEntry>;
  readonly assertions: ReadonlyArray<NavigationIntegrityAssertion>;
};

const isFutureWorkspaceCandidate = (route: NavigationRouteRegistryEntry) =>
  route.routeKind === "workspace" && route.routeId !== "workspace:welcome" && route.routeId !== "workspace:sql";

const summarizeInactiveRoute = (route: NavigationRouteRegistryEntry): RouteActivationSummary => ({
  summaryId: `route-activation-summary:${route.routeId}`,
  routeId: route.routeId,
  routeLabel: route.label,
  activationId: null,
  preservationId: null,
  integrityAssertionIds: [],
  activationScope: isFutureWorkspaceCandidate(route) ? "future-workspace" : "not-activated",
  owningSurface: route.owningSurface,
  readiness: route.routeTemplate === "pattern_template"
    ? "pattern_template"
    : isFutureWorkspaceCandidate(route)
      ? "future_workspace_candidate"
      : "inactive",
  preservationDescriptorLinked: false,
  integrityLinked: false,
  ownershipLinked: true,
  unsupportedState: false,
  metadataOnly: true,
});

export const createRouteActivationSummaries = ({
  routes,
  activationIntegrityEntries,
  preservations,
  assertions,
}: RouteActivationSummaryInput): ReadonlyArray<RouteActivationSummary> => {
  const preservationIds = new Set(preservations.map((preservation) => preservation.preservationId));
  const assertionIds = new Set(assertions.map((assertion) => assertion.assertionId));
  const activatedRouteIds = new Set(
    activationIntegrityEntries.map((entry) => entry.activation.routeId),
  );
  const activeSummaries = activationIntegrityEntries.map<RouteActivationSummary>((entry) => {
    const route = routes.find((candidate) => candidate.routeId === entry.activation.routeId) || null;
    const preservationDescriptorLinked = preservationIds.has(entry.activation.preservationId);
    const integrityLinked = entry.activation.integrityAssertionIds.every((assertionId) =>
      assertionIds.has(assertionId),
    );
    const ownershipLinked = route?.owningSurface === entry.activation.owningSurface;
    const unsupportedState = entry.issues.length > 0;
    const readiness: RouteActivationReadinessState = unsupportedState
      ? "partially_linked"
      : entry.activation.hashRouteAddressable
        ? "active"
        : "governance_ready";

    return {
      summaryId: `route-activation-summary:${entry.activation.activationId}`,
      routeId: entry.activation.routeId,
      routeLabel: route?.label || entry.activation.routeId,
      activationId: entry.activation.activationId,
      preservationId: entry.activation.preservationId,
      integrityAssertionIds: entry.activation.integrityAssertionIds,
      activationScope: entry.activation.activationMode,
      owningSurface: entry.activation.owningSurface,
      readiness,
      preservationDescriptorLinked,
      integrityLinked,
      ownershipLinked,
      unsupportedState,
      metadataOnly: true,
    };
  });
  const inactiveSummaries = routes
    .filter((route) => route.routeKind === "detail" && !activatedRouteIds.has(route.routeId))
    .map(summarizeInactiveRoute);

  return [...activeSummaries, ...inactiveSummaries].sort((left, right) =>
    left.summaryId.localeCompare(right.summaryId),
  );
};
