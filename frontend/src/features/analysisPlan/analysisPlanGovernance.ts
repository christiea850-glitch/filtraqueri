import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const analysisPlanGovernance = {
  mode: "advisory",
  contractId: "analysis-plan",
  label: "Analysis planning",
  description:
    "Advisory analysis plan construction, validation, readiness labels, and preferred engine guidance.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["plan", "readiness", "recommendation", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
