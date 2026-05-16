import { classifyStructuralRow } from "../dataIntelligence/structuralPresentation";
import { columnMatchesBusinessCategory, describeBusinessSubject, hasSemanticCategory } from "./narrativeBusinessContext";
import { buildNarrativeRecommendations } from "./narrativeRecommendations";
import { scoreSeverity } from "./narrativeSeverity";
import type { NarrativeInsight, NarrativeScanContext } from "./narrativeTypes";

const emptyValue = (value: unknown) =>
  value === null || value === undefined || (typeof value === "string" && value.trim() === "");

const formatPercent = (ratio: number) => `${Math.round(ratio * 100).toLocaleString()}%`;

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const uniqueInsight = (insights: NarrativeInsight[]) => {
  const seen = new Set<string>();
  return insights.filter((insight) => {
    if (seen.has(insight.id)) return false;
    seen.add(insight.id);
    return true;
  });
};

const createInsight = (
  insight: Omit<NarrativeInsight, "deterministic" | "recommendations"> & {
    recommendationExtras?: Parameters<typeof buildNarrativeRecommendations>[2];
  },
): NarrativeInsight => ({
  ...insight,
  deterministic: true,
  recommendations: buildNarrativeRecommendations(
    insight.id,
    insight.category,
    insight.recommendationExtras,
  ),
});

const detectMissingValues = (context: NarrativeScanContext): NarrativeInsight[] =>
  context.columns
    .map((column) => {
      const denominator = Math.max(context.dataset.row_count, context.activeResultModel.totalCount, 1);
      const ratio = column.null_count / denominator;
      const sampledMissingRatio =
        context.sampledRows.length > 0
          ? context.sampledRows.filter((row) => emptyValue(row[column.name])).length / context.sampledRows.length
          : 0;
      const impactRatio = Math.max(ratio, sampledMissingRatio);

      if (impactRatio < 0.12) return null;

      return createInsight({
        id: `narrative:quality:missing:${column.name}`,
        category: "quality",
        severity: scoreSeverity({ ratio: impactRatio }),
        title: "Missing value concentration",
        narrative: `Several rows contain missing ${column.name} values.`,
        evidence: [
          { label: "Metadata missing share", value: formatPercent(ratio), ratio },
          { label: "Sample missing share", value: formatPercent(sampledMissingRatio), ratio: sampledMissingRatio },
        ],
        relatedColumns: [column.name],
        source: "metadata",
        recommendationExtras: ["filter_missing_values"],
      });
    })
    .filter((insight): insight is NarrativeInsight => Boolean(insight));

