export type RuntimeBridgeArchitecturePosture =
  | "governance_hardened"
  | "metadata_only_enforced"
  | "runtime_execution_prohibited"
  | "deterministic_compliance_verified"
  | "advisory_runtime_separation_verified"
  | "future_runtime_review_required";

export type RuntimeBridgeIntegrityValue = "verified" | "review_required";

export type RuntimeBridgeArchitecturePostureDescriptor = {
  readonly postureId: RuntimeBridgeArchitecturePosture;
  readonly postureName: string;
  readonly integrity: RuntimeBridgeIntegrityValue;
  readonly supportedBy: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeArchitecturePostureDescriptors = [
  {
    postureId: "governance_hardened",
    postureName: "Governance hardened",
    integrity: "verified",
    supportedBy: ["runtime-bridge-governance-registry-posture", "runtime-bridge-governance-enforcement-posture"],
    summary: "Governance registry and contract enforcement metadata are present and deterministic.",
    metadataOnly: true,
  },
  {
    postureId: "metadata_only_enforced",
    postureName: "Metadata only enforced",
    integrity: "verified",
    supportedBy: ["runtime-bridge-metadata-only-compliance-posture", "runtime-bridge-execution-boundary-posture"],
    summary: "Runtime Bridge manifests and contracts remain metadata-only.",
    metadataOnly: true,
  },
  {
    postureId: "runtime_execution_prohibited",
    postureName: "Runtime execution prohibited",
    integrity: "verified",
    supportedBy: ["runtime-bridge-capability-posture", "runtime-bridge-execution-boundary-posture"],
    summary: "Runtime, rendering, backend, persistence, export, workflow, and agent execution remain prohibited.",
    metadataOnly: true,
  },
  {
    postureId: "deterministic_compliance_verified",
    postureName: "Deterministic compliance verified",
    integrity: "verified",
    supportedBy: ["runtime-bridge-registry-layer-validation", "runtime-bridge-governance-snapshot"],
    summary: "Snapshot and registry identifiers are static slugs with stable sorted summary fields.",
    metadataOnly: true,
  },
  {
    postureId: "advisory_runtime_separation_verified",
    postureName: "Advisory runtime separation verified",
    integrity: "verified",
    supportedBy: ["runtime-bridge-capability-posture", "runtime-bridge-runtime-readiness-posture"],
    summary: "Advisory capabilities are separated from runtime eligibility and executable declarations.",
    metadataOnly: true,
  },
  {
    postureId: "future_runtime_review_required",
    postureName: "Future runtime review required",
    integrity: "review_required",
    supportedBy: ["runtime-bridge-runtime-eligibility-posture", "runtime-bridge-governance-enforcement-posture"],
    summary: "Any future runtime integration requires separate governance review outside Runtime Bridge metadata modules.",
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<RuntimeBridgeArchitecturePostureDescriptor>;

export const runtimeBridgeApprovedArchitecturePostures = runtimeBridgeArchitecturePostureDescriptors.map(
  (descriptor) => descriptor.postureId,
);

export const runtimeBridgeApprovedIntegrityValues = runtimeBridgeArchitecturePostureDescriptors
  .map((descriptor) => descriptor.integrity)
  .filter((integrity, index, values) => values.indexOf(integrity) === index);
