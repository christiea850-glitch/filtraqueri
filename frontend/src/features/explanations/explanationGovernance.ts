import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const explanationGovernance = {
  mode: "advisory",
  contractId: "explanation-layer",
  label: "Explanation layer",
  description:
    "Advisory business explanations, expected outputs, and potential insight templates derived from local metadata.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["explanation", "summary", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