const detectCategoryDominance = (context: NarrativeScanContext): NarrativeInsight[] => {
  const candidateColumns = context.columns.filter(
    (column) =>
      (column.inferred_type === "categorical" || column.inferred_type === "text") &&
      column.unique_count > 1 &&
      column.unique_count <= Math.max(40, context.sampledRows.length * 0.7),
  );

  return candidateColumns
    .map((column) => {
      const counts = new Map<string, number>();
      context.sampledRows.forEach((row) => {
        const value = normalizeValue(row[column.name]);
        if (!value) return;
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
      if (!top) return null;

      const ratio = top[1] / Math.max(context.sampledRows.length, 1);
      if (ratio < 0.45 || top[1] < 3) return null;

      const subject = describeBusinessSubject(column.name, context.businessSemanticReport);
      const isFinancial = columnMatchesBusinessCategory(column, "revenue") || hasSemanticCategory(context.businessSemanticReport, "revenue");

      return createInsight({
        id: `narrative:concentration:${column.name}`,
        category: isFinancial ? "financial" : "concentration",
        severity: scoreSeverity({
          ratio,
          operationalRelevance:
            columnMatchesBusinessCategory(column, "operational_event") ||
            columnMatchesBusinessCategory(column, "region")
              ? 0.12
              : 0,
        }),
        title: isFinancial ? "Revenue concentration signal" : "Category concentration",
        narrative: `Most ${subject} appears concentrated in ${top[0]} for ${column.name}.`,
        evidence: [
          { label: "Dominant value", value: top[0] },
          { label: "Sample share", value: formatPercent(ratio), ratio },
        ],
        relatedColumns: [column.name],
        source: "sampled_rows",
        recommendationExtras: columnMatchesBusinessCategory(column, "region")
          ? ["segment_locations"]
          : ["group_by_category"],
      });
    })
    .filter((insight): insight is NarrativeInsight => Boolean(insight));
};

const detectRepeatedRows = (context: NarrativeScanContext): NarrativeInsight[] => {
  const fingerprints = new Map<string, number>();
  const columns = context.activeResultModel.visibleColumns.slice(0, 12);

  context.sampledRows.forEach((row) => {
    const fingerprint = columns.map((column) => normalizeValue(row[column]).toLowerCase()).join("|");
    if (!fingerprint.replace(/\|/g, "")) return;
    fingerprints.set(fingerprint, (fingerprints.get(fingerprint) || 0) + 1);
  });

  const duplicateCount = [...fingerprints.values()].reduce(
    (sum, count) => sum + (count > 1 ? count - 1 : 0),
    0,
  );
  const ratio = duplicateCount / Math.max(context.sampledRows.length, 1);

  if (ratio < 0.08) return [];

  return [
    createInsight({
      id: "narrative:quality:duplicate-rows",
      category: "quality",
      severity: scoreSeverity({ ratio }),
      title: "Repeated row structures",
      narrative: "Several sampled rows repeat the same visible structure.",
      evidence: [{ label: "Repeated sample rows", value: formatPercent(ratio), ratio }],
      relatedColumns: columns,
      source: "visible_rows",
      recommendationExtras: ["inspect_duplicates"],
    }),
  ];
};

const detectNumericOutliers = (context: NarrativeScanContext): NarrativeInsight[] =>
  context.columns
    .filter((column) => column.inferred_type === "numeric")
    .map((column) => {
      const values = context.sampledRows
        .map((row) => Number(row[column.name]))
        .filter((value) => Number.isFinite(value));
      if (values.length < 6) return null;

      const sorted = [...values].sort((left, right) => left - right);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median = sorted[Math.floor(sorted.length / 2)] || 0;
      const range = max - min;
      const ratio = median !== 0 ? Math.abs(max - median) / Math.max(Math.abs(median), 1) : range > 0 ? 1 : 0;

      if (ratio < 4 && range < 1) return null;

      return createInsight({
        id: `narrative:anomaly:numeric:${column.name}`,
        category: columnMatchesBusinessCategory(column, "revenue") ? "financial" : "anomaly",
        severity: scoreSeverity({ ratio: Math.min(ratio / 10, 1), variance: Math.min(range / Math.max(Math.abs(max), 1), 1) }),
        title: "Unusual numeric spread",
        narrative: `${column.name} contains values that are unusually far apart in the sampled result.`,
        evidence: [
          { label: "Lowest sampled value", value: min.toLocaleString() },
          { label: "Highest sampled value", value: max.toLocaleString() },
        ],
        relatedColumns: [column.name],
        source: "sampled_rows",
      });
    })
    .filter((insight): insight is NarrativeInsight => Boolean(insight));

const detectTemporalClustering = (context: NarrativeScanContext): NarrativeInsight[] =>
  context.columns
    .filter((column) => column.inferred_type === "date" || columnMatchesBusinessCategory(column, "date_dimension"))
    .map((column) => {
      const buckets = new Map<string, number>();
      context.sampledRows.forEach((row) => {
        const value = normalizeValue(row[column.name]);
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return;
        const bucket = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
      });
      const top = [...buckets.entries()].sort((left, right) => right[1] - left[1])[0];
      if (!top) return null;
      const ratio = top[1] / Math.max(context.sampledRows.length, 1);
      if (ratio < 0.5 || top[1] < 3) return null;

      return createInsight({
        id: `narrative:temporal:cluster:${column.name}`,
        category: "temporal",
        severity: scoreSeverity({ ratio }),
        title: "Date clustering",
        narrative: `Current rows are heavily clustered around ${top[0]}.`,
        evidence: [{ label: "Sample period share", value: formatPercent(ratio), ratio }],
        relatedColumns: [column.name],
        source: "sampled_rows",
        recommendationExtras: ["compare_periods"],
      });
    })
    .filter((insight): insight is NarrativeInsight => Boolean(insight));

const detectGroupingOpportunities = (context: NarrativeScanContext): NarrativeInsight[] => {
  if (context.activeResultModel.grouping.hasGrouping) {
    return [
      createInsight({
        id: "narrative:comparison:active-grouping",
        category: "comparison",
        severity: "low",
        title: "Grouping context available",
        narrative: `Current grouping suggests comparison by ${context.activeResultModel.grouping.columns.join(", ")}.`,
        evidence: [{ label: "Grouping columns", value: context.activeResultModel.grouping.columns.join(", ") }],
        relatedColumns: context.activeResultModel.grouping.columns,
        source: "grouping",
      }),
    ];
  }

  const candidate = context.columns.find(
    (column) =>
      (column.inferred_type === "categorical" || column.inferred_type === "text") &&
      column.unique_count > 1 &&
      column.unique_count <= Math.max(20, context.dataset.row_count * 0.25),
  );
  if (!candidate) return [];

  return [
    createInsight({
      id: `narrative:categorical:grouping:${candidate.name}`,
      category: "categorical",
      severity: "medium",
      title: "Grouping opportunity",
      narrative: `${candidate.name} is a likely grouping field for a more executive comparison.`,
      evidence: [{ label: "Distinct values", value: candidate.unique_count.toLocaleString() }],
      relatedColumns: [candidate.name],
      source: "metadata",
      recommendationExtras: ["group_by_category"],
    }),
  ];
};

const detectStructuralRows = (context: NarrativeScanContext): NarrativeInsight[] => {
  const structuralCount = context.sampledRows.filter(
    (row) => classifyStructuralRow(row, context.activeResultModel.visibleColumns).isStructural,
  ).length;
  const ratio = structuralCount / Math.max(context.sampledRows.length, 1);

  if (ratio < 0.12) return [];

  return [
    createInsight({
      id: "narrative:quality:structural-rows",
      category: "quality",
      severity: scoreSeverity({ ratio }),
      title: "Duplicated report structure",
      narrative: "Some sampled rows look like repeated report headers or structural rows.",
      evidence: [{ label: "Structural sample rows", value: formatPercent(ratio), ratio }],
      relatedColumns: context.activeResultModel.visibleColumns.slice(0, 6),
      source: "visible_rows",
      recommendationExtras: ["inspect_duplicates"],
    }),
  ];
};

const detectOperationalAndWorkbookSignals = (context: NarrativeScanContext): NarrativeInsight[] => {
  const insights: NarrativeInsight[] = [];
  const operationalColumn = context.columns.find((column) => columnMatchesBusinessCategory(column, "operational_event"));
  const workloadColumn = context.columns.find(
    (column) => columnMatchesBusinessCategory(column, "employee") || columnMatchesBusinessCategory(column, "department"),
  );

  if (operationalColumn) {
    insights.push(
      createInsight({
        id: `narrative:operational:${operationalColumn.name}`,
        category: "operational",
        severity: "medium",
        title: "Operational review signal",
        narrative: `${operationalColumn.name} can support bottleneck or status review.`,
        evidence: [{ label: "Operational field", value: operationalColumn.name }],
        relatedColumns: [operationalColumn.name],
        source: "metadata",
      }),
    );
  }

  if (workloadColumn) {
    insights.push(
      createInsight({
        id: `narrative:operational:workload:${workloadColumn.name}`,
        category: "operational",
        severity: "medium",
        title: "Workload segmentation signal",
        narrative: `${workloadColumn.name} can help identify workload imbalance across teams or owners.`,
        evidence: [{ label: "Workload field", value: workloadColumn.name }],
        relatedColumns: [workloadColumn.name],
        source: "metadata",
      }),
    );
  }

  const workbook = context.dataset.workbook_metadata;
  if (workbook?.normalization.warnings.length || workbook?.worksheets.some((worksheet) => worksheet.normalization.warnings.length > 0)) {
    insights.push(
      createInsight({
        id: "narrative:investigation:workbook-quality",
        category: "investigation",
        severity: "medium",
        title: "Workbook quality warning",
        narrative: "Workbook metadata contains normalization warnings that should be preserved for review.",
        evidence: [{ label: "Worksheets", value: workbook.worksheets.length.toLocaleString() }],
        relatedColumns: [],
        source: "workbook",
        recommendationExtras: ["preserve_workbook_snapshot"],
      }),
    );
  }

  return insights;
};

const detectFilterAndInvestigationSignals = (context: NarrativeScanContext): NarrativeInsight[] => {
  const insights: NarrativeInsight[] = [];
  const activeFilters = context.activeResultModel.filters.activeLabels;

  if (activeFilters.length > 0) {
    insights.push(
      createInsight({
        id: "narrative:investigation:filter-scope",
        category: "investigation",
        severity: "low",
        title: "Filtered investigation scope",
        narrative: "Current insight context reflects an active filtered result scope.",
        evidence: [{ label: "Active filters", value: activeFilters.length.toLocaleString() }],
        relatedColumns: context.activeResultModel.filters.backendFilters.map((filter) => filter.column),
        source: "filter_state",
      }),
    );
  }

  const nextStep = context.investigationReport?.nextSteps[0];
  if (nextStep) {
    insights.push(
      createInsight({
        id: `narrative:recommendation:${nextStep.id}`,
        category: "recommendation",
        severity: "low",
        title: "Investigation continuation",
        narrative: nextStep.question,
        evidence: [{ label: "Investigation confidence", value: nextStep.confidence }],
        relatedColumns: [...nextStep.compareBy, ...nextStep.measures],
        source: "investigation",
      }),
    );
  }

  return insights;
};

export const runNarrativeDetectors = (context: NarrativeScanContext): NarrativeInsight[] =>
  uniqueInsight([
    ...detectMissingValues(context),
    ...detectCategoryDominance(context),
    ...detectRepeatedRows(context),
    ...detectNumericOutliers(context),
    ...detectTemporalClustering(context),
    ...detectGroupingOpportunities(context),
    ...detectStructuralRows(context),
    ...detectOperationalAndWorkbookSignals(context),
    ...detectFilterAndInvestigationSignals(context),
  ]);
