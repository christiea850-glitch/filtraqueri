import type { NavigationIntegrityAssertion } from "./integrityTypes";
import type { NavigationPreservationRegistryEntry } from "./preservationRegistry";
import type { NavigationRoutedDetailActivation } from "./routedDetailActivation";
import type { NavigationRouteRegistryEntry } from "./navigationTypes";

export type RouteActivationIntegrityIssue = {
  readonly activationId: string;
  readonly ruleId: string;
  readonly message: string;
  readonly metadataOnly: true;
};

export type RouteActivationIntegrityCheckInput = {
  readonly activation: NavigationRoutedDetailActivation;
  readonly routes: ReadonlyArray<NavigationRouteRegistryEntry>;
  readonly preservations: ReadonlyArray<NavigationPreservationRegistryEntry>;
  readonly assertions: ReadonlyArray<NavigationIntegrityAssertion>;
};

const createIssue = (
  activationId: string,
  ruleId: string,
  message: string,
): RouteActivationIntegrityIssue => ({
  activationId,
  ruleId,
  message,
  metadataOnly: true,
});

export const checkRouteActivationIntegrity = ({
  activation,
  routes,
  preservations,
  assertions,
}: RouteActivationIntegrityCheckInput): ReadonlyArray<RouteActivationIntegrityIssue> => {
  const route = routes.find((entry) => entry.routeId === activation.routeId) || null;
  const sourceRoute = routes.find((entry) => entry.routeId === activation.sourceRouteId) || null;
  const preservation =
    preservations.find((entry) => entry.preservationId === activation.preservationId) || null;
  const assertionIds = new Set(assertions.map((assertion) => assertion.assertionId));
  const issues: RouteActivationIntegrityIssue[] = [];

  if (!route) {
    issues.push(createIssue(activation.activationId, "missing-route", "Activated detail route is not registered."));
  } else if (route.routeKind !== "detail") {
    issues.push(createIssue(activation.activationId, "invalid-route-kind", "Activated route must be a detail route."));
  } else if (route.owningSurface !== activation.owningSurface) {
    issues.push(
      createIssue(activation.activationId, "owner-mismatch", "Activation owning surface must match the registered route owner."),
    );
  }

  if (!sourceRoute) {
    issues.push(createIssue(activation.activationId, "missing-source-route", "Activated source route is not registered."));
  }

  if (!preservation) {
    issues.push(
      createIssue(activation.activationId, "missing-preservation", "Activation preservation metadata is not registered."),
    );
  } else {
    if (preservation.sourceRouteId !== activation.sourceRouteId) {
      issues.push(
        createIssue(activation.activationId, "source-route-mismatch", "Preservation source route does not match activation source route."),
      );
    }

    if (preservation.targetRouteId !== activation.routeId) {
      issues.push(
        createIssue(activation.activationId, "target-route-mismatch", "Preservation target route does not match activation route."),
      );
    }

    if (preservation.scope !== "inline-preview-to-detail") {
      issues.push(
        createIssue(activation.activationId, "unsupported-preservation-scope", "Controlled routed activation must start from inline-preview-to-detail preservation."),
      );
    }
  }

  for (const assertionId of activation.integrityAssertionIds) {
    if (assertionIds.has(assertionId)) continue;

    issues.push(
      createIssue(activation.activationId, "missing-integrity-assertion", `Missing integrity assertion "${assertionId}".`),
    );
  }

  if (activation.globalRoutingMigration) {
    issues.push(
      createIssue(activation.activationId, "global-routing-migration", "Controlled activation must not declare global routing migration."),
    );
  }

  if (!activation.metadataOnly) {
    issues.push(createIssue(activation.activationId, "not-metadata-only", "Activation must remain metadata-only."));
  }

  return issues.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
};
