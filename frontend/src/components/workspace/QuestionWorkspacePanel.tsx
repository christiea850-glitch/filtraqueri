import { useMemo, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { buildControlledLogicDraft } from "../../features/questionWorkspace/questionLogicDraftBuilder";
import { buildGovernedQueryBuilderRequestDraft } from "../../features/questionWorkspace/questionQueryBuilderRequestBuilder";
import { createSchemaAwareDraftPlan } from "../../features/questionWorkspace/schemaQuestionTranslator";
import type { FilterDefinition } from "../../features/filters/filterTypes";
import type { GovernedQueryBuilderRequestDraft } from "../../features/questionWorkspace/questionQueryBuilderRequestTypes";
import type {
  CandidateFieldMatch,
  SchemaAwareQuestionDraftPlan,
} from "../../features/questionWorkspace/questionTranslatorTypes";

type QuestionDraftStatus = "idle" | "drafted";

type WorkspaceQuestionDraft = {
  rawQuestion: string;
  draftStatus: QuestionDraftStatus;
  activeDatasetId: string | null;
  activeWorksheetName: string | null;
  createdAt: string | null;
};

type QuestionWorkspacePanelProps = {
  dataset: DatasetMetadata;
  sourceName: string;
  onApplyQueryBuilderRequestDraft?: (draft: GovernedQueryBuilderRequestDraft) => void;
};

type PlanningSelectionRole = "dimension" | "measure" | "date";

type QuestionReviewHints = {
  possibleFocus: string;
  possibleAnalysisType: string;
  possibleDimensions: string[];
  possibleMeasures: string[];
  detectedIntents: string[];
  confidence: "high" | "medium" | "low";
  detectedEntities: string[];
  potentialStrategies: string[];
  plannedOutputs: string[];
  starterSuggestions: string[];
};

const starterPrompts = [
  "Which realtor manages the most properties?",
  "What changed most recently?",
  "Which locations perform best?",
  "Which customers generate the most revenue?",
];

const measureTerms = [
  "revenue",
  "sales",
  "amount",
  "payment",
  "cost",
  "profit",
  "margin",
  "properties",
  "customers",
  "orders",
  "count",
  "total",
];

const groupingTerms = [
  "realtor",
  "manager",
  "customer",
  "location",
  "region",
  "property",
  "product",
  "category",
  "team",
  "department",
  "source",
];

const timeTerms = ["recent", "recently", "change", "changed", "trend", "monthly", "weekly", "year", "date", "time"];
const comparisonTerms = ["compare", "versus", "vs", "by", "between", "best", "worst", "underperforming"];
const rankingTerms = ["most", "least", "top", "bottom", "best", "worst", "highest", "lowest"];
const trendTerms = ["trend", "changed", "change", "over time", "monthly", "weekly", "recently"];
const distributionTerms = ["distribution", "spread", "range", "mix", "share", "breakdown"];
const aggregationTerms = ["total", "sum", "average", "avg", "count", "how many", "how much"];
const anomalyTerms = ["unusual", "outlier", "anomaly", "unexpected", "spike", "drop", "underperforming"];
const segmentationTerms = ["segment", "cohort", "group", "type", "category", "department"];
const businessEntityTerms = [
  "realtor",
  "customer",
  "property",
  "department",
  "product",
  "supplier",
  "manager",
  "tenant",
  "employee",
  "location",
];

const createInitialDraft = (): WorkspaceQuestionDraft => ({
  rawQuestion: "",
  draftStatus: "idle",
  activeDatasetId: null,
  activeWorksheetName: null,
  createdAt: null,
});

const findMatchingTerms = (question: string, terms: string[]) => {
  const normalizedQuestion = question.toLowerCase();
  return terms.filter((term) => normalizedQuestion.includes(term));
};

const createQuestionReviewHints = (question: string): QuestionReviewHints => {
  const normalizedQuestion = question.toLowerCase();
  const measures = findMatchingTerms(normalizedQuestion, measureTerms);
  const dimensions = findMatchingTerms(normalizedQuestion, groupingTerms);
  const detectedEntities = findMatchingTerms(normalizedQuestion, businessEntityTerms);
  const hasTimeIntent = findMatchingTerms(normalizedQuestion, timeTerms).length > 0;
  const hasComparisonIntent = findMatchingTerms(normalizedQuestion, comparisonTerms).length > 0;
  const hasRankingIntent = findMatchingTerms(normalizedQuestion, rankingTerms).length > 0;
  const hasTrendIntent = findMatchingTerms(normalizedQuestion, trendTerms).length > 0;
  const hasDistributionIntent = findMatchingTerms(normalizedQuestion, distributionTerms).length > 0;
  const hasAggregationIntent = findMatchingTerms(normalizedQuestion, aggregationTerms).length > 0;
  const hasAnomalyIntent = findMatchingTerms(normalizedQuestion, anomalyTerms).length > 0;
  const hasSegmentationIntent = findMatchingTerms(normalizedQuestion, segmentationTerms).length > 0;
  const detectedIntents = [
    hasRankingIntent ? "ranking" : "",
    hasComparisonIntent ? "comparison" : "",
    hasTrendIntent || hasTimeIntent ? "time review" : "",
    hasTrendIntent ? "trend" : "",
    hasDistributionIntent ? "distribution" : "",
    hasAggregationIntent ? "aggregation" : "",
    hasAnomalyIntent ? "anomaly review" : "",
    hasSegmentationIntent ? "segmentation" : "",
  ].filter(Boolean);
  const possibleAnalysisType = hasTrendIntent || hasTimeIntent
    ? "Change over time"
    : hasRankingIntent
      ? "Ranked comparison"
      : hasComparisonIntent
        ? "Group comparison"
        : "Exploratory review";
  const possibleFocus = dimensions[0] || measures[0] || detectedIntents[0] || "business question";
  const starterSuggestions = [
    dimensions[0] ? `Compare by ${dimensions[0]}` : "",
    hasRankingIntent || normalizedQuestion.includes("perform") ? "Review top performers" : "",
    hasTrendIntent || hasTimeIntent ? "Analyze changes over time" : "",
    measures[0] ? `Review ${measures[0]} movement` : "",
  ].filter(Boolean);
  const confidenceScore = [
    detectedIntents.length > 0,
    detectedEntities.length > 0 || dimensions.length > 0,
    measures.length > 0,
    question.trim().split(/\s+/).length >= 4,
  ].filter(Boolean).length;
  const confidence = confidenceScore >= 3 ? "high" : confidenceScore === 2 ? "medium" : "low";
  const potentialStrategies = [
    dimensions.length > 0 || detectedEntities.length > 0 ? "Group entities" : "",
    measures.length > 0 || hasAggregationIntent ? "Compare totals" : "",
    hasTrendIntent || hasTimeIntent ? "Review changes over time" : "",
    hasRankingIntent ? "Rank highest performers" : "",
    hasAnomalyIntent ? "Detect unusual values" : "",
  ].filter(Boolean);
  const plannedOutputs = [
    "Table",
    hasAggregationIntent || measures.length > 0 ? "KPI card" : "",
    hasTrendIntent || hasTimeIntent ? "Trend chart" : "",
    hasRankingIntent ? "Ranking list" : "",
    hasDistributionIntent ? "Distribution view" : "",
  ].filter(Boolean);

  return {
    possibleFocus,
    possibleAnalysisType,
    possibleDimensions: dimensions.length > 0 ? Array.from(new Set(dimensions)) : ["Not identified yet"],
    possibleMeasures: measures.length > 0 ? Array.from(new Set(measures)) : ["Not identified yet"],
    detectedIntents: detectedIntents.length > 0 ? detectedIntents : ["question review"],
    confidence,
    detectedEntities: detectedEntities.length > 0
      ? Array.from(new Set(detectedEntities))
      : ["Not identified yet"],
    potentialStrategies: potentialStrategies.length > 0
      ? Array.from(new Set(potentialStrategies))
      : ["Clarify business focus"],
    plannedOutputs: plannedOutputs.length > 0 ? Array.from(new Set(plannedOutputs)) : ["Table"],
    starterSuggestions: Array.from(new Set(starterSuggestions)).slice(0, 4),
  };
};

const formatPlanLabel = (value: string) => value.replace(/_/g, " ");

const formatNullablePlanValue = (value: string | number | null) =>
  value === null ? "null" : String(value);

const formatFutureOutputPreview = (value: string) => {
  if (value === "ranking_list") return "ranking table";
  if (value === "comparison_table") return "comparison table";
  return formatPlanLabel(value);
};

const formatAggregationPreview = (idea: string, field: string | null) => {
  if (idea === "none") return "No measure preview";
  if (idea === "count_records") return "COUNT records";
  if (idea === "count_distinct") return field ? `COUNT DISTINCT ${field}` : "COUNT DISTINCT reviewed field";
  return field ? `${idea.toUpperCase()} ${field}` : `${idea.toUpperCase()} reviewed measure`;
};

const formatRequestList = (items: string[]) => (items.length > 0 ? items.join(", ") : "None");

const formatRequestAggregation = (aggregation: { function: string; column: string | null }) =>
  aggregation.column ? `${aggregation.function} ${aggregation.column}` : `${aggregation.function} records`;

const formatRequestFilter = (filter: FilterDefinition) => {
  if (filter.values && filter.values.length > 0) return `${filter.column}: ${filter.values.join(", ")}`;
  if (filter.value !== undefined && filter.value !== null) return `${filter.column}: ${String(filter.value)}`;
  if (filter.min !== undefined || filter.max !== undefined) {
    return `${filter.column}: ${formatNullablePlanValue(filter.min ?? null)} to ${formatNullablePlanValue(filter.max ?? null)}`;
  }
  if (filter.start || filter.end) {
    return `${filter.column}: ${filter.start || "start"} to ${filter.end || "end"}`;
  }
  return `${filter.column}: reviewed filter`;
};

function QuestionWorkspacePanel({
  dataset,
  sourceName,
  onApplyQueryBuilderRequestDraft,
}: QuestionWorkspacePanelProps) {
  const [rawQuestion, setRawQuestion] = useState("");
  const [draft, setDraft] = useState<WorkspaceQuestionDraft>(createInitialDraft);
  const [schemaDraftPlan, setSchemaDraftPlan] = useState<SchemaAwareQuestionDraftPlan | null>(null);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<string | null>(null);
  const [selectedDateField, setSelectedDateField] = useState<string | null>(null);

  const datasetContext = useMemo(
    () => [
      { label: "Dataset", value: dataset.original_filename },
      { label: "Source", value: sourceName || dataset.table_name },
      { label: "Fields", value: dataset.column_count.toLocaleString() },
      { label: "Rows", value: dataset.row_count.toLocaleString() },
    ],
    [dataset.column_count, dataset.original_filename, dataset.row_count, dataset.table_name, sourceName],
  );

  const activeReviewQuestion = draft.draftStatus === "drafted" ? draft.rawQuestion : rawQuestion;
  const reviewHints = useMemo(
    () => createQuestionReviewHints(activeReviewQuestion),
    [activeReviewQuestion],
  );
  const plannedSteps = useMemo(
    () => [
      {
        label: "Understand entities",
        detail: reviewHints.possibleDimensions[0],
      },
      {
        label: "Identify measures",
        detail: reviewHints.possibleMeasures[0],
      },
      {
        label: "Prepare grouping",
        detail: reviewHints.possibleDimensions[0],
      },
      {
        label: "Review trends",
        detail: reviewHints.detectedIntents.includes("time review") ? "Possible" : "Optional",
      },
      {
        label: "Validate result",
        detail: "Future checkpoint",
      },
    ],
    [reviewHints.detectedIntents, reviewHints.possibleDimensions, reviewHints.possibleMeasures],
  );

  const formatCandidateFields = (candidates: CandidateFieldMatch[]) =>
    candidates.length > 0
      ? candidates
          .slice(0, 4)
          .map((candidate) => `${candidate.columnName} (${candidate.confidence})`)
          .join(", ")
      : "Not identified yet";

  const hasSchemaCandidates = Boolean(
    schemaDraftPlan &&
      (
        schemaDraftPlan.candidateDimensions.length > 0 ||
        schemaDraftPlan.candidateMeasures.length > 0 ||
        schemaDraftPlan.candidateDateFields.length > 0
      ),
  );
  const requiredPlanningSelections = schemaDraftPlan
    ? [
        schemaDraftPlan.candidateDimensions.length > 0 ? selectedDimension : "not-needed",
        schemaDraftPlan.candidateMeasures.length > 0 ? selectedMeasure : "not-needed",
        schemaDraftPlan.candidateDateFields.length > 0 &&
        ["trend", "timeline_review"].includes(schemaDraftPlan.detectedIntent)
          ? selectedDateField
          : "not-needed",
      ]
    : [];
  const needsClarification = Boolean(
    schemaDraftPlan &&
      (
        schemaDraftPlan.missingRequirements.length > 0 ||
        requiredPlanningSelections.some((selection) => selection === null)
      ),
  );
  const planningClarityStatus = needsClarification
    ? "Needs clarification"
    : "Ready for future logic generation";

  const updatePlanningSelection = (role: PlanningSelectionRole, columnName: string) => {
    if (role === "dimension") setSelectedDimension(columnName);
    if (role === "measure") setSelectedMeasure(columnName);
    if (role === "date") setSelectedDateField(columnName);
  };

  const renderCandidateChoice = (
    candidate: CandidateFieldMatch,
    role: PlanningSelectionRole,
    selectedColumn: string | null,
  ) => (
    <button
      type="button"
      key={`${role}-${candidate.columnName}`}
      className={selectedColumn === candidate.columnName ? "is-selected" : ""}
      onClick={() => updatePlanningSelection(role, candidate.columnName)}
    >
      <strong>{candidate.columnName}</strong>
      <span>{candidate.confidence} confidence</span>
      <small>{candidate.matchReason.replace(/_/g, " ")}</small>
    </button>
  );

  const investigationBlueprint = useMemo(() => {
    if (!schemaDraftPlan || draft.draftStatus !== "drafted") return null;

    const primaryDimension = selectedDimension || schemaDraftPlan.candidateDimensions[0]?.columnName || null;
    const primaryMeasure = selectedMeasure || schemaDraftPlan.candidateMeasures[0]?.columnName || null;
    const primaryDateField = selectedDateField || schemaDraftPlan.candidateDateFields[0]?.columnName || null;
    const fieldsToInspect = [primaryDimension, primaryMeasure, primaryDateField].filter(Boolean) as string[];
    const missingSelections = [
      schemaDraftPlan.candidateDimensions.length > 0 && !selectedDimension
        ? "choose the grouping or comparison field"
        : "",
      schemaDraftPlan.candidateMeasures.length > 0 && !selectedMeasure
        ? "choose the measure to evaluate"
        : "",
      schemaDraftPlan.candidateDateFields.length > 0 &&
      ["trend", "timeline_review"].includes(schemaDraftPlan.detectedIntent) &&
      !selectedDateField
        ? "choose the timeline field"
        : "",
    ].filter(Boolean);
    const missingRequirements = [
      ...schemaDraftPlan.missingRequirements.map((requirement) => formatPlanLabel(requirement)),
      ...missingSelections,
    ];

    const groupingDirection = primaryDimension
      ? `Compare or group by ${primaryDimension}`
      : "Clarify which business entity or group should anchor the review";
    const measureDirection = primaryMeasure
      ? `Use ${primaryMeasure} as the business measure`
      : "Use record counts or clarify the business metric";
    const timeDirection = primaryDateField
      ? `Review timing with ${primaryDateField}`
      : "Timeline review is optional unless the question asks for change over time";

    const calculationApproachByIntent: Record<string, string> = {
      ranking: `${groupingDirection}; rank results using ${primaryMeasure || "a confirmed metric or count"}.`,
      comparison: `${groupingDirection}; compare differences using ${primaryMeasure || "a confirmed metric or count"}.`,
      trend: `${timeDirection}; summarize movement across time.`,
      timeline_review: `${timeDirection}; inspect the most recent activity sequence.`,
      aggregation: `${measureDirection}; summarize the selected business value.`,
      distribution: `${groupingDirection}; review spread and concentration.`,
      anomaly_review: `Inspect ${fieldsToInspect.join(", ") || "matched fields"} for unusual values before any result is trusted.`,
      segmentation: `${groupingDirection}; organize records into meaningful business segments.`,
      unknown: "Clarify the business outcome before preparing executable logic.",
    };

    const whyThisApproach = primaryDimension || primaryMeasure || primaryDateField
      ? "The matched fields give the workspace a practical way to connect the question to the dataset without guessing. The next safe step is to confirm the field choices before executable logic exists."
      : "The question needs a clearer connection to dataset fields before reliable logic can be prepared.";

    return {
      fieldsToInspect: fieldsToInspect.length > 0 ? fieldsToInspect.join(", ") : "Needs field clarification",
      groupingDirection,
      calculationApproach: calculationApproachByIntent[schemaDraftPlan.detectedIntent],
      expectedOutputShape: formatPlanLabel(schemaDraftPlan.plannedOutputType),
      validationChecks: [
        "Confirm selected fields match the business meaning",
        "Check missing requirements and ambiguity",
        "Keep generated logic reviewable before execution",
      ],
      whyThisApproach,
      missingRequirements: Array.from(new Set(missingRequirements)),
    };
  }, [
    draft.draftStatus,
    schemaDraftPlan,
    selectedDateField,
    selectedDimension,
    selectedMeasure,
  ]);

  const controlledLogicDraft = useMemo(() => {
    if (!schemaDraftPlan || draft.draftStatus !== "drafted") return null;

    return buildControlledLogicDraft({
      draftPlan: schemaDraftPlan,
      schema: dataset.schema,
      selectedFields: {
        dimension: selectedDimension,
        measure: selectedMeasure,
        dateField: selectedDateField,
      },
    });
  }, [
    dataset.schema,
    draft.draftStatus,
    schemaDraftPlan,
    selectedDateField,
    selectedDimension,
    selectedMeasure,
  ]);

  const governedQueryBuilderRequestDraft = useMemo(() => {
    if (!controlledLogicDraft) return null;

    return buildGovernedQueryBuilderRequestDraft(controlledLogicDraft, dataset.schema);
  }, [controlledLogicDraft, dataset.schema]);
  const governedRequestHasFilters =
    (governedQueryBuilderRequestDraft?.request?.filters.length || 0) > 0;
  const canApplyGovernedRequest =
    governedQueryBuilderRequestDraft?.status === "created_for_review" &&
    Boolean(governedQueryBuilderRequestDraft.request) &&
    !governedRequestHasFilters;

  const controlledLogicSummary = controlledLogicDraft
    ? [
        controlledLogicDraft.grouping.summary,
        controlledLogicDraft.aggregation.summary,
        controlledLogicDraft.sorting?.reason || "",
        controlledLogicDraft.limit.value
          ? `Use a ${controlledLogicDraft.limit.value}-row limit idea for review only.`
          : "",
      ].filter(Boolean).join(" ")
    : "";

  const futureExecutionPreview = controlledLogicDraft
    ? {
        groupingPreview: controlledLogicDraft.grouping.fields.join(", ") || "No grouping preview",
        measurePreview: formatAggregationPreview(
          controlledLogicDraft.aggregation.idea,
          controlledLogicDraft.aggregation.field,
        ),
        sortPreview: controlledLogicDraft.sorting
          ? `${controlledLogicDraft.sorting.direction?.toUpperCase() || "REVIEW"} ${
              controlledLogicDraft.sorting.field || "draft value"
            }`
          : "No sort preview",
        plannedOutput: formatFutureOutputPreview(controlledLogicDraft.plannedOutputType),
        limitPreview: controlledLogicDraft.limit.value
          ? `Top ${controlledLogicDraft.limit.value} rows`
          : "No limit preview",
        narrativeItems: [
          controlledLogicDraft.grouping.fields.length > 0
            ? `Future execution would likely group by ${controlledLogicDraft.grouping.fields.join(", ")}.`
            : "Future execution would not add grouping until the needed field is confirmed.",
          controlledLogicDraft.aggregation.field
            ? `Future execution would likely aggregate ${controlledLogicDraft.aggregation.field}.`
            : "Future execution would likely use record count or wait for a reviewed measure.",
          controlledLogicDraft.sorting?.direction
            ? `Future execution would likely sort ${controlledLogicDraft.sorting.direction === "desc" ? "descending" : "ascending"}.`
            : "Future execution would not add sorting unless the reviewed logic needs it.",
          `Future execution would likely display a ${formatFutureOutputPreview(controlledLogicDraft.plannedOutputType)}.`,
          controlledLogicDraft.limit.value
            ? `Future execution would likely limit to top ${controlledLogicDraft.limit.value} rows.`
            : "Future execution would not add a row limit for this draft.",
        ],
      }
    : null;

  const prepareDraft = () => {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion) return;
    const nextSourceName = sourceName || dataset.table_name;

    setDraft({
      rawQuestion: nextQuestion,
      draftStatus: "drafted",
      activeDatasetId: dataset.dataset_id,
      activeWorksheetName: nextSourceName,
      createdAt: new Date().toISOString(),
    });
    setSchemaDraftPlan(
      createSchemaAwareDraftPlan({
        rawQuestion: nextQuestion,
        schema: dataset.schema,
        dataset,
        activeSourceName: nextSourceName,
      }),
    );
    setSelectedDimension(null);
    setSelectedMeasure(null);
    setSelectedDateField(null);
  };

  return (
    <section className="question-workspace-panel" aria-label="Workspace question preparation">
      <div className="question-workspace-copy">
        <p className="section-label">Workspace</p>
        <h2>Ask a business question</h2>
        <p>
          Start with what you want to learn. The workspace will prepare a reviewable analysis
          before anything runs.
        </p>
      </div>

      <div className="question-workspace-context" aria-label="Active dataset context">
        {datasetContext.map((item) => (
          <span key={item.label} title={item.value}>
            {item.label}
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>

      <label className="question-workspace-input">
        <span>Business question</span>
        <textarea
          value={rawQuestion}
          onChange={(event) => setRawQuestion(event.target.value)}
          placeholder="Ask about this dataset..."
          rows={3}
        />
      </label>

      <div className="question-workspace-starters" aria-label="Starter questions">
        {starterPrompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => setRawQuestion(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="question-workspace-actions">
        <button
          type="button"
          className="primary-button"
          onClick={prepareDraft}
          disabled={!rawQuestion.trim()}
        >
          Prepare answer
        </button>
      </div>

      {draft.draftStatus === "drafted" && (
        <section className="question-workspace-review" aria-label="Question review shell">
          <div>
            <p className="section-label">Investigation Review</p>
            <h3>A reviewable analysis plan will appear here.</h3>
          </div>

          <div className="question-workspace-protected-status" role="status">
            No query has been generated yet.
          </div>

          <dl className="question-workspace-review-card">
            <div>
              <dt>Question</dt>
              <dd>{draft.rawQuestion}</dd>
            </div>
            <div>
              <dt>Dataset</dt>
              <dd>{dataset.original_filename}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{draft.activeWorksheetName || dataset.table_name}</dd>
            </div>
            <div>
              <dt>Possible focus</dt>
              <dd>{schemaDraftPlan?.candidateDimensions[0]?.columnName || reviewHints.possibleFocus}</dd>
            </div>
            <div>
              <dt>Possible analysis type</dt>
              <dd>{schemaDraftPlan?.detectedIntent || reviewHints.possibleAnalysisType}</dd>
            </div>
            <div>
              <dt>Possible dimensions</dt>
              <dd>{formatCandidateFields(schemaDraftPlan?.candidateDimensions || [])}</dd>
            </div>
            <div>
              <dt>Possible measures</dt>
              <dd>{formatCandidateFields(schemaDraftPlan?.candidateMeasures || [])}</dd>
            </div>
            <div>
              <dt>Possible date fields</dt>
              <dd>{formatCandidateFields(schemaDraftPlan?.candidateDateFields || [])}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{schemaDraftPlan?.executionStatus || "Execution has not started"}</dd>
            </div>
          </dl>

          {schemaDraftPlan && !hasSchemaCandidates && (
            <p className="question-workspace-fallback">
              This question could not be confidently matched to fields yet.
            </p>
          )}

          <section className="question-workspace-intent" aria-label="Investigation intent">
            <div className="question-workspace-section-heading">
              <p className="section-label">Investigation Intent</p>
              <h4>Planning-only understanding</h4>
            </div>
            <div className="question-workspace-intent-grid">
              <article>
                <span>Primary intent</span>
                <strong>{schemaDraftPlan?.detectedIntent || reviewHints.detectedIntents[0]}</strong>
                <small>{schemaDraftPlan?.confidence || reviewHints.confidence} confidence</small>
              </article>
              <article>
                <span>Candidate fields</span>
                <strong>
                  {formatCandidateFields([
                    ...(schemaDraftPlan?.candidateDimensions || []),
                    ...(schemaDraftPlan?.candidateMeasures || []),
                    ...(schemaDraftPlan?.candidateDateFields || []),
                  ])}
                </strong>
                <small>Schema match only</small>
              </article>
              <article>
                <span>Planned outputs</span>
                <strong>{schemaDraftPlan?.plannedOutputType || reviewHints.plannedOutputs.join(", ")}</strong>
                <small>Non-executable preview</small>
              </article>
            </div>
          </section>

          {schemaDraftPlan && (
            <section className="question-workspace-schema-review" aria-label="Schema-aware draft plan">
              <div className="question-workspace-section-heading">
                <p className="section-label">Matched Dataset Fields</p>
                <h4>Schema-aware draft plan</h4>
              </div>
              <div className="question-workspace-schema-grid">
                <article>
                  <span>Dimensions</span>
                  <strong>{formatCandidateFields(schemaDraftPlan.candidateDimensions)}</strong>
                </article>
                <article>
                  <span>Measures</span>
                  <strong>{formatCandidateFields(schemaDraftPlan.candidateMeasures)}</strong>
                </article>
                <article>
                  <span>Date fields</span>
                  <strong>{formatCandidateFields(schemaDraftPlan.candidateDateFields)}</strong>
                </article>
              </div>

              {schemaDraftPlan.ambiguousTerms.length > 0 && (
                <div className="question-workspace-schema-list">
                  <span>Ambiguous terms</span>
                  {schemaDraftPlan.ambiguousTerms.map((item) => (
                    <p key={item.term}>
                      <strong>{item.term}</strong>:{" "}
                      {item.candidates.map((candidate) => candidate.columnName).join(", ")}
                    </p>
                  ))}
                </div>
              )}

              {schemaDraftPlan.missingRequirements.length > 0 && (
                <div className="question-workspace-schema-list is-clarification">
                  <span>Clarification needs</span>
                  <p>{schemaDraftPlan.missingRequirements.join(", ")}</p>
                </div>
              )}

              <section className="question-workspace-clarification" aria-label="Planning clarification choices">
                <div className="question-workspace-section-heading">
                  <p className="section-label">Planning Choices Only</p>
                  <h4>{planningClarityStatus}</h4>
                </div>

                {schemaDraftPlan.missingRequirements.length > 0 && (
                  <div className="question-workspace-clarification-needs">
                    <span>Needs clarification</span>
                    <p>{schemaDraftPlan.missingRequirements.join(", ")}</p>
                  </div>
                )}

                {schemaDraftPlan.candidateDimensions.length > 0 && (
                  <div className="question-workspace-choice-group">
                    <span>Selected dimension: {selectedDimension || "None yet"}</span>
                    <div>
                      {schemaDraftPlan.candidateDimensions
                        .slice(0, 5)
                        .map((candidate) =>
                          renderCandidateChoice(candidate, "dimension", selectedDimension),
                        )}
                    </div>
                  </div>
                )}

                {schemaDraftPlan.candidateMeasures.length > 0 && (
                  <div className="question-workspace-choice-group">
                    <span>Selected measure: {selectedMeasure || "None yet"}</span>
                    <div>
                      {schemaDraftPlan.candidateMeasures
                        .slice(0, 5)
                        .map((candidate) =>
                          renderCandidateChoice(candidate, "measure", selectedMeasure),
                        )}
                    </div>
                  </div>
                )}

                {schemaDraftPlan.candidateDateFields.length > 0 && (
                  <div className="question-workspace-choice-group">
                    <span>Selected date field: {selectedDateField || "None yet"}</span>
                    <div>
                      {schemaDraftPlan.candidateDateFields
                        .slice(0, 5)
                        .map((candidate) =>
                          renderCandidateChoice(candidate, "date", selectedDateField),
                        )}
                    </div>
                  </div>
                )}
              </section>

              {schemaDraftPlan.suggestedClarifyingQuestions.length > 0 && (
                <div className="question-workspace-schema-list">
                  <span>Suggested clarifying questions</span>
                  <div className="question-workspace-clarifying-chips">
                    {schemaDraftPlan.suggestedClarifyingQuestions.map((question) => (
                      <button
                        type="button"
                        key={question}
                        onClick={() => setRawQuestion(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {investigationBlueprint && (
            <section className="question-workspace-blueprint" aria-label="Investigation blueprint">
              <div className="question-workspace-section-heading">
                <p className="section-label">Investigation Blueprint</p>
                <h4>Planning only - no query has run.</h4>
              </div>

              <div className="question-workspace-blueprint-grid">
                <article>
                  <span>Business question</span>
                  <strong>{draft.rawQuestion}</strong>
                </article>
                <article>
                  <span>Fields to inspect</span>
                  <strong>{investigationBlueprint.fieldsToInspect}</strong>
                </article>
                <article>
                  <span>Grouping / comparison direction</span>
                  <strong>{investigationBlueprint.groupingDirection}</strong>
                </article>
                <article>
                  <span>Possible calculation approach</span>
                  <strong>{investigationBlueprint.calculationApproach}</strong>
                </article>
                <article>
                  <span>Expected output shape</span>
                  <strong>{investigationBlueprint.expectedOutputShape}</strong>
                </article>
                <article>
                  <span>Validation checks before execution</span>
                  <ul>
                    {investigationBlueprint.validationChecks.map((check) => (
                      <li key={check}>{check}</li>
                    ))}
                  </ul>
                </article>
              </div>

              <div className="question-workspace-blueprint-note">
                <span>Why this approach?</span>
                <p>{investigationBlueprint.whyThisApproach}</p>
              </div>

              <div className="question-workspace-blueprint-note">
                <span>Before execution, this still needs...</span>
                {investigationBlueprint.missingRequirements.length > 0 ? (
                  <ul>
                    {investigationBlueprint.missingRequirements.map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Field choices look ready for future logic generation, but no executable plan exists yet.</p>
                )}
              </div>

              <div className="question-workspace-future-path">
                <span>Future execution path</span>
                <ol>
                  <li>Prepare Query Builder request</li>
                  <li>Review generated logic</li>
                  <li>Run through existing execution engine</li>
                  <li>Show real result in ResultsGrid</li>
                </ol>
              </div>
            </section>
          )}

          {controlledLogicDraft && (
            <section className="question-workspace-logic-draft" aria-label="Controlled logic draft">
              <div className="question-workspace-section-heading">
                <p className="section-label">Draft logic only</p>
                <h4>No executable request exists.</h4>
              </div>

              <div className="question-workspace-protection-copy">
                <span>No query has been generated.</span>
                <span>No SQL has been generated.</span>
                <span>No backend query has executed.</span>
                <span>Future Query Builder request has not been created yet.</span>
              </div>

              {controlledLogicDraft.blockingRequirements.length > 0 && (
                <p className="question-workspace-fallback">
                  More clarification is needed before future logic generation.
                </p>
              )}

              <div className="question-workspace-logic-summary">
                <span>Logic summary</span>
                <p>{controlledLogicSummary}</p>
              </div>

              <div className="question-workspace-logic-grid">
                <article>
                  <span>Selected fields</span>
                  <strong>
                    Dimension: {controlledLogicDraft.selectedFields.dimension || "not selected"}
                  </strong>
                  <small>Measure: {controlledLogicDraft.selectedFields.measure || "not selected"}</small>
                  <small>Date field: {controlledLogicDraft.selectedFields.dateField || "not selected"}</small>
                </article>
                <article>
                  <span>Grouping idea</span>
                  <strong>
                    {controlledLogicDraft.grouping.fields.length > 0
                      ? controlledLogicDraft.grouping.fields.join(", ")
                      : "No grouping prepared"}
                  </strong>
                  <small>{controlledLogicDraft.grouping.summary}</small>
                </article>
                <article>
                  <span>Aggregation idea</span>
                  <strong>{formatPlanLabel(controlledLogicDraft.aggregation.idea)}</strong>
                  <small>
                    Field: {controlledLogicDraft.aggregation.field || "record count or none"}
                  </small>
                </article>
                <article>
                  <span>Sorting idea</span>
                  <strong>
                    {controlledLogicDraft.sorting
                      ? `${controlledLogicDraft.sorting.direction || "review"} ${controlledLogicDraft.sorting.field || "draft value"}`
                      : "No sorting prepared"}
                  </strong>
                  <small>{controlledLogicDraft.sorting?.reason || "No sort idea is needed for this draft."}</small>
                </article>
                <article>
                  <span>Limit idea</span>
                  <strong>{formatNullablePlanValue(controlledLogicDraft.limit.value)}</strong>
                  <small>{controlledLogicDraft.limit.reason}</small>
                </article>
                <article>
                  <span>Planned output type</span>
                  <strong>{formatPlanLabel(controlledLogicDraft.plannedOutputType)}</strong>
                  <small>Business-readable draft shape only</small>
                </article>
                <article>
                  <span>Execution status</span>
                  <strong>{controlledLogicDraft.executionStatus}</strong>
                  <small>Draft status: {formatPlanLabel(controlledLogicDraft.draftStatus)}</small>
                </article>
                <article>
                  <span>generatedSql</span>
                  <strong>{formatNullablePlanValue(controlledLogicDraft.generatedSql)}</strong>
                  <small>No SQL has been generated.</small>
                </article>
                <article>
                  <span>generatedQueryBuilderRequest</span>
                  <strong>{formatNullablePlanValue(controlledLogicDraft.generatedQueryBuilderRequest)}</strong>
                  <small>Future Query Builder request has not been created yet.</small>
                </article>
              </div>

              <div className="question-workspace-logic-columns">
                <div className="question-workspace-blueprint-note">
                  <span>Validation warnings</span>
                  {controlledLogicDraft.validationWarnings.length > 0 ? (
                    <ul>
                      {controlledLogicDraft.validationWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No validation warnings for this draft.</p>
                  )}
                </div>

                <div className="question-workspace-blueprint-note">
                  <span>Blocking requirements</span>
                  {controlledLogicDraft.blockingRequirements.length > 0 ? (
                    <ul>
                      {controlledLogicDraft.blockingRequirements.map((requirement) => (
                        <li key={requirement}>{formatPlanLabel(requirement)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No blocking requirements remain for this advisory draft.</p>
                  )}
                </div>
              </div>

              {futureExecutionPreview && (
                <section
                  className="question-workspace-execution-preview"
                  aria-label="Future Query Builder planning preview"
                >
                  <div className="question-workspace-section-heading">
                    <p className="section-label">Future execution preview</p>
                    <h4>Future Query Builder Planning Preview</h4>
                  </div>

                  <p className="question-workspace-preview-explainer">
                    This preview explains how the investigation may be structured later before any real execution occurs.
                  </p>

                  <ul className="question-workspace-preview-list">
                    {futureExecutionPreview.narrativeItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  <div className="question-workspace-preview-grid">
                    <article>
                      <span>Grouping Preview</span>
                      <strong>{futureExecutionPreview.groupingPreview}</strong>
                      <small>Text preview only</small>
                    </article>
                    <article>
                      <span>Measure Preview</span>
                      <strong>{futureExecutionPreview.measurePreview}</strong>
                      <small>Text preview only</small>
                    </article>
                    <article>
                      <span>Sort Preview</span>
                      <strong>{futureExecutionPreview.sortPreview}</strong>
                      <small>Text preview only</small>
                    </article>
                    <article>
                      <span>Planned Output</span>
                      <strong>{futureExecutionPreview.plannedOutput}</strong>
                      <small>Display expectation only</small>
                    </article>
                    <article>
                      <span>Limit Preview</span>
                      <strong>{futureExecutionPreview.limitPreview}</strong>
                      <small>Text preview only</small>
                    </article>
                  </div>

                  <div className="question-workspace-governance-panel">
                    <span>Protected governance state</span>
                    <dl>
                      <div>
                        <dt>executionStatus</dt>
                        <dd>{controlledLogicDraft.executionStatus}</dd>
                      </div>
                      <div>
                        <dt>generatedSql</dt>
                        <dd>{formatNullablePlanValue(controlledLogicDraft.generatedSql)}</dd>
                      </div>
                      <div>
                        <dt>generatedQueryBuilderRequest</dt>
                        <dd>{formatNullablePlanValue(controlledLogicDraft.generatedQueryBuilderRequest)}</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              )}

              {governedQueryBuilderRequestDraft && (
                <section
                  className="question-workspace-execution-preview"
                  aria-label="Query Builder request draft"
                >
                  <div className="question-workspace-section-heading">
                    <p className="section-label">Query Builder request draft</p>
                    <h4>Review draft only - not sent to Query Builder yet.</h4>
                  </div>

                  <div className="question-workspace-protection-copy">
                    <span>No SQL has been generated.</span>
                    <span>No backend query has executed.</span>
                    <span>No Query Builder result has been created.</span>
                    <span>User must run separately from Query Builder.</span>
                  </div>

                  <p className="question-workspace-preview-explainer">
                    This request exists only as local review state. It has not been sent to Query Builder or the backend.
                  </p>

                  {governedRequestHasFilters && (
                    <p className="question-workspace-fallback">
                      This draft includes filters. Filter handoff needs a later governed checkpoint before applying it to Query Builder.
                    </p>
                  )}

                  {canApplyGovernedRequest && onApplyQueryBuilderRequestDraft && (
                    <div className="question-workspace-actions">
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                          onApplyQueryBuilderRequestDraft(governedQueryBuilderRequestDraft)
                        }
                      >
                        Apply to Query Builder for Review
                      </button>
                    </div>
                  )}

                  <div className="question-workspace-preview-grid">
                    <article>
                      <span>Status</span>
                      <strong>{governedQueryBuilderRequestDraft.status}</strong>
                      <small>Local eligibility state only</small>
                    </article>
                    <article>
                      <span>executionStatus</span>
                      <strong>{governedQueryBuilderRequestDraft.executionStatus}</strong>
                      <small>Nothing has executed.</small>
                    </article>
                    <article>
                      <span>generatedSql</span>
                      <strong>{formatNullablePlanValue(governedQueryBuilderRequestDraft.generatedSql)}</strong>
                      <small>No SQL has been generated.</small>
                    </article>
                    <article>
                      <span>Request scope</span>
                      <strong>
                        {governedQueryBuilderRequestDraft.request
                          ? "Local review candidate"
                          : "No request candidate"}
                      </strong>
                      <small>No Query Builder state has changed.</small>
                    </article>
                  </div>

                  {governedQueryBuilderRequestDraft.status === "blocked" && (
                    <p className="question-workspace-fallback">
                      More clarification is needed before a reviewable request can be prepared.
                    </p>
                  )}

                  {governedQueryBuilderRequestDraft.request && (
                    <>
                      <div className="question-workspace-logic-summary">
                        <span>Review draft only</span>
                        <p>
                          This structured candidate shows how a future Query Builder request may be prepared after review. It has not run and has not changed the Query Builder.
                        </p>
                      </div>

                      <div className="question-workspace-preview-grid">
                        <article>
                          <span>Selected columns</span>
                          <strong>
                            {formatRequestList(governedQueryBuilderRequestDraft.request.selected_columns)}
                          </strong>
                          <small>Reviewed field projection</small>
                        </article>
                        <article>
                          <span>Group by</span>
                          <strong>
                            {formatRequestList(governedQueryBuilderRequestDraft.request.group_by)}
                          </strong>
                          <small>Future grouping preview</small>
                        </article>
                        <article>
                          <span>Aggregations</span>
                          <strong>
                            {governedQueryBuilderRequestDraft.request.aggregations.length > 0
                              ? governedQueryBuilderRequestDraft.request.aggregations
                                  .map(formatRequestAggregation)
                                  .join(", ")
                              : "None"}
                          </strong>
                          <small>Structured candidate only</small>
                        </article>
                        <article>
                          <span>Filters</span>
                          <strong>
                            {governedQueryBuilderRequestDraft.request.filters.length > 0
                              ? governedQueryBuilderRequestDraft.request.filters
                                  .map(formatRequestFilter)
                                  .join("; ")
                              : "None"}
                          </strong>
                          <small>Only complete reviewed filters are included</small>
                        </article>
                        <article>
                          <span>Order by</span>
                          <strong>
                            {governedQueryBuilderRequestDraft.request.order_by
                              ? `${governedQueryBuilderRequestDraft.request.order_by.direction} ${governedQueryBuilderRequestDraft.request.order_by.column}`
                              : "None"}
                          </strong>
                          <small>Sort candidate preview</small>
                        </article>
                        <article>
                          <span>Limit</span>
                          <strong>{governedQueryBuilderRequestDraft.request.limit}</strong>
                          <small>Page {governedQueryBuilderRequestDraft.request.page}</small>
                        </article>
                      </div>
                    </>
                  )}

                  <div className="question-workspace-logic-columns">
                    <div className="question-workspace-blueprint-note">
                      <span>Blocking requirements</span>
                      {governedQueryBuilderRequestDraft.blockingRequirements.length > 0 ? (
                        <ul>
                          {governedQueryBuilderRequestDraft.blockingRequirements.map((requirement) => (
                            <li key={requirement}>{formatPlanLabel(requirement)}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No blocking requirements are attached to this request draft.</p>
                      )}
                    </div>

                    <div className="question-workspace-blueprint-note">
                      <span>Validation warnings</span>
                      {governedQueryBuilderRequestDraft.validationWarnings.length > 0 ? (
                        <ul>
                          {governedQueryBuilderRequestDraft.validationWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No validation warnings are attached to this request draft.</p>
                      )}
                    </div>
                  </div>

                  <div className="question-workspace-governance-panel">
                    <span>Protected request state</span>
                    <dl>
                      <div>
                        <dt>generatedSql</dt>
                        <dd>{formatNullablePlanValue(governedQueryBuilderRequestDraft.generatedSql)}</dd>
                      </div>
                      <div>
                        <dt>executionStatus</dt>
                        <dd>{governedQueryBuilderRequestDraft.executionStatus}</dd>
                      </div>
                      <div>
                        <dt>request locality</dt>
                        <dd>local review state only</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              )}
            </section>
          )}

          <section className="question-workspace-strategy" aria-label="Potential investigation strategy">
            <div className="question-workspace-section-heading">
              <p className="section-label">Potential Investigation Strategy</p>
              <h4>Future execution stages</h4>
            </div>
            <div className="question-workspace-strategy-grid">
              {reviewHints.potentialStrategies.map((strategy) => (
                <article key={strategy}>
                  <strong>{strategy}</strong>
                  <span>Planning only</span>
                </article>
              ))}
            </div>
          </section>

          <div className="question-workspace-timeline" aria-label="Planned investigation steps">
            {plannedSteps.map((step, index) => (
              <span key={step.label}>
                <strong>{index + 1}. {step.label}</strong>
                <small>{step.detail}</small>
              </span>
            ))}
          </div>

          {reviewHints.starterSuggestions.length > 0 && (
            <div className="question-workspace-suggestions" aria-label="Suggested question refinements">
              <span>Suggested refinements</span>
              <div>
                {reviewHints.starterSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => setRawQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <section className="question-workspace-boundary" aria-label="Execution boundary">
            <p className="section-label">Execution Boundary</p>
            <ul>
              <li>No query has been generated.</li>
              <li>No SQL has been generated.</li>
              <li>No backend query has executed.</li>
              <li>This is a planning-only review layer.</li>
            </ul>
          </section>

          <p>
            <strong>No query has run yet.</strong>
          </p>
          <p>Generated logic will appear in a later checkpoint.</p>
        </section>
      )}
    </section>
  );
}

export default QuestionWorkspacePanel;
