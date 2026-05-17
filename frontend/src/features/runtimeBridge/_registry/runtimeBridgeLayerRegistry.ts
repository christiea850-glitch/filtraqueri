export type RuntimeBridgeRegistryLayer =
  | "kernel"
  | "foundation"
  | "intelligence"
  | "visualization"
  | "orchestration"
  | "governance"
  | "federation"
  | "lifecycle"
  | "resilience"
  | "observability";

export type RuntimeBridgeLayerRegistryEntry = {
  readonly layer: RuntimeBridgeRegistryLayer;
  readonly rank: number;
  readonly label: string;
  readonly description: string;
  readonly allowedDependencyLayers: ReadonlyArray<RuntimeBridgeRegistryLayer>;
  readonly metadataOnly: true;
};

export const runtimeBridgeLayerRegistry = [
  {
    layer: "kernel",
    rank: 0,
    label: "Kernel",
    description: "Metadata-only shared Runtime Bridge utility and descriptor helpers.",
    allowedDependencyLayers: ["kernel", "foundation"],
    metadataOnly: true,
  },
  {
    layer: "foundation",
    rank: 1,
    label: "Foundation",
    description: "Bridge schemas, IDs, adapters, composition, lineage, integrity, registry, and base governance metadata.",
    allowedDependencyLayers: ["kernel", "foundation"],
    metadataOnly: true,
  },
  {
    layer: "intelligence",
    rank: 2,
    label: "Intelligence",
    description: "Explainability, interpretation, recommendation, decision support, and narrative packaging metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "intelligence"],
    metadataOnly: true,
  },
  {
    layer: "visualization",
    rank: 3,
    label: "Visualization",
    description: "Visualization intent, dashboard narrative, and dashboard composition planning metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "intelligence", "visualization"],
    metadataOnly: true,
  },
  {
    layer: "orchestration",
    rank: 4,
    label: "Orchestration",
    description: "Planning-only orchestration, presentation sequencing, and synchronization posture metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "intelligence", "visualization", "orchestration"],
    metadataOnly: true,
  },
  {
    layer: "governance",
    rank: 5,
    label: "Governance",
    description: "Review-chain, compliance, consolidation, and audit-readiness governance metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "intelligence", "orchestration", "governance"],
    metadataOnly: true,
  },
  {
    layer: "federation",
    rank: 6,
    label: "Federation",
    description: "Delivery ecosystem and enterprise federation continuity metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "intelligence", "visualization", "orchestration", "federation"],
    metadataOnly: true,
  },
  {
    layer: "lifecycle",
    rank: 7,
    label: "Lifecycle",
    description: "Enterprise lifecycle continuity and cross-session lineage posture metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "federation", "lifecycle"],
    metadataOnly: true,
  },
  {
    layer: "resilience",
    rank: 8,
    label: "Resilience",
    description: "Enterprise resilience governance, continuity posture, and survivability metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "lifecycle", "resilience"],
    metadataOnly: true,
  },
  {
    layer: "observability",
    rank: 9,
    label: "Observability",
    description: "Enterprise observability, traceability, audit federation, and trust governance metadata.",
    allowedDependencyLayers: ["kernel", "foundation", "resilience", "observability"],
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<RuntimeBridgeLayerRegistryEntry>;

export const runtimeBridgeApprovedLayers = runtimeBridgeLayerRegistry.map((entry) => entry.layer);
