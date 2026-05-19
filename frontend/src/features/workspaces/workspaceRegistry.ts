import {
  createWorkspaceLifecycleDescriptor,
  type WorkspaceLifecycleDescriptor,
} from "./workspaceLifecycle";
import {
  createWorkspaceOwnershipDescriptor,
  type WorkspaceOwnershipDescriptor,
} from "./workspaceOwnership";
import {
  createWorkspacePreservationExpectation,
  type WorkspacePreservationExpectation,
} from "./workspacePreservation";
import {
  summarizeWorkspaceReadiness,
  type WorkspaceReadinessDescriptor,
} from "./workspaceReadiness";
import type { WorkspaceShellContract } from "./workspaceTypes";

export type WorkspaceRegistryEntry = {
  readonly shell: WorkspaceShellContract;
  readonly lifecycle: WorkspaceLifecycleDescriptor;
  readonly ownership: WorkspaceOwnershipDescriptor;
  readonly preservation: WorkspacePreservationExpectation;
  readonly readiness: WorkspaceReadinessDescriptor;
  readonly metadataOnly: true;
};

const workspaceShells = [
  {
    workspaceId: "workspace:investigation",
    category: "investigation_workspace",
    owner: "results",
    label: "Investigation Workspace",
    lifecycleState: "governance_ready",
    routeReady: false,
    preservationReady: true,
    integrityReady: true,
    active: false,
    metadataOnly: true,
  },
  {
    workspaceId: "workspace:explainability",
    category: "explainability_workspace",
    owner: "explainability",
    label: "Explainability Workspace",
    lifecycleState: "governance_ready",
    routeReady: false,
    preservationReady: true,
    integrityReady: true,
    active: false,
    metadataOnly: true,
  },
  {
    workspaceId: "workspace:executive",
    category: "executive_workspace",
    owner: "executive",
    label: "Executive Workspace",
    lifecycleState: "future_candidate",
    routeReady: false,
    preservationReady: false,
    integrityReady: false,
    active: false,
    metadataOnly: true,
  },
  {
    workspaceId: "workspace:analyst-governed",
    category: "analyst_workspace",
    owner: "analyst",
    label: "Analyst Workspace Governance",
    lifecycleState: "partially_defined",
    routeReady: false,
    preservationReady: false,
    integrityReady: false,
    active: false,
    metadataOnly: true,
  },
  {
    workspaceId: "workspace:orchestration-planning",
    category: "orchestration_workspace",
    owner: "orchestration",
    label: "Orchestration Planning Workspace",
    lifecycleState: "inactive",
    routeReady: false,
    preservationReady: false,
    integrityReady: false,
    active: false,
    metadataOnly: true,
  },
  {
    workspaceId: "workspace:future-consumer",
    category: "future_workspace",
    owner: "future_consumer",
    label: "Future Consumer Workspace",
    lifecycleState: "future_candidate",
    routeReady: false,
    preservationReady: false,
    integrityReady: false,
    active: false,
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<WorkspaceShellContract>;

export const workspaceRegistry = workspaceShells.map((shell) => ({
  shell,
  lifecycle: createWorkspaceLifecycleDescriptor(shell),
  ownership: createWorkspaceOwnershipDescriptor(shell),
  preservation: createWorkspacePreservationExpectation(shell),
  readiness: summarizeWorkspaceReadiness(shell),
  metadataOnly: true,
})) satisfies ReadonlyArray<WorkspaceRegistryEntry>;

export const workspaceRegistryVersion = "s5-4a-workspace-registry-v1";

