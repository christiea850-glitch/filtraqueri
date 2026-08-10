import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AnalysisPackagePlan } from "../../../features/analysisPackages";
import type { InvestigationWorkspacePlan } from "../../../features/investigationWorkspace/workspaceSessionTypes";
import type {
  InvestigationReport,
  InvestigationSuggestion,
} from "../../../features/investigationIntelligence";
import type { NarrativeReport } from "../../../features/narrativeIntelligence";
import type { ActiveResultModel } from "../../../features/results/activeResultModel";
import type { ResultTabKey } from "../../../features/results/resultTypes";
import ResultsInvestigationSurface from "../ResultsInvestigationSurface";

const schemaColumn = {
  name: "region",
  type: "VARCHAR",
  inferred_type: "categorical" as const,
  null_count: 0,
  unique_count: 3,
  sample_values: ["East", "West"],
};

const buildActiveResultModel = ({
  totalCount,
  activeResultTab = "preview",
  sourceType = "preview",
}: {
  totalCount: number;
  activeResultTab?: ResultTabKey;
  sourceType?: ActiveResultModel["sourceType"];
}): ActiveResultModel => ({
  datasetId: "dataset-runtime",
  datasetName: "runtime.csv",
  sourceType,
  sourceTab: activeResultTab,
  rows: totalCount > 0 ? [{ region: "East", revenue: 100 }] : [],
  visibleRows: totalCount > 0 ? [{ region: "East", revenue: 100 }] : [],
  columns: ["region", "revenue"],
  visibleColumns: ["region", "revenue"],
  hiddenColumns: [],
  totalCount,
  filteredCount: sourceType === "filtered" ? totalCount : 0,
  page: 1,
  totalPages: Math.max(1, totalCount),
  rowsPerPage: 25,
  filters: {
    activeLabels: ["region is East"],
    backendFilters: [
      {
        column: "region",
        type: "categorical",
        values: ["East"],
      },
    ],
  },
  grouping: {
    columns: [],
    hasGrouping: false,
  },
  sorting: {
    column: "revenue",
    direction: "DESC",
  },
  query: {
    hasRun: sourceType === "query",
    selectedColumns: ["region", "revenue"],
    aggregations: [],
    limit: "25",
  },
  export: {
    sourceType,
    rowCount: totalCount,
    columns: ["region", "revenue"],
    rows: totalCount > 0 ? [{ region: "East", revenue: 100 }] : [],
    filters: [],
    queryBuilder: null,
  },
  chartReady: {
    numericColumns: [
      {
        name: "revenue",
        type: "DOUBLE",
        inferred_type: "numeric",
        null_count: 0,
        unique_count: 4,
        sample_values: [100, 200],
      },
    ],
    categoricalColumns: [schemaColumn],
    groupingCandidates: [schemaColumn],
    isLargeResult: false,
  },
  insightReady: {
    missingValueCount: 0,
    missingValueColumns: [],
    numericRanges: [{ column: "revenue", min: 0, max: 500 }],
    topCandidateColumns: [schemaColumn],
    distinctCounts: [{ column: "region", uniqueCount: 3 }],
    previewRowCount: totalCount > 0 ? 1 : 0,
  },
});

const nextStep: InvestigationSuggestion = {
  id: "suggestion-follow-up",
  intentId: "compare_entities",
  title: "Compare regions",
  question: "Which regions contributed the most revenue?",
  explanation: "Compares grouped revenue patterns.",
  compareBy: ["region"],
  measures: ["revenue"],
  nextSteps: ["Review high contributors"],
  chartFamilies: ["bar"],
  confidence: "high",
  confidenceScore: 0.92,
};

const investigationReport: InvestigationReport = {
  context: {
    dataset: null,
    activeResultModel: null,
    columns: [],
    dimensions: [],
    measures: [],
    dateFields: [],
    customerFields: [],
    financialFields: [],
    operationalFields: [],
    relationshipHints: [],
    contexts: {
      customer: false,
      financial: false,
      operational: false,
      workforce: false,
      workbook: false,
      temporal: false,
    },
  },
  intents: [],
  suggestions: [nextStep],
  flow: {
    id: "flow-runtime",
    title: "Runtime review",
    activeStage: "review_result",
    steps: [],
  },
  nextSteps: [nextStep],
  humanSummary: "Grounded investigation summary.",
};

