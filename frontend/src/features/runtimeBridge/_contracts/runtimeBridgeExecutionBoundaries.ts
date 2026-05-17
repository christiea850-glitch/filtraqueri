export type RuntimeBridgeExecutionBoundaryKind =
  | "metadata_boundary"
  | "runtime_boundary"
  | "orchestration_boundary"
  | "persistence_boundary"
  | "rendering_boundary"
  | "backend_boundary"
  | "agent_boundary"
  | "export_boundary";

export type RuntimeBridgeExecutionBoundaryDescriptor = {
  readonly boundaryId: RuntimeBridgeExecutionBoundaryKind;
  readonly boundaryName: string;
  readonly executable: boolean;
  readonly metadataOnlyCompatible: boolean;
  readonly prohibitedForRuntimeBridgeMetadata: boolean;
  readonly summary: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeExecutionBoundaryDescriptors = [
  {
    boundaryId: "metadata_boundary",
    boundaryName: "Metadata boundary",
    executable: false,
    metadataOnlyCompatible: true,
    prohibitedForRuntimeBridgeMetadata: false,
    summary: "Serializable metadata-only descriptors without runtime side effects.",
    metadataOnly: true,
  },
  {
    boundaryId: "runtime_boundary",
    boundaryName: "Runtime boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "Runtime execution boundary reserved for future explicit executable systems.",
    metadataOnly: true,
  },
  {
    boundaryId: "orchestration_boundary",
    boundaryName: "Orchestration boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "Workflow or orchestration runtime boundary, prohibited inside Runtime Bridge metadata.",
    metadataOnly: true,
  },
  {
    boundaryId: "persistence_boundary",
    boundaryName: "Persistence boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "Storage or session persistence boundary, prohibited inside Runtime Bridge metadata.",
    metadataOnly: true,
  },
  {
    boundaryId: "rendering_boundary",
    boundaryName: "Rendering boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "UI, chart, SVG, or canvas rendering boundary, prohibited inside Runtime Bridge metadata.",
    metadataOnly: true,
  },
  {
    boundaryId: "backend_boundary",
    boundaryName: "Backend boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "Backend API or service invocation boundary, prohibited inside Runtime Bridge metadata.",
    metadataOnly: true,
  },
  {
    boundaryId: "agent_boundary",
    boundaryName: "Agent boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "Autonomous agent boundary, prohibited inside Runtime Bridge metadata.",
    metadataOnly: true,
  },
  {
    boundaryId: "export_boundary",
    boundaryName: "Export boundary",
    executable: true,
    metadataOnlyCompatible: false,
    prohibitedForRuntimeBridgeMetadata: true,
    summary: "Export or download execution boundary, prohibited inside Runtime Bridge metadata.",
    metadataOnly: true,
  },
] as const satisfies ReadonlyArray<RuntimeBridgeExecutionBoundaryDescriptor>;
