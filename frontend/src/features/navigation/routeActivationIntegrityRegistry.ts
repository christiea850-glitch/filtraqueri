import { navigationIntegrityAssertions } from "./navigationIntegrityRegistry";
import { navigationPreservationRegistry } from "./preservationRegistry";
import {
  navigationRoutedDetailActivations,
  type NavigationRoutedDetailActivation,
} from "./routedDetailActivation";
import { navigationRouteRegistry } from "./routeRegistry";
import {
  checkRouteActivationIntegrity,
  type RouteActivationIntegrityIssue,
} from "./routeActivationChecks";
import {
  summarizeRouteActivationIntegrity,
  type RouteActivationIntegritySummary,
} from "./routeActivationIntegrity";

export type RouteActivationIntegrityRegistryEntry = {
  readonly activation: NavigationRoutedDetailActivation;
  readonly issues: ReadonlyArray<RouteActivationIntegrityIssue>;
  readonly summary: RouteActivationIntegritySummary;
  readonly metadataOnly: true;
};

export const routeActivationIntegrityRegistry = navigationRoutedDetailActivations.map((activation) => {
  const issues = checkRouteActivationIntegrity({
    activation,
    routes: navigationRouteRegistry,
    preservations: navigationPreservationRegistry,
    assertions: navigationIntegrityAssertions,
  });

  return {
    activation,
    issues,
    summary: summarizeRouteActivationIntegrity(activation.activationId, issues),
    metadataOnly: true,
  };
}) satisfies ReadonlyArray<RouteActivationIntegrityRegistryEntry>;

export const routeActivationIntegrityRegistryVersion = "s5-3b-route-activation-integrity-v1";

