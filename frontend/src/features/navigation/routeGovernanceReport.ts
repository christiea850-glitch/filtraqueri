import { navigationIntegrityAssertions } from "./navigationIntegrityRegistry";
import { navigationPreservationRegistry } from "./preservationRegistry";
import { routeActivationIntegrityRegistry } from "./routeActivationIntegrityRegistry";
import { createRouteActivationSummaries, type RouteActivationSummary } from "./routeActivationSummary";
import { navigationRouteRegistry } from "./routeRegistry";

export type RouteGovernanceReport = {
  readonly reportId: string;
  readonly activeRoutedDetailFlowCount: number;
  readonly inactiveRoutedFlowCount: number;
  readonly patternTemplateRouteCount: number;
  readonly preservationDescriptorLinkedCount: number;
  readonly integrityLinkedCount: number;
  readonly ownershipLinkedCount: number;
  readonly governanceReadyCount: number;
  readonly partiallyLinkedCount: number;
  readonly futureWorkspaceCandidateCount: number;
  readonly unsupportedActivationCount: number;
  readonly activeRoutedDetailFlows: ReadonlyArray<RouteActivationSummary>;
  readonly inactiveRoutedFlows: ReadonlyArray<RouteActivationSummary>;
  readonly unsupportedActivationStates: ReadonlyArray<RouteActivationSummary>;
  readonly metadataOnly: true;
};

export const createRouteGovernanceReport = (
  summaries: ReadonlyArray<RouteActivationSummary>,
): RouteGovernanceReport => {
  const activeRoutedDetailFlows = summaries.filter((summary) => summary.readiness === "active");
  const inactiveRoutedFlows = summaries.filter((summary) => summary.readiness === "inactive");
  const patternTemplateRoutes = summaries.filter((summary) => summary.readiness === "pattern_template");
  const unsupportedActivationStates = summaries.filter((summary) => summary.unsupportedState);

  return {
    reportId: "route-governance-report:s5-3d",
    activeRoutedDetailFlowCount: activeRoutedDetailFlows.length,
    inactiveRoutedFlowCount: inactiveRoutedFlows.length,
    patternTemplateRouteCount: patternTemplateRoutes.length,
    preservationDescriptorLinkedCount: summaries.filter((summary) => summary.preservationDescriptorLinked).length,
    integrityLinkedCount: summaries.filter((summary) => summary.integrityLinked).length,
    ownershipLinkedCount: summaries.filter((summary) => summary.ownershipLinked).length,
    governanceReadyCount: summaries.filter((summary) => summary.readiness === "governance_ready").length,
    partiallyLinkedCount: summaries.filter((summary) => summary.readiness === "partially_linked").length,
    futureWorkspaceCandidateCount: summaries.filter(
      (summary) => summary.readiness === "future_workspace_candidate",
    ).length,
    unsupportedActivationCount: unsupportedActivationStates.length,
    activeRoutedDetailFlows,
    inactiveRoutedFlows,
    unsupportedActivationStates,
    metadataOnly: true,
  };
};

export const routeActivationGovernanceSummaries = createRouteActivationSummaries({
  routes: navigationRouteRegistry,
  activationIntegrityEntries: routeActivationIntegrityRegistry,
  preservations: navigationPreservationRegistry,
  assertions: navigationIntegrityAssertions,
});

export const routeGovernanceReport = createRouteGovernanceReport(routeActivationGovernanceSummaries);

export const routeGovernanceReportVersion = "s5-3d-route-governance-report-v1";
