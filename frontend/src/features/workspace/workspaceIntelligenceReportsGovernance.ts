import type { CompositionBoundaryContract } from "../governance/boundaryTypes";

export const workspaceIntelligenceReportsGovernance = {
  mode: "composition",
  contractId: "workspace-intelligence-reports",
  label: "Workspace intelligence reports",
  description:
    "Safe composition layer that assembles deterministic advisory reports without owning execution side effects.",
  confidence: "high",
  canExecuteDirectly: false,
  mayWireCallbacks: true,
  composedModes: ["advisory"],
} satisfies CompositionBoundaryContract;
