import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const businessQuestionGovernance = {
  mode: "advisory",
  contractId: "business-question-intelligence",
  label: "Business question intelligence",
  description:
    "Advisory business question classification, validation, selectors, and guided question metadata.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
