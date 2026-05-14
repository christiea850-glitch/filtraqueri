import type {
  GuidanceContinuationLink,
  GuidanceReason,
  InvestigationContinuation,
  InvestigationGuidanceItem,
  RuntimeContextSnapshot,
} from "./runtimeTypes";

const getContinuationLink = (
  continuations: InvestigationContinuation[],
  continuationId: string,
): GuidanceContinuationLink | null => {
  const continuation = continuations.find((item) => item.id === continuationId);
  if (!continuation) return null;

  return {
    continuationId: continuation.id,
    label: continuation.label,
    targetView: continuation.targetView,
    targetMode: continuation.targetMode,
    disabled: continuation.disabled,
  };
};

const createGuidanceItem = ({
  snapshot,
  continuations,
  id,
  title,
  summary,
  category,
  reason,
  continuationId,
  priority = "secondary",
}: {
  snapshot: RuntimeContextSnapshot;
  continuations: InvestigationContinuation[];
  id: string;
  title: string;
  summary: string;
  category: InvestigationGuidanceItem["category"];
  reason: GuidanceReason;
  continuationId: string;
  priority?: InvestigationGuidanceItem["priority"];
}): InvestigationGuidanceItem | null => {
  const continuationLink = getContinuationLink(continuations, continuationId);
  if (!continuationLink) return null;

  return {
    id,
    title,
    summary,
    category,
    reason,
    audience: snapshot.mode,
    priority,
    metadataOnly: true,
    continuationLink,
  };
};

export const buildInvestigationGuidance = ({
  snapshot,
  continuations,
}: {
  snapshot: RuntimeContextSnapshot;
  continuations: InvestigationContinuation[];
}): InvestigationGuidanceItem[] => {
  const guidance: Array<InvestigationGuidanceItem | null> = [];
  const hasDataset = Boolean(snapshot.dataset.datasetId);
  const hasQueryShape =
    snapshot.queryBuilder.hasRunQuery ||
    snapshot.queryBuilder.selectedColumns.length > 0 ||
    snapshot.queryBuilder.groupBy.length > 0 ||
    snapshot.queryBuilder.aggregations.length > 0;
  const hasResultRows = snapshot.activeResult.rowCount > 0;
  const hasWorkbookRelationships =
    snapshot.workbook.relationshipCandidateCount > 0 ||
    snapshot.workbook.acceptedRelationshipCount > 0;
  const hasUnreviewedWorkbookRelationships =
    snapshot.workbook.relationshipCandidateCount > 0 &&
    snapshot.workbook.acceptedRelationshipCount === 0;

  if (!hasDataset) {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:open-data",
        title: "Open data to begin",
        summary: "The workspace trail connects once a dataset or workbook is available.",
        category: "data-readiness",
        reason: "no-dataset-open",
        continuationId: "continue:human:dataset",
        priority: "primary",
      }),
    );
  }

  if (hasDataset && !hasQueryShape) {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:query-refinement",
        title: snapshot.mode === "analyst" ? "Review builder context" : "Continue query refinement",
        summary:
          snapshot.mode === "analyst"
            ? "The builder has no grouped or selected shape yet."
            : "Select fields, groups, or aggregates before comparing result slices.",
        category: "query-refinement",
        reason: "dataset-open-no-query",
        continuationId: "continue:human:queryBuilder",
        priority: "primary",
      }),
    );
  }

  if (hasResultRows && !hasQueryShape) {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:result-review",
        title: "Review results",
        summary: "A result is available; consider checking it before adding filters or groups.",
        category: "result-review",
        reason: "results-ready-no-refinement",
        continuationId: "continue:human:results",
      }),
    );
  }

  if (hasUnreviewedWorkbookRelationships) {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:workbook-relationships",
        title: "Inspect workbook relationships",
        summary: `${snapshot.workbook.relationshipCandidateCount.toLocaleString()} relationship candidate${
          snapshot.workbook.relationshipCandidateCount === 1 ? "" : "s"
        } can be reviewed from the dataset context.`,
        category: "workbook-relationships",
        reason: "workbook-relationships-unreviewed",
        continuationId: "continue:human:dataset",
        priority: hasQueryShape ? "secondary" : "primary",
      }),
    );
  } else if (hasWorkbookRelationships && snapshot.mode === "analyst") {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:relationship-context",
        title: "Check relationship metadata",
        summary: "Workbook relationship context is available for technical review.",
        category: "workbook-relationships",
        reason: "workbook-relationships-unreviewed",
        continuationId: "continue:human:dataset",
      }),
    );
  }

  if (snapshot.taskRecommendation.humanIntentLabel && snapshot.mode === "human" && !snapshot.sql.hasDrafts) {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:open-analyst-sql",
        title: "Open Analyst SQL",
        summary: `${snapshot.taskRecommendation.humanIntentLabel} can be inspected technically without running SQL.`,
        category: "human-guidance",
        reason: "human-intent-without-analyst-context",
        continuationId: "continue:analyst:sqlWorkspace",
      }),
    );
  }

  if (snapshot.sql.hasDrafts && hasResultRows) {
    guidance.push(
      createGuidanceItem({
        snapshot,
        continuations,
        id: "guidance:analyst-result-return",
        title: snapshot.mode === "analyst" ? "Revisit result context" : "Analyst draft is available",
        summary:
          snapshot.mode === "analyst"
            ? "A draft exists; return to results when you want to compare against the active output."
            : "A SQL draft exists in Analyst Mode; result review remains separate.",
        category: "analyst-review",
        reason: "analyst-draft-with-result-context",
        continuationId:
          snapshot.mode === "analyst" ? "continue:human:results" : "continue:analyst:sqlWorkspace",
      }),
    );
  }

  return guidance
    .filter((item): item is InvestigationGuidanceItem => Boolean(item))
    .filter((item) => !item.continuationLink.disabled)
    .slice(0, 4);
};