const narrativeReport: NarrativeReport = {
  reportId: "narrative-runtime",
  datasetId: "dataset-runtime",
  sourceResultId: "preview",
  summary: "Revenue is concentrated in the visible result.",
  readiness: {
    level: "ready",
    label: "Ready",
    detail: "Narrative can use current result context.",
    insightCount: 1,
    highPriorityCount: 0,
  },
  insights: [
    {
      id: "insight-runtime",
      category: "comparison",
      severity: "medium",
      title: "East leads visible revenue",
      narrative: "East has the strongest visible revenue contribution.",
      evidence: [{ label: "Top contributor", value: "East" }],
      recommendations: [],
      relatedColumns: ["region", "revenue"],
      source: "visible_rows",
      deterministic: true,
    },
  ],
  visibleInsights: [
    {
      id: "insight-runtime",
      category: "comparison",
      severity: "medium",
      title: "East leads visible revenue",
      narrative: "East has the strongest visible revenue contribution.",
      evidence: [{ label: "Top contributor", value: "East" }],
      recommendations: [],
      relatedColumns: ["region", "revenue"],
      source: "visible_rows",
      deterministic: true,
    },
  ],
  timelineCheckpoints: [],
  futureContracts: {
    aiAssistedExplanationReady: false,
    executiveReportingReady: false,
    narrativeExportReady: false,
    scheduledSummaryReady: false,
    governanceAuditTrailReady: false,
    multilingualSummaryReady: false,
  },
  safetyNotes: [],
};

const analysisPackagePlan: AnalysisPackagePlan = {
  packageManifest: {
    manifestVersion: 1,
    packageId: "package-runtime",
    title: "Runtime package",
    status: "planned",
    generatedAt: "deterministic-runtime",
    sourceMode: "human",
    datasetReference: null,
    workbookReference: null,
    investigationIntentReferences: [],
    generatedQueryReferences: [],
    resultReference: null,
    trailReferences: [],
    artifactManifest: [],
    futureExportTargets: [],
    auditTrail: [],
  },
  recommendations: [],
  readinessSummary: {
    label: "Package planned",
    readyArtifactCount: 0,
    recommendedArtifactCount: 0,
    futureArtifactCount: 0,
  },
  humanSummary: "Package metadata only.",
};

const investigationWorkspacePlan: InvestigationWorkspacePlan = {
  session: {
    sessionId: "session-runtime",
    sessionTitle: "Runtime investigation",
    createdAt: "deterministic-runtime",
    updatedAt: "deterministic-runtime",
    sourceMode: "human",
    status: "review_ready",
    readiness: "result_ready",
    datasetReference: null,
    workbookReference: null,
    activeResultReference: null,
    narrativeReferences: [],
    runtimeNodeReferences: [],
    runtimeContinuationReferences: [],
    runtimeLineageReferences: [],
    advisoryRuntimeCheckpoints: [],
    analysisPackageReferences: [],
    investigationTrailReferences: [],
    futureArtifactFolderReferences: [],
    deliverableHub: {
      hubId: "hub-runtime",
      title: "Deliverables",
      itemCount: 0,
      readyItemCount: 0,
      futureItemCount: 0,
      items: [],
      futureFolderReferences: [],
    },
    timeline: [
      {
        eventId: "event-runtime",
        type: "result_checkpoint",
        label: "Result reviewed",
        description: "The current result was reviewed.",
        stage: "review_result",
        createdAt: "deterministic-runtime",
        relatedDatasetId: "dataset-runtime",
        relatedResultSource: "preview",
      },
    ],
    auditMetadata: [],
  },
  recommendations: [
    {
      recommendationId: "recommendation-runtime",
      label: "Compare grouped results",
      description: "Review the strongest grouped result.",
      priority: "primary",
      readiness: "result_ready",
    },
  ],
  readinessSummary: {
    label: "Investigation ready",
    packageCount: 0,
    stageCount: 1,
    deliverableCount: 0,
    readyDeliverableCount: 0,
  },
  humanSummary: "Investigation workspace metadata.",
};

