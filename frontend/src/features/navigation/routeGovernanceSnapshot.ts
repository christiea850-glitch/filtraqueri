import { navigationIntegrityRegistryVersion } from "./navigationIntegrityRegistry";
import { navigationPreservationRegistryVersion } from "./preservationRegistry";
import { routeActivationIntegrityRegistryVersion } from "./routeActivationIntegrityRegistry";
import { routeGovernanceReport, routeGovernanceReportVersion } from "./routeGovernanceReport";
import { navigationRoutedDetailActivationVersion } from "./routedDetailActivation";
import { navigationRouteRegistryVersion } from "./routeRegistry";

export type RouteGovernanceSnapshotReadiness =
  | "active_route_governance_verified"
  | "route_governance_review_required";

export type RouteGovernanceSnapshot = {
  readonly snapshotId: "route-governance-snapshot:s5-3d";
  readonly snapshotVersion: "s5-3d-route-governance-snapshot-v1";
  readonly registryVersions: {
    readonly routeRegistry: string;
    readonly routedDetailActivation: string;
    readonly preservationRegistry: string;
    readonly integrityRegistry: string;
    readonly activationIntegrityRegistry: string;
    readonly governanceReport: string;
  };
  readonly activeRoutedDetailFlowCount: number;
  readonly inactiveRoutedFlowCount: number;
  readonly patternTemplateRouteCount: number;
  readonly unsupportedActivationCount: number;
  readonly preservationDescriptorCoverage: "linked" | "review_required";
  readonly integrityCoverage: "linked" | "review_required";
  readonly ownershipCoverage: "linked" | "review_required";
  readonly futureActivationReadiness: RouteGovernanceSnapshotReadiness;
  readonly workspaceRoutingActive: false;
  readonly globalRoutingMigrationActive: false;
  readonly metadataOnly: true;
};

export const routeGovernanceSnapshot: RouteGovernanceSnapshot = {
  snapshotId: "route-governance-snapshot:s5-3d",
  snapshotVersion: "s5-3d-route-governance-snapshot-v1",
  registryVersions: {
    routeRegistry: navigationRouteRegistryVersion,
    routedDetailActivation: navigationRoutedDetailActivationVersion,
    preservationRegistry: navigationPreservationRegistryVersion,
    integrityRegistry: navigationIntegrityRegistryVersion,
    activationIntegrityRegistry: routeActivationIntegrityRegistryVersion,
    governanceReport: routeGovernanceReportVersion,
  },
  activeRoutedDetailFlowCount: routeGovernanceReport.activeRoutedDetailFlowCount,
  inactiveRoutedFlowCount: routeGovernanceReport.inactiveRoutedFlowCount,
  patternTemplateRouteCount: routeGovernanceReport.patternTemplateRouteCount,
  unsupportedActivationCount: routeGovernanceReport.unsupportedActivationCount,
  preservationDescriptorCoverage:
    routeGovernanceReport.preservationDescriptorLinkedCount >= routeGovernanceReport.activeRoutedDetailFlowCount
      ? "linked"
      : "review_required",
  integrityCoverage:
    routeGovernanceReport.integrityLinkedCount >= routeGovernanceReport.activeRoutedDetailFlowCount
      ? "linked"
      : "review_required",
  ownershipCoverage:
    routeGovernanceReport.ownershipLinkedCount >= routeGovernanceReport.activeRoutedDetailFlowCount
      ? "linked"
      : "review_required",
  futureActivationReadiness:
    routeGovernanceReport.unsupportedActivationCount === 0
      ? "active_route_governance_verified"
      : "route_governance_review_required",
  workspaceRoutingActive: false,
  globalRoutingMigrationActive: false,
  metadataOnly: true,
};
