import type { InvestigationReport } from "../investigationIntelligence";
import type { NarrativeReport } from "../narrativeIntelligence";
import type { ExplainabilityPreviewViewModel } from "../runtimeBridgeConsumers";
import type { InvestigationWorkspacePlan } from "./workspaceSessionTypes";

export type InvestigationWorkspaceLocalTab = "overview" | "timeline" | "evidence";

export type InvestigationWorkspacePresentationMode = "compact" | "focused";

export type InvestigationWorkspaceResultsContext = {
  readonly sourceLabel: string;
  readonly activeResultTab: string;
  readonly sourceType: string;
  readonly rowCountLabel: string;
  readonly filterSortLabel: string;
};

export type InvestigationWorkspaceReadOnlyContext = {
  readonly investigationWorkspacePlan: InvestigationWorkspacePlan;
  readonly investigationReport: InvestigationReport;
  readonly narrativeReport: NarrativeReport;
  readonly explainabilityPreview: ExplainabilityPreviewViewModel;
  readonly resultsContext: InvestigationWorkspaceResultsContext;
};

export type InvestigationWorkspaceLocalState = {
  readonly selectedTab: InvestigationWorkspaceLocalTab;
  readonly expandedSectionId: string | null;
  readonly presentationMode: InvestigationWorkspacePresentationMode;
};