const emptyInvestigationReport: InvestigationReport = {
  ...investigationReport,
  suggestions: [],
  nextSteps: [],
  humanSummary: "",
};

const emptyNarrativeReport: NarrativeReport = {
  ...narrativeReport,
  summary: "",
  insights: [],
  visibleInsights: [],
  readiness: {
    level: "limited",
    label: "Limited",
    detail: "No narrative insights are available.",
    insightCount: 0,
    highPriorityCount: 0,
  },
};

const emptyInvestigationWorkspacePlan: InvestigationWorkspacePlan = {
  ...investigationWorkspacePlan,
  session: {
    ...investigationWorkspacePlan.session,
    timeline: [],
  },
  recommendations: [],
};

const renderSurface = ({
  totalCount = 12,
  activeResultTab = "preview",
  sourceType = "preview",
  report = investigationReport,
  narrative = narrativeReport,
  plan = investigationWorkspacePlan,
}: {
  totalCount?: number;
  activeResultTab?: ResultTabKey;
  sourceType?: ActiveResultModel["sourceType"];
  report?: InvestigationReport;
  narrative?: NarrativeReport;
  plan?: InvestigationWorkspacePlan;
} = {}) =>
  render(
    <ResultsInvestigationSurface
      activeResultModel={buildActiveResultModel({
        totalCount,
        activeResultTab,
        sourceType,
      })}
      activeResultTab={activeResultTab}
      workspaceMode="human"
      investigationReport={report}
      analysisPackagePlan={analysisPackagePlan}
      investigationWorkspacePlan={plan}
      narrativeReport={narrative}
    />,
  );

describe("ResultsInvestigationSurface runtime integration", () => {
  it("renders one Investigation Workspace through the Results owner", () => {
    renderSurface();

    const reviewContext = screen.getByLabelText("Results review context");
    expect(reviewContext).toBeInTheDocument();
    expect(screen.getByText("What the data shows")).toBeInTheDocument();
    expect(within(reviewContext).getAllByText("Revenue is concentrated in the visible result.").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Investigation")).toHaveLength(1);
  });

  it("supplies grounded read-only investigation, narrative, explainability, and Results context", () => {
    renderSurface({ totalCount: 12 });

    const workspace = screen.getByLabelText("Investigation");
    expect(within(workspace).getByText("Investigation ready")).toBeInTheDocument();
    expect(within(workspace).getByText("Compare grouped results")).toBeInTheDocument();
    expect(within(workspace).getByText("Revenue is concentrated in the visible result.")).toBeInTheDocument();
    expect(within(workspace).getByText("Preview result")).toBeInTheDocument();
    expect(within(workspace).getByText("12")).toBeInTheDocument();
    expect(within(workspace).getByText("1 filters / revenue DESC")).toBeInTheDocument();
    expect(within(workspace).queryByRole("button", { name: /run|execute|export|apply|insert/i })).not.toBeInTheDocument();
  });

  it.each([
    [0, "0"],
    [1, "1"],
    [24, "24"],
  ])("keeps row-count metadata honest for %i result rows", (totalCount, rowLabel) => {
    renderSurface({ totalCount });

    const workspace = screen.getByLabelText("Investigation context");
    expect(within(workspace).getByText(rowLabel)).toBeInTheDocument();
  });

  it("preserves filter/sort metadata in both Results review and Investigation Workspace context", () => {
    renderSurface({ totalCount: 1, sourceType: "filtered", activeResultTab: "filtered" });

    expect(screen.getAllByText("1 filters / revenue DESC").length).toBeGreaterThan(1);
    expect(within(screen.getByLabelText("Investigation context")).getByText("1 filters / revenue DESC")).toBeInTheDocument();
  });

  it("does not fabricate unavailable investigation or narrative content", () => {
    renderSurface({
      totalCount: 0,
      report: emptyInvestigationReport,
      narrative: emptyNarrativeReport,
      plan: emptyInvestigationWorkspacePlan,
    });

    expect(screen.queryByText(nextStep.question)).not.toBeInTheDocument();
    expect(screen.queryByText("Compare grouped results")).not.toBeInTheDocument();
    expect(screen.getByText("Review the current result to identify the next useful question.")).toBeInTheDocument();
  });
});
