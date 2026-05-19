import { routeGovernanceSnapshot } from "../navigation";
import { workspaceGovernanceSnapshot } from "../workspaces";

export type S6GovernanceReadSurface = {
  readonly surfaceId: "s6-governance-read-surface";
  readonly route: typeof routeGovernanceSnapshot;
  readonly workspace: typeof workspaceGovernanceSnapshot;
  readonly investigationActivationPlanningReady: boolean;
  readonly workspaceRoutingActive: false;
  readonly orchestrationActive: false;
  readonly persistenceActive: false;
  readonly createsNewGovernanceLayer: false;
  readonly metadataOnly: true;
};

export const s6GovernanceReadSurface: S6GovernanceReadSurface = {
  surfaceId: "s6-governance-read-surface",
  route: routeGovernanceSnapshot,
  workspace: workspaceGovernanceSnapshot,
  investigationActivationPlanningReady:
    routeGovernanceSnapshot.futureActivationReadiness === "active_route_governance_verified" &&
    workspaceGovernanceSnapshot.posture === "workspace_governance_observable",
  workspaceRoutingActive: false,
  orchestrationActive: false,
  persistenceActive: false,
  createsNewGovernanceLayer: false,
  metadataOnly: true,
};

