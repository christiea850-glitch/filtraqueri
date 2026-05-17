export type RuntimeBridgeRuntimeReadinessClassification =
  | "metadata_only"
  | "advisory_ready"
  | "runtime_candidate"
  | "execution_prohibited"
  | "governance_review_required"
  | "future_runtime_possible";

export type RuntimeBridgeRuntimeReadinessDescriptor = {
  readonly readinessId: RuntimeBridgeRuntimeReadinessClassification;
  readonly readinessName: string;
  readonly runtimeEligible: boolean;
  readonly governanceRequired: boolean;
  readonly executionProhibited: boolean;
  readonly summary: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeRuntimeReadinessDescriptors = [
  {
    readinessId: "metadata_only",
    readinessName: "Metadata only",
    runtimeEligible: false,
    governanceRequired: false,
    executionProhibited: true,
    summary: "Metadata descriptors only; runtime execution is prohibited.",
    metadataOnly: true,
  },
  {
    readinessId: "advisory_ready",
    readinessName: "Advisory ready",
    runtimeEligible: false,
    governanceRequired: true,
    executionProhibited: true,
    summary: "Advisory metadata can inform review but cannot execute runtime behavior.",
    metadataOnly: true,
  },
  {
    readinessId: "runtime_candidate",
    readinessName: "Runtime candidate",
    runtimeEligible: true,
    governanceRequired: true,
    executionProhibited: false,
    summary: "Potential future runtime candidate outside Runtime Bridge metadata modules.",
    metadataOnly: true,
  },
  {
    readinessId: "execution_prohibited",
    readinessName: "Execution prohibited",
    runtimeEligible: false,
    governanceRequired: true,
    executionProhibited: true,
    summary: "Execution is explicitly prohibited by the Runtime Bridge metadata boundary.",
    metadataOnly: true,
  },
  {
    readinessId: "governance_review_required",
    readinessName: "Governance review required",
    runtimeEligible: false,
    governanceRequired: true,
    executionProhibited: true,
    summary: "Future use requires governance review before any runtime integration.",
    metadataOnly: true,
  },
  {
    readinessId: "future_runtime_possible",
    readinessName: "Future runtime possible",
    runtimeEligible: false,
    governanceRequired: true,
    executionProhibited: true,
    summary: "Future runtime integration may be possible only through separate governed executable surfaces.",
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<RuntimeBridgeRuntimeReadinessDescriptor>;
