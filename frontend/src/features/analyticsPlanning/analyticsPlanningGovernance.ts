import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const analyticsPlanningGovernance = {
  mode: "advisory",
  contractId: "analytics-planning",
  label: "Analytics planning",
  description:
    "Advisory analytics plan construction, validation, selectors, and planning recommendations.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["plan", "recommendation", "readiness", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
