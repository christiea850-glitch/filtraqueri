import type { RuntimeBridgeRegistryLayer } from "./runtimeBridgeLayerRegistry";

export type RuntimeBridgeDomainRegistryEntry = {
  readonly domainId: string;
  readonly domainName: string;
  readonly layerIds: ReadonlyArray<RuntimeBridgeRegistryLayer>;
  readonly moduleIds: ReadonlyArray<string>;
  readonly metadataOnly: true;
  readonly architecturalRole: string;
  readonly reviewStatus: "representative_subset" | "pending_expansion";
};

export const runtimeBridgeDomainRegistry = [
  {
    domainId: "runtime-bridge-kernel-domain",
    domainName: "Runtime Bridge kernel",
    layerIds: ["kernel"],
    moduleIds: [
      "runtime-bridge-kernel-types",
      "runtime-bridge-kernel-utils",
      "runtime-bridge-kernel-governance",
    ],
    metadataOnly: true,
    architecturalRole: "Shared deterministic metadata utilities and descriptor helpers.",
    reviewStatus: "representative_subset",
  },
  {
    domainId: "runtime-bridge-enterprise-continuity-domain",
    domainName: "Runtime Bridge enterprise continuity",
    layerIds: ["lifecycle", "resilience", "observability"],
    moduleIds: [
      "runtime-bridge-enterprise-lifecycle-continuity",
      "runtime-bridge-enterprise-resilience-governance",
      "runtime-bridge-enterprise-observability-traceability",
    ],
    metadataOnly: true,
    architecturalRole: "Enterprise continuity, resilience, and observability metadata chain.",
    reviewStatus: "representative_subset",
  },
  {
    domainId: "runtime-bridge-governance-domain",
    domainName: "Runtime Bridge governance",
    layerIds: ["governance"],
    moduleIds: ["runtime-bridge-intelligence-review-governance"],
    metadataOnly: true,
    architecturalRole: "Review governance and audit-readiness metadata.",
    reviewStatus: "representative_subset",
  },
  {
    domainId: "runtime-bridge-visualization-domain",
    domainName: "Runtime Bridge visualization planning",
    layerIds: ["visualization"],
    moduleIds: ["runtime-bridge-visualization-planning"],
    metadataOnly: true,
    architecturalRole: "Visualization intent and dashboard planning metadata.",
    reviewStatus: "representative_subset",
  },
] as const satisfies ReadonlyArray<RuntimeBridgeDomainRegistryEntry>;
