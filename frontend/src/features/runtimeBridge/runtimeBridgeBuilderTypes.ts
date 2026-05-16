import type { AnalysisPackagePlan } from "../analysisPackages";
import type { InvestigationReport } from "../investigationIntelligence";
import type { InvestigationWorkspacePlan } from "../investigationWorkspace";
import type { NarrativeReport } from "../narrativeIntelligence";
import type { ActiveResultModel } from "../results/activeResultModel";
import type {
  RuntimeContinuationReference,
  RuntimeEdge,
  RuntimeEventReference,
  RuntimeLineageReference,
  RuntimeNode,
} from "../runtimeIntelligence";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeBuilderSourceModules = {
  readonly runtimeBridge: RuntimeBridgeSourceModuleReference;
  readonly activeResult: RuntimeBridgeSourceModuleReference;
  readonly narrativeIntelligence: RuntimeBridgeSourceModuleReference;
  readonly investigationIntelligence: RuntimeBridgeSourceModuleReference;
  readonly analysisPackages: RuntimeBridgeSourceModuleReference;
  readonly investigationWorkspace: RuntimeBridgeSourceModuleReference;
  readonly runtimeIntelligence: RuntimeBridgeSourceModuleReference;
};

export const runtimeBridgeBuilderSourceModules = {
  runtimeBridge: {
    moduleId: "runtime-bridge",
    modulePath: "frontend/src/features/runtimeBridge",
    capabilityMode: "metadata_only",
    label: "Runtime bridge",
  },
  activeResult: {
    moduleId: "active-result-model",
    modulePath: "frontend/src/features/results/activeResultModel.ts",
    capabilityMode: "composition",
    label: "Active result model reference",
  },
  narrativeIntelligence: {
    moduleId: "narrative-intelligence",
    modulePath: "frontend/src/features/narrativeIntelligence",
    capabilityMode: "advisory",
    label: "Narrative intelligence",
  },
  investigationIntelligence: {
    moduleId: "investigation-intelligence",
    modulePath: "frontend/src/features/investigationIntelligence",
    capabilityMode: "advisory",
    label: "Investigation intelligence",
  },
  analysisPackages: {
    moduleId: "analysis-packages",
    modulePath: "frontend/src/features/analysisPackages",
    capabilityMode: "advisory",
    label: "Analysis packages",
  },
  investigationWorkspace: {
    moduleId: "investigation-workspace",
    modulePath: "frontend/src/features/investigationWorkspace",
    capabilityMode: "hybrid",
    label: "Investigation workspace metadata",
  },
  runtimeIntelligence: {
    moduleId: "runtime-intelligence",
    modulePath: "frontend/src/features/runtimeIntelligence",
    capabilityMode: "metadata_only",
    label: "Runtime intelligence",
  },
} satisfies RuntimeBridgeBuilderSourceModules;

export type RuntimeBridgeSnapshotBuildInput = {
  readonly bridgeId?: string;
  readonly createdAt: string;
  readonly sourceModules?: Partial<RuntimeBridgeBuilderSourceModules>;
  readonly activeResultModel?: ActiveResultModel | null;
  readonly narrativeReport?: NarrativeReport | null;
  readonly investigationReport?: InvestigationReport | null;
  readonly analysisPackagePlan?: AnalysisPackagePlan | null;
  readonly investigationWorkspacePlan?: InvestigationWorkspacePlan | null;
  readonly runtimeNodes?: ReadonlyArray<RuntimeNode>;
  readonly runtimeEdges?: ReadonlyArray<RuntimeEdge>;
  readonly runtimeContinuations?: ReadonlyArray<RuntimeContinuationReference>;
  readonly runtimeLineageReferences?: ReadonlyArray<RuntimeLineageReference>;
  readonly runtimeEventReferences?: ReadonlyArray<RuntimeEventReference>;
};
