export type CapabilityMode =
  | "advisory"
  | "executable"
  | "metadata_only"
  | "presentational"
  | "composition"
  | "persistence"
  | "hybrid";

export type GovernanceConfidenceLevel = "low" | "medium" | "high";

export type SideEffectKind =
  | "backend_query"
  | "result_mutation"
  | "result_activation"
  | "export_download"
  | "sql_execution"
  | "dataset_upload"
  | "dataset_switch"
  | "workbook_switch"
  | "session_restore"
  | "runtime_persistence"
  | "route_or_view_change"
  | "history_mutation"
  | "metadata_snapshot";

export type ProtectedSurfaceId =
  | "executeWorkspaceQuery"
  | "ResultsGrid"
  | "ActiveResultModel"
  | "useResultExecutionCoordinator"
  | "useExportController"
  | "useWorkspaceDatasetController"
  | "useWorkspaceRuntimeCoordinator"
  | "SqlWorkspace"
  | "MonacoEditor"
  | "workbookSessionRestore"
  | "runtimePersistence"
  | "runtimeIntelligenceGraph"
  | "narrativeIntelligence";

export type GovernanceEvidenceReference = {
  readonly id: string;
  readonly source: string;
  readonly description?: string;
};

export type BoundaryOwnershipReference = {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly featurePath?: string;
};

export type BaseBoundaryContract = {
  readonly mode: CapabilityMode;
  readonly contractId: string;
  readonly label: string;
  readonly description?: string;
  readonly confidence?: GovernanceConfidenceLevel;
  readonly protectedSurfaces?: ReadonlyArray<ProtectedSurfaceId>;
  readonly evidenceRefs?: ReadonlyArray<GovernanceEvidenceReference>;
};

export type AdvisoryBoundaryContract = BaseBoundaryContract & {
  readonly mode: "advisory";
  readonly canExecute: false;
  readonly canMutateResults: false;
  readonly canCallBackend: false;
  readonly canPersistRuntimeState: false;
  readonly allowedOutputs: ReadonlyArray<
    | "summary"
    | "recommendation"
    | "diagnostic"
    | "readiness"
    | "continuation"
    | "lineage_reference"
    | "plan"
    | "explanation"
  >;
};

export type ExecutableBoundaryContract = BaseBoundaryContract & {
  readonly mode: "executable";
  readonly canExecute: true;
  readonly canMutateResults: boolean;
  readonly canCallBackend: boolean;
  readonly requiresUserAction: true;
  readonly sideEffectOwner: BoundaryOwnershipReference;
  readonly sideEffects: ReadonlyArray<SideEffectKind>;
};

export type MetadataOnlyBoundaryContract = BaseBoundaryContract & {
  readonly mode: "metadata_only";
  readonly canExecute: false;
  readonly canMutateWorkspace: false;
  readonly canCallBackend: false;
  readonly lineageRefs?: ReadonlyArray<string>;
};

export type PresentationalBoundaryContract = BaseBoundaryContract & {
  readonly mode: "presentational";
  readonly canExecute: false;
  readonly canOwnSideEffects: false;
  readonly mayReceiveCallbacks: true;
};

export type CompositionBoundaryContract = BaseBoundaryContract & {
  readonly mode: "composition";
  readonly canExecuteDirectly: false;
  readonly mayWireCallbacks: true;
  readonly composedModes: ReadonlyArray<CapabilityMode>;
};

export type PersistenceBoundaryContract = BaseBoundaryContract & {
  readonly mode: "persistence";
  readonly canPersistState: true;
  readonly persistedSideEffects: ReadonlyArray<SideEffectKind>;
  readonly sideEffectOwner: BoundaryOwnershipReference;
};

export type HybridBoundaryContract = BaseBoundaryContract & {
  readonly mode: "hybrid";
  readonly requiresBoundaryNotes: true;
  readonly advisoryResponsibilities: ReadonlyArray<string>;
  readonly executableResponsibilities: ReadonlyArray<string>;
  readonly sideEffectOwner?: BoundaryOwnershipReference;
};

export type GovernanceBoundaryContract =
  | AdvisoryBoundaryContract
  | ExecutableBoundaryContract
  | MetadataOnlyBoundaryContract
  | PresentationalBoundaryContract
  | CompositionBoundaryContract
  | PersistenceBoundaryContract
  | HybridBoundaryContract;
