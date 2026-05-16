import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const businessSemanticGovernance = {
  mode: "advisory",
  contractId: "business-semantics",
  label: "Business semantics",
  description:
    "Deterministic semantic classification and business context derived from dataset and profile metadata.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "diagnostic", "readiness"],
} satisfies AdvisoryBoundaryContract;
