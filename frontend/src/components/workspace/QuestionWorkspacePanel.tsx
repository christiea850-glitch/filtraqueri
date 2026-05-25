import { useMemo, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";

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
};

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

function QuestionWorkspacePanel({ dataset, sourceName }: QuestionWorkspacePanelProps) {
  const [rawQuestion, setRawQuestion] = useState("");
  const [draft, setDraft] = useState<WorkspaceQuestionDraft>(createInitialDraft);

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

  const prepareDraft = () => {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion) return;

    setDraft({
      rawQuestion: nextQuestion,
      draftStatus: "drafted",
      activeDatasetId: dataset.dataset_id,
      activeWorksheetName: sourceName || dataset.table_name,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <section className="question-workspace-panel" aria-label="Workspace question preparation">
      <div className="question-workspace-copy">
        <p className="section-label">Workspace</p>
        <h2>Ask a business question</h2>
        <p>
          Start with what you want to learn. FiltraQueri will prepare a reviewable analysis
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
            <h3>FiltraQueri will prepare an analysis plan here.</h3>
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
              <dd>{reviewHints.possibleFocus}</dd>
            </div>
            <div>
              <dt>Possible analysis type</dt>
              <dd>{reviewHints.possibleAnalysisType}</dd>
            </div>
            <div>
              <dt>Possible dimensions</dt>
              <dd>{reviewHints.possibleDimensions.join(", ")}</dd>
            </div>
            <div>
              <dt>Possible measures</dt>
              <dd>{reviewHints.possibleMeasures.join(", ")}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>Execution has not started</dd>
            </div>
          </dl>

          <section className="question-workspace-intent" aria-label="Investigation intent">
            <div className="question-workspace-section-heading">
              <p className="section-label">Investigation Intent</p>
              <h4>Planning-only understanding</h4>
            </div>
            <div className="question-workspace-intent-grid">
              <article>
                <span>Primary intent</span>
                <strong>{reviewHints.detectedIntents[0]}</strong>
                <small>{reviewHints.confidence} confidence</small>
              </article>
              <article>
                <span>Detected business entities</span>
                <strong>{reviewHints.detectedEntities.join(", ")}</strong>
                <small>Frontend text match only</small>
              </article>
              <article>
                <span>Planned outputs</span>
                <strong>{reviewHints.plannedOutputs.join(", ")}</strong>
                <small>Non-executable preview</small>
              </article>
            </div>
          </section>

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
