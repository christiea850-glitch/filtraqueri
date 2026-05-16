import type { AdvisoryBoundaryContract } from "../governance/boundaryTypes";

export const analyticsIntentGraphGovernance = {
  mode: "advisory",
  contractId: "analytics-intent-graph",
  label: "Analytics intent graph",
  description:
    "Advisory intent graph construction, validation, selectors, and non-executing relationship guidance.",
  confidence: "high",
  canExecute: false,
  canMutateResults: false,
  canCallBackend: false,
  canPersistRuntimeState: false,
  allowedOutputs: ["summary", "recommendation", "lineage_reference", "diagnostic"],
} satisfies AdvisoryBoundaryContract;
