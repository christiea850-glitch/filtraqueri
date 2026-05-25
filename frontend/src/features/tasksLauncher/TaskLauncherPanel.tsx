import { useEffect, useMemo, useState } from "react";
import type { DatasetMetadata, WorkspaceMode } from "../dataset/datasetTypes";
import type { AnalyticsTask, AnalyticsTaskCategory } from "../tasks";
import {
  getAnalysisPlanReadinessLabel,
  useAnalysisPlan,
} from "../analysisPlan";
import { useAnalyticsIntentGraph } from "../analyticsIntentGraph";
import { useAnalyticsPlanning } from "../analyticsPlanning";
import { useBusinessQuestions } from "../businessQuestionIntelligence";
import { useBusinessSemantics } from "../businessSemantics";
import { useDataIntelligence } from "../dataIntelligence";
import { createSchemaDisplayProfiles, getBusinessRoleLabel } from "../dataIntelligence/structuralPresentation";
import { getEngineReadinessLabel, listEngineCapabilities, useEngineAdapters } from "../engineAdapters";
import { useExecutionContracts } from "../executionContracts";
import {
  getExecutionPreviewConfidenceLabel,
  getExecutionPreviewResultShapeLabel,
  useExecutionPreview,
} from "../executionPreview";
import { useExplanationLayer } from "../explanations";
import {
  getGuidedInputPrompt,
  getGuidedInputValidationMessage,
  useGuidedInputs,
} from "../guidedInputs";
import {
  getPlanningReadinessStatusLabel,
  getPlanningReadinessTone,
  usePlanningReadiness,
} from "../planningReadiness";
import {
  getRelationshipPlanningReadinessLabel,
  useRelationshipAwarePlanning,
} from "../relationshipAwarePlanning";
import {
  getTaskConfigurationReadinessLabel,
  listMissingRequiredTaskInputs,
  useTaskConfiguration,
} from "../taskConfiguration";
import {
  getTaskPlanPreviewConfidenceLabel,
  useTaskPlanPreview,
} from "../taskPlanPreview";
import { useKpiIntelligence } from "../kpiIntelligence";
import { useWorkflowRecommendations } from "../workflowRecommendations";
import useTaskLauncher from "./useTaskLauncher";

type FieldSuggestion = {
  label: string;
  value: string;
  inputType: "metric" | "dateField" | "entityField" | "groupingField" | "dimension";
  helper: string;
  confidence: "High" | "Medium" | "Low";
};

const uniqueSuggestionValues = (suggestions: FieldSuggestion[]) => {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.inputType}:${suggestion.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function TaskDetail({
  task,
  dataset,
  mode,
  onClose,
}: {
  task: AnalyticsTask;
  dataset: DatasetMetadata | null;
  mode: WorkspaceMode;
  onClose?: () => void;
}) {
  const { configuration, updateInput } = useTaskConfiguration(task);
  const guidedInputs = useGuidedInputs({
    task,
    dataset,
    configuration,
    onInputChange: updateInput,
  });
  const { analysisPlan } = useAnalysisPlan(task, configuration);
  const relationshipPlan = useRelationshipAwarePlanning(task, dataset);
  const { businessExplanation } = useExplanationLayer(task, analysisPlan, relationshipPlan);
  const engineCompatibility = useEngineAdapters(task, analysisPlan);
  const planningReadiness = usePlanningReadiness({
    task,
    configuration,
    analysisPlan,
    engineCompatibility,
    relationshipPlan,
    explanation: businessExplanation,
  });
  const taskPlanPreview = useTaskPlanPreview({
    task,
    guidedInputState: guidedInputs.state,
    analysisPlan,
    relationshipPlan,
    engineCompatibility,
    planningReadiness,
    explanation: businessExplanation,
  });
  const { executionPreview } = useExecutionPreview({
    task,
    guidedInputState: guidedInputs.state,
    analysisPlan,
    relationshipPlan,
    engineCompatibility,
    planningReadiness,
    explanation: businessExplanation,
  });
  const { dataProfile, dialectRecommendation } = useDataIntelligence(dataset);
  const schema = Array.isArray(dataset?.schema) ? dataset.schema : [];
  const displayProfiles = useMemo(() => createSchemaDisplayProfiles(schema), [schema]);
  const {
    recommendations,
    humanSummary: workflowRecommendationSummary,
    workflowRecommendationReport,
  } = useWorkflowRecommendations({
    dataProfile,
    dialectRecommendation,
    guidedInputState: guidedInputs.state,
    planningReadiness,
    executionPreview,
  });
  const {
    businessSemanticReport,
    detectedSemanticEntities,
    possibleBusinessKpis,
    humanSummary: semanticSummary,
  } = useBusinessSemantics({
    dataset,
    dataProfile,
    workflowRecommendationReport,
  });
  const {
    opportunities: kpiOpportunities,
    kpiIntelligenceReport,
    humanSummary: kpiSummary,
  } = useKpiIntelligence({
    dataProfile,
    businessSemanticReport,
    workflowRecommendationReport,
    executionPreview,
    guidedInputState: guidedInputs.state,
    planningReadiness,
  });
  const {
    interpretedQuestions,
    businessQuestionReport,
    humanSummary: questionSummary,
  } = useBusinessQuestions({
    datasetId: dataset?.dataset_id || null,
    questions: [
      task.label,
      "Which products sell the most?",
      "Are sales increasing?",
      "Can this data support forecasting?",
    ],
    businessSemanticReport,
    kpiIntelligenceReport,
    workflowRecommendationReport,
    executionPreview,
    guidedInputState: guidedInputs.state,
    planningReadiness,
  });
  const {
    analyticsIntentGraph,
    humanSummary: graphSummary,
  } = useAnalyticsIntentGraph({
    datasetId: dataset?.dataset_id || null,
    dataProfile,
    dialectRecommendation,
    workflowRecommendationReport,
    businessSemanticReport,
    kpiIntelligenceReport,
    businessQuestionReport,
    executionPreview,
    planningReadiness,
  });
  const {
    analyticsPlan,
    humanSummary: planningSummary,
  } = useAnalyticsPlanning({
    datasetId: dataset?.dataset_id || null,
    dataProfile,
    workflowRecommendationReport,
    kpiIntelligenceReport,
    businessSemanticReport,
    businessQuestionReport,
    analyticsIntentGraph,
    executionPreview,
    planningReadiness,
  });
  const {
    executionContract,
    humanSummary: executionContractSummary,
  } = useExecutionContracts({
    datasetId: dataset?.dataset_id || null,
    analyticsPlan,
    analyticsIntentGraph,
    dataProfile,
    workflowRecommendationReport,
    kpiIntelligenceReport,
    businessSemanticReport,
    businessQuestionReport,
    executionPreview,
    planningReadiness,
  });
  const missingInputs = configuration
    ? listMissingRequiredTaskInputs(task, configuration)
    : [];
  const readinessLabel = configuration
    ? getTaskConfigurationReadinessLabel(configuration)
    : "Task not ready";
  const planReadinessLabel = getAnalysisPlanReadinessLabel(analysisPlan);
  const primaryReadinessSummary =
    planningReadiness.status === "ready_for_future_execution"
      ? "FiltraQueri has enough context to guide this investigation."
      : missingInputs.length > 0
        ? "A little more business context is needed before this investigation is ready."
        : planningReadiness.status === "unsupported"
          ? "This investigation does not fit the current dataset yet."
          : planningReadiness.status === "engine_limited"
            ? "This investigation is possible, but FiltraQueri has limited confidence."
            : planningReadiness.status === "relationship_dependent"
              ? "Related worksheet context may help this investigation."
              : "This investigation is partly prepared and needs a little more context.";
  const visibleNotes = [
    ...planningReadiness.futureExecutionBlockers,
    ...planningReadiness.futureExecutionNotes,
  ].slice(0, 4);
  const visibleInputs = [...task.requiredInputs, ...task.optionalInputs];
  const requiredInputs = task.requiredInputs;
  const optionalInputs = task.optionalInputs;
  const canShowPreparationContext = missingInputs.length === 0;
  const metricSuggestions = uniqueSuggestionValues([
    ...(dataProfile?.possibleMetrics.slice(0, 4).map((field) => ({
      label: field.name,
      value: field.name,
      inputType: "metric" as const,
      helper: "Possible revenue or transaction metric",
      confidence: field.confidence === "high" ? "High" as const : "Medium" as const,
    })) || []),
    ...displayProfiles
      .filter((profile) => profile.role === "amount" || profile.role === "quantity")
      .slice(0, 3)
      .map((profile) => ({
        label: profile.sourceName,
        value: profile.sourceName,
        inputType: "metric" as const,
        helper: profile.role === "amount" ? "Possible revenue field" : getBusinessRoleLabel(profile.role),
        confidence: profile.confidence === "high" ? "High" as const : "Medium" as const,
      })),
  ]).slice(0, 4);
  const dateSuggestions = uniqueSuggestionValues([
    ...(dataProfile?.dateTimeFields.slice(0, 3).map((field) => ({
      label: field.name,
      value: field.name,
      inputType: "dateField" as const,
      helper: "Possible timeline field",
      confidence: field.confidence === "high" ? "High" as const : "Medium" as const,
    })) || []),
    ...displayProfiles
      .filter((profile) => profile.role === "date")
      .slice(0, 2)
      .map((profile) => ({
        label: profile.sourceName,
        value: profile.sourceName,
        inputType: "dateField" as const,
        helper: "Possible date field",
        confidence: profile.confidence === "high" ? "High" as const : "Medium" as const,
      })),
  ]).slice(0, 3);
  const entitySuggestions = uniqueSuggestionValues(
    displayProfiles
      .filter((profile) => profile.role === "customer" || profile.role === "identifier" || profile.role === "description")
      .slice(0, 4)
      .map((profile) => ({
        label: profile.sourceName,
        value: profile.sourceName,
        inputType: "entityField" as const,
        helper:
          profile.role === "customer"
            ? "Possible customer field"
            : profile.role === "description"
              ? "Possible product or item field"
              : getBusinessRoleLabel(profile.role),
        confidence: profile.confidence === "high" ? "High" as const : "Medium" as const,
      })),
  ).slice(0, 3);
  const dimensionSuggestions = uniqueSuggestionValues([
    ...(dataProfile?.possibleDimensions.slice(0, 4).map((field) => ({
      label: field.name,
      value: field.name,
      inputType: "groupingField" as const,
      helper: "Possible category or segment",
      confidence: field.confidence === "high" ? "High" as const : "Medium" as const,
    })) || []),
    ...displayProfiles
      .filter((profile) => profile.role === "location" || profile.role === "status")
      .slice(0, 3)
      .map((profile) => ({
        label: profile.sourceName,
        value: profile.sourceName,
        inputType: "groupingField" as const,
        helper: profile.role === "location" ? "Possible region or location field" : getBusinessRoleLabel(profile.role),
        confidence: profile.confidence === "high" ? "High" as const : "Medium" as const,
      })),
  ]).slice(0, 4);
  const primaryMetric = metricSuggestions[0] || null;
  const primaryDate = dateSuggestions[0] || null;
  const primaryDimension = dimensionSuggestions[0] || entitySuggestions[0] || null;
  const suggestionGroups = [
    { id: "metric", title: "Suggested metric", suggestions: metricSuggestions },
    { id: "date", title: "Suggested timeline", suggestions: dateSuggestions },
    { id: "entity", title: "Suggested entity", suggestions: entitySuggestions },
    { id: "dimension", title: "Suggested dimension", suggestions: dimensionSuggestions },
  ].filter((group) => group.suggestions.length > 0);
  const allFieldSuggestions = [
    ...metricSuggestions,
    ...dateSuggestions,
    ...entitySuggestions,
    ...dimensionSuggestions,
  ];
  const getInputForSuggestion = (suggestion: FieldSuggestion) =>
    visibleInputs.find((input) => input.type === suggestion.inputType) ||
    (suggestion.inputType === "groupingField"
      ? visibleInputs.find((input) => input.type === "dimension")
      : null) ||
    (suggestion.inputType === "entityField"
      ? visibleInputs.find((input) => input.type === "groupingField")
      : null);
  const applySuggestion = (suggestion: FieldSuggestion) => {
    const input = getInputForSuggestion(suggestion);
    if (!input) return;
    guidedInputs.selectInputValue(input, suggestion.value);
  };
  const guidanceSummary =
    primaryMetric || primaryDate || primaryDimension
      ? `FiltraQueri detected a likely ${task.label.toLowerCase()} setup for this dataset.`
      : "FiltraQueri will suggest setup fields as soon as enough dataset context is available.";
  const readinessStateLabel = canShowPreparationContext
    ? "Ready to prepare"
    : missingInputs.some((input) => input.type === "metric")
      ? "Needs business metric"
      : missingInputs.some((input) => input.type === "dateField")
        ? "Missing timeline field"
        : suggestionGroups.length > 0
          ? "Suggested setup available"
          : "Needs required input";
  const noticedSignals = [
    primaryMetric
      ? `transaction-like numeric fields such as ${primaryMetric.label}`
      : "no obvious business metric yet",
    primaryDate ? `timeline data such as ${primaryDate.label}` : "no clean timeline field yet",
    entitySuggestions.length > 0
      ? `business entities such as ${entitySuggestions[0].label}`
      : "limited entity detection",
    dimensionSuggestions.length > 0
      ? `categories or segments such as ${dimensionSuggestions[0].label}`
      : null,
    (dataProfile?.workbookRelationshipContext.worksheetCount || 0) > 1
      ? "multiple sheets that may support relationship analysis"
      : null,
  ].filter(Boolean) as string[];
  const insightCards = [
    primaryMetric
      ? {
          title: "Possible revenue field detected",
          detail: primaryMetric.label,
          confidence: primaryMetric.confidence,
          suggestion: primaryMetric,
        }
      : {
          title: "Needs business metric",
          detail: "Pick a numeric field before continuing this investigation.",
          confidence: "Medium" as const,
        },
    primaryDate
      ? {
          title: "Timeline field available",
          detail: primaryDate.label,
          confidence: primaryDate.confidence,
          suggestion: primaryDate,
        }
      : {
          title: "Missing clean date field",
          detail: "Trend and forecasting previews need a timeline.",
          confidence: "High" as const,
        },
    primaryDimension
      ? {
          title: primaryDimension.inputType === "entityField" ? "Entity field detected" : "Category field detected",
          detail: primaryDimension.label,
          confidence: primaryDimension.confidence,
          suggestion: primaryDimension,
        }
      : {
          title: "Low confidence entity detection",
          detail: "Add a product, customer, or category field if relevant.",
          confidence: "Low" as const,
        },
    dataProfile?.timeSeriesReadiness.ready
      ? {
          title: "Good dataset for trend analysis",
          detail: "Metric and timeline signals are both present.",
          confidence: "High" as const,
        }
      : null,
    dataProfile?.statisticalReadiness.ready
      ? {
          title: "Suitable for comparison analysis",
          detail: "Numeric and grouping fields are available.",
          confidence: "Medium" as const,
        }
      : null,
  ].filter(Boolean).slice(0, 5) as Array<{
    title: string;
    detail: string;
    confidence: "High" | "Medium" | "Low";
    suggestion?: FieldSuggestion;
  }>;
  const possiblePreviewLabels = Array.from(
    new Set([
      task.label,
      ...(primaryMetric && primaryDimension ? ["Top performing products", "Lowest-performing categories"] : []),
      ...(primaryMetric && primaryDate ? ["Monthly revenue trends"] : []),
      ...(entitySuggestions.length > 0 && primaryDate ? ["Customer inactivity candidates"] : []),
      ...recommendations.slice(0, 2).map((recommendation) => recommendation.label),
      ...kpiOpportunities.slice(0, 2).map((opportunity) => opportunity.label),
    ]),
  ).slice(0, 5);
  const getSuggestionsForInput = (input: AnalyticsTask["requiredInputs"][number]) =>
    allFieldSuggestions.filter((suggestion) => getInputForSuggestion(suggestion)?.id === input.id);
  const getSmartOptionLabel = (input: AnalyticsTask["requiredInputs"][number], value: string, label: string) => {
    const suggestion = getSuggestionsForInput(input).find((item) => item.value === value);
    return suggestion ? `Recommended - ${suggestion.helper}: ${label}` : label;
  };

  return (
    <aside className="task-detail-panel" aria-label="Task details">
      <div className="builder-block-header">
        <span>Selected investigation</span>
        {onClose && (
          <button type="button" className="text-button" onClick={onClose}>
            Back to investigations
          </button>
        )}
      </div>

      <section className="task-focus-section task-summary-section" aria-label="Investigation Summary">
        <p className="section-label">Investigation</p>
        <h3>{task.label}</h3>
        <p>{task.description}</p>
        <div className="task-light-pill-row" aria-label="Expected outputs">
          {task.supportedResultTypes.slice(0, 3).map((resultType) => (
            <small key={resultType}>{resultType.replace(/_/g, " ")}</small>
          ))}
        </div>
      </section>

      <section className="task-focus-section task-noticed-section" aria-label="What FiltraQueri noticed">
        <div className="task-assistant-panel">
          <span>What FiltraQueri noticed</span>
          <strong>This dataset appears to contain:</strong>
          <ul>
            {noticedSignals.slice(0, 5).map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
          {possiblePreviewLabels.length > 0 && (
            <div>
              <span>May work well for</span>
              {possiblePreviewLabels.slice(0, 3).map((label) => (
                <small key={label}>{label}</small>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="task-focus-section task-actionable-insights" aria-label="Actionable data findings">
        <div className="task-focus-section-heading">
          <span>Data findings</span>
          <small>{insightCards.length} noticed</small>
        </div>
        <div className="task-insight-card-grid">
          {insightCards.map((card) => (
            <article className="task-insight-card" key={card.title}>
              <div>
                <strong>{card.title}</strong>
                <small>{card.confidence} confidence</small>
              </div>
              <p>{card.detail}</p>
              {card.suggestion && getInputForSuggestion(card.suggestion) && (
                <button type="button" onClick={() => applySuggestion(card.suggestion!)}>
                  Use this
                </button>
              )}
            </article>
          ))}
        </div>
      </section>

      {possiblePreviewLabels.length > 0 && (
        <section className="task-focus-section task-preview-suggestions" aria-label="Possible analysis previews">
          <div className="task-focus-section-heading">
            <span>Possible analysis previews</span>
            <small>Preview only</small>
          </div>
          <div>
            {possiblePreviewLabels.map((label) => (
              <small key={label}>{label}</small>
            ))}
          </div>
        </section>
      )}

      <section className="task-focus-section task-ai-suggestion-section" aria-label="AI Suggestions">
        <div className="task-ai-guidance-banner">
          <span>Suggested setup</span>
          <strong>{guidanceSummary}</strong>
          <div>
            {primaryMetric && <small>Metric: {primaryMetric.label}</small>}
            {primaryDate && <small>Timeline: {primaryDate.label}</small>}
            {primaryDimension && <small>Dimension: {primaryDimension.label}</small>}
          </div>
        </div>
        {suggestionGroups.length > 0 ? (
          <div className="task-suggestion-groups">
            {suggestionGroups.map((group) => (
              <div className="task-suggestion-group" key={group.id}>
                <span>{group.title}</span>
                <div>
                  {group.suggestions.map((suggestion) => {
                    const input = getInputForSuggestion(suggestion);
                    const isApplied = input
                      ? guidedInputs.getSelectionForInput(input.id)?.value === suggestion.value
                      : false;

                    return (
                      <button
                        type="button"
                        key={`${group.id}:${suggestion.value}`}
                        className={isApplied ? "is-applied" : ""}
                        onClick={() => applySuggestion(suggestion)}
                        disabled={!input}
                        title={suggestion.helper}
                      >
                        {suggestion.helper}
                        <small>{suggestion.label}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No likely field mappings were detected yet. Use the required inputs below to guide preparation.</p>
        )}
      </section>

      <section className="task-focus-section" aria-label="Inputs Required">
        <div className="task-focus-section-heading">
          <span>Inputs Required</span>
          <small>
            {missingInputs.length > 0
              ? `${missingInputs.length} missing`
            : "Ready"}
          </small>
        </div>
      {requiredInputs.length > 0 ? (
        <div className="guided-input-list">
          {requiredInputs.map((input) => {
            const options = guidedInputs.getOptionsForInput(input.id);
            const selection = guidedInputs.getSelectionForInput(input.id);
            const validation = getGuidedInputValidationMessage(guidedInputs.state, input.id);

            return (
            <label key={input.id}>
              <small>
                {input.label}
                {input.required ? " *" : ""}
              </small>
              <span>{getGuidedInputPrompt(input)}</span>
              {getSuggestionsForInput(input).length > 0 && (
                <div className="task-input-recommendations">
                  {getSuggestionsForInput(input).slice(0, 3).map((suggestion) => (
                    <button
                      type="button"
                      key={`${input.id}:${suggestion.value}`}
                      onClick={() => applySuggestion(suggestion)}
                    >
                      Recommended
                      <small>{suggestion.helper}</small>
                    </button>
                  ))}
                </div>
              )}
              <select
                value={selection?.value || ""}
                onChange={(event) => guidedInputs.selectInputValue(input, event.target.value)}
                aria-label={`${input.label} guided selection`}
              >
                <option value="">{input.placeholder || "Choose an option"}</option>
                {options.map((option) => (
                  <option key={option.id} value={option.value}>
                    {getSmartOptionLabel(input, option.value, option.label)}
                  </option>
                ))}
              </select>
              {validation && <em className={validation.severity}>{validation.message}</em>}
            </label>
            );
          })}
        </div>
      ) : (
          <p>No required inputs for this investigation.</p>
      )}
      </section>

      {optionalInputs.length > 0 && (
        <details className="task-prep-disclosure">
          <summary>Optional refinements</summary>
          <div className="guided-input-list">
            {optionalInputs.map((input) => {
              const options = guidedInputs.getOptionsForInput(input.id);
              const selection = guidedInputs.getSelectionForInput(input.id);
              const validation = getGuidedInputValidationMessage(guidedInputs.state, input.id);

              return (
                <label key={input.id}>
                  <small>{input.label}</small>
                  <span>{getGuidedInputPrompt(input)}</span>
                  {getSuggestionsForInput(input).length > 0 && (
                    <div className="task-input-recommendations">
                      {getSuggestionsForInput(input).slice(0, 3).map((suggestion) => (
                        <button
                          type="button"
                          key={`${input.id}:${suggestion.value}`}
                          onClick={() => applySuggestion(suggestion)}
                        >
                          Recommended
                          <small>{suggestion.helper}</small>
                        </button>
                      ))}
                    </div>
                  )}
                  <select
                    value={selection?.value || ""}
                    onChange={(event) => guidedInputs.selectInputValue(input, event.target.value)}
                    aria-label={`${input.label} guided selection`}
                  >
                    <option value="">{input.placeholder || "Choose an option"}</option>
                    {options.map((option) => (
                      <option key={option.id} value={option.value}>
                        {getSmartOptionLabel(input, option.value, option.label)}
                      </option>
                    ))}
                  </select>
                  {validation && <em className={validation.severity}>{validation.message}</em>}
                </label>
              );
            })}
          </div>
        </details>
      )}

      {canShowPreparationContext ? (
        <>
          <section className={`task-focus-section task-readiness-summary ${getPlanningReadinessTone(planningReadiness.status)}`} aria-label="Readiness">
            <div className="task-focus-section-heading">
              <span>Readiness confidence</span>
              <small>{readinessStateLabel}</small>
            </div>
            <div className="task-confidence-row">
              <small>{primaryDate ? "Ready for trend analysis" : "Missing timeline information"}</small>
              <small>{primaryDimension ? "Strong category detection" : "Weak entity mapping"}</small>
              <small>Forecasting confidence: {dataProfile?.timeSeriesReadiness.ready ? "Medium" : "Low"}</small>
            </div>
          </section>

          <section className="task-focus-section" aria-label="Notes and Guidance">
            <div className="task-focus-section-heading">
              <span>Notes / Guidance</span>
              <small>{mode === "analyst" ? "Analyst view" : "Human view"}</small>
            </div>
            {visibleNotes.length > 0 ? (
              <div className="task-guidance-list">
                {visibleNotes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            ) : (
              <p>Nothing runs from this preview. Review the suggested investigation context before moving forward.</p>
            )}
          </section>
        </>
      ) : (
        <section className="task-focus-section task-next-step-note" aria-label="Next step">
          <div className="task-focus-section-heading">
            <span>Ready State</span>
            <small>{readinessStateLabel}</small>
          </div>
          <p>{primaryReadinessSummary}</p>
        </section>
      )}

      <details className="task-advanced-disclosure">
        <summary>Advanced workflow metadata</summary>
      {businessExplanation && (
        <div className="business-explanation-panel">
          <span>{businessExplanation.title}</span>
          <p>{businessExplanation.summary}</p>
          <strong>{businessExplanation.businessMeaning}</strong>
          {businessExplanation.metadataAwareSummary && (
            <p>{businessExplanation.metadataAwareSummary}</p>
          )}
          <div>
            {businessExplanation.expectedOutputs.map((output) => (
              <small key={output}>{output}</small>
            ))}
          </div>
          <div>
            {businessExplanation.potentialInsights.map((insight) => (
              <small key={insight}>{insight}</small>
            ))}
          </div>
          <div>
            <small>{businessExplanation.explanationMode.replace(/_/g, " ")}</small>
            <small>{businessExplanation.dynamicReadiness.replace(/_/g, " ")}</small>
            <small>{businessExplanation.dataDependencyLevel.replace(/_/g, " ")}</small>
          </div>
        </div>
      )}
      <div className="task-detail-grid">
        <span>
          Required inputs
          <strong>{task.requiredInputs.map((input) => input.label).join(", ")}</strong>
        </span>
        <span>
          Expected outputs
          <strong>{task.supportedResultTypes.join(", ")}</strong>
        </span>
        <span>
          Supported analysis paths
          <strong>{task.supportedEngines.join(", ")}</strong>
        </span>
        <span>
          Explanation
          <strong>{task.explanationTemplateKey}</strong>
        </span>
        <span>
          Validation
          <strong>{readinessLabel}</strong>
        </span>
        <span>
          Plan state
          <strong>{planReadinessLabel}</strong>
        </span>
        <span>
          Relationship planning
          <strong>{getRelationshipPlanningReadinessLabel(relationshipPlan)}</strong>
        </span>
        <span>
          Workflow scope
          <strong>{planningReadiness.supportedWorkflowScope.replace(/_/g, " ")}</strong>
        </span>
      </div>
      {configuration && (
        <div className={`task-validation-state ${configuration.validationState}`}>
          <strong>{readinessLabel}</strong>
          <small>
            {missingInputs.length > 0
              ? `${missingInputs.length} required input${missingInputs.length === 1 ? "" : "s"} missing`
              : "All required metadata inputs are configured for future planning."}
          </small>
        </div>
      )}
      <div className={`planning-readiness-panel ${getPlanningReadinessTone(planningReadiness.status)}`}>
        <span>Planning metadata</span>
        <strong>{getPlanningReadinessStatusLabel(planningReadiness.status)}</strong>
        <p>{planningReadiness.beginnerSummary}</p>
        <div className="planning-readiness-grid">
          <small>{planningReadiness.confidenceLevel} confidence</small>
          <small>{planningReadiness.supportedWorkflowScope.replace(/_/g, " ")}</small>
          <small>{planningReadiness.explanationReadiness.replace(/_/g, " ")}</small>
          <small>
            {planningReadiness.engineCompatibilitySummary.compatibleEngines.length} analysis options
          </small>
        </div>
      </div>
      {analysisPlan && (
        <div className="analysis-plan-preview">
          <span>Future execution-step preview</span>
          {analysisPlan.executionSteps.map((step) => (
            <div key={step.id}>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </div>
          ))}
        </div>
      )}
      <div className="task-plan-preview-panel">
        <span>Future workflow preview</span>
        <strong>{taskPlanPreview.workflowSummary}</strong>
        <small>{getTaskPlanPreviewConfidenceLabel(taskPlanPreview.confidence)}</small>
        {taskPlanPreview.sections.map((section) => (
          <div className="task-plan-preview-section" key={section.id}>
            <span>{section.title}</span>
            {section.lines.slice(0, 3).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ))}
      </div>
      <div className="execution-preview-panel" aria-label="Future Execution Preview">
        <span>Future Execution Preview</span>
        <strong>{executionPreview.workflowSummary}</strong>
        <div className="execution-preview-meta">
          <small>{getExecutionPreviewConfidenceLabel(executionPreview)}</small>
          <small>{getExecutionPreviewResultShapeLabel(executionPreview)}</small>
          <small>{executionPreview.readinessStatus.replace(/_/g, " ")}</small>
        </div>
        {mode === "analyst" ? (
          <>
            <div className="execution-preview-stage-list">
              {executionPreview.plannedStages.map((stage, index) => (
                <div key={stage.stageId} className="execution-preview-stage">
                  <small>{index + 1}</small>
                  <div>
                    <strong>{stage.label}</strong>
                    <span>{stage.stageType.replace(/_/g, " ")}</span>
                    <p>{stage.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="execution-preview-note-list">
              <span>Analyst notes</span>
              {executionPreview.analystNotes.slice(0, 5).map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </>
        ) : (
          <p>{executionPreview.workflowSummary}</p>
        )}
        <div className="execution-preview-note-list">
          <span>Safety notes</span>
          {executionPreview.safetyNotes.slice(0, mode === "analyst" ? 5 : 3).map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </div>
      {recommendations.length > 0 && (
        <div className="workflow-recommendation-panel compact" aria-label="Task workflow recommendations">
          <span>Workflow recommendations</span>
          <strong>{workflowRecommendationSummary}</strong>
          <div className="workflow-recommendation-list">
            {recommendations.slice(0, mode === "analyst" ? 4 : 2).map((recommendation) => (
              <article className="workflow-recommendation-card" key={recommendation.id}>
                <strong>{recommendation.label}</strong>
                <p>{recommendation.humanSummary}</p>
                <div>
                  <small>{recommendation.confidence} confidence</small>
                  <small>{recommendation.possibleFutureResultShapes[0]?.replace(/_/g, " ") || "future result"}</small>
                </div>
                {mode === "analyst" && (
                  <div className="workflow-recommendation-analyst">
                    {recommendation.supportingMetadataSignals.slice(0, 3).map((item) => (
                      <p key={item.id}>{item.description}</p>
                    ))}
                    {recommendation.missingMetadataBlockers.slice(0, 2).map((blocker) => (
                      <p key={blocker}>{blocker}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {businessSemanticReport && (
        <div className="business-semantics-panel compact" aria-label="Task business semantic intelligence">
          <span>Business semantics</span>
          <strong>{semanticSummary}</strong>
          <div className="business-semantics-grid">
            {detectedSemanticEntities.slice(0, mode === "analyst" ? 5 : 3).map((entity) => (
              <article className="business-semantic-card" key={entity.id}>
                <strong>{entity.label}</strong>
                <span>{entity.confidence} confidence</span>
                {mode === "analyst" && (
                  <p>{entity.supportingMetadataSignals[0]?.description || "Detected from metadata."}</p>
                )}
              </article>
            ))}
          </div>
          {possibleBusinessKpis.length > 0 && (
            <div className="business-kpi-list">
              <span>Possible KPIs</span>
              {possibleBusinessKpis.slice(0, mode === "analyst" ? 5 : 3).map((kpi) => (
                <small key={kpi.id}>{kpi.label}</small>
              ))}
            </div>
          )}
        </div>
      )}
      {kpiOpportunities.length > 0 && (
        <div className="kpi-intelligence-panel compact" aria-label="Task KPI intelligence opportunities">
          <span>KPI intelligence</span>
          <strong>{kpiSummary}</strong>
          <div className="kpi-opportunity-list">
            {kpiOpportunities.slice(0, mode === "analyst" ? 4 : 2).map((opportunity) => (
              <article className="kpi-opportunity-card" key={opportunity.id}>
                <strong>{opportunity.label}</strong>
                <p>{opportunity.humanSummary}</p>
                <div>
                  <small>{opportunity.confidence} confidence</small>
                  <small>{opportunity.possibleChartTypes[0]?.replace(/_/g, " ") || "chart metadata"}</small>
                </div>
                {mode === "analyst" && (
                  <div className="kpi-opportunity-analyst">
                    {opportunity.possibleKpiFormulas.slice(0, 2).map((formula) => (
                      <p key={formula}>{formula}</p>
                    ))}
                    {opportunity.likelyBusinessQuestions.slice(0, 2).map((question) => (
                      <p key={question}>{question}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {interpretedQuestions.length > 0 && (
        <div className="business-question-panel compact" aria-label="Task business question intelligence">
          <span>Business questions</span>
          <strong>{questionSummary}</strong>
          <div className="business-question-list">
            {interpretedQuestions.slice(0, mode === "analyst" ? 4 : 2).map((interpretation) => (
              <article className="business-question-card" key={interpretation.id}>
                <strong>{interpretation.questionText}</strong>
                <p>{interpretation.humanSummary}</p>
                <div>
                  <small>{interpretation.confidence} confidence</small>
                  <small>{interpretation.detectedIntentCategory.replace(/_/g, " ")}</small>
                </div>
                {mode === "analyst" && (
                  <div className="business-question-analyst">
                    {interpretation.followUpSuggestions.slice(0, 2).map((suggestion) => (
                      <p key={suggestion}>{suggestion}</p>
                    ))}
                    {interpretation.requiredMissingMetadata.slice(0, 2).map((missing) => (
                      <p key={missing}>{missing}</p>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {analyticsIntentGraph && (
        <div className="analytics-intent-graph-panel compact" aria-label="Task analytics intent graph">
          <span>Intent graph</span>
          <strong>{graphSummary}</strong>
          <div className="analytics-intent-graph-grid">
            <span>
              Nodes
              <strong>{analyticsIntentGraph.nodes.length}</strong>
            </span>
            <span>
              Edges
              <strong>{analyticsIntentGraph.edges.length}</strong>
            </span>
            <span>
              Analysis paths
              <strong>{analyticsIntentGraph.recommendedFutureEngines.length}</strong>
            </span>
            <span>
              Needs review
              <strong>{analyticsIntentGraph.health.unresolvedDependencies.length}</strong>
            </span>
          </div>
          {mode === "analyst" && analyticsIntentGraph.health.unresolvedDependencies.length > 0 && (
            <div className="analytics-intent-graph-notes">
              {analyticsIntentGraph.health.unresolvedDependencies.slice(0, 3).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {analyticsPlan && (
        <div className="analytics-planning-panel compact" aria-label="Task analytics planning">
          <span>Analytics plan</span>
          <strong>{planningSummary}</strong>
          <div className="analytics-planning-grid">
            <span>
              Steps
              <strong>{analyticsPlan.sizing.estimatedFutureStepCount}</strong>
            </span>
            <span>
              Complexity
              <strong>{analyticsPlan.complexity}</strong>
            </span>
            <span>
              Outputs
              <strong>{analyticsPlan.projectedOutputs.length}</strong>
            </span>
            <span>
              Status
              <strong>{analyticsPlan.status.replace(/_/g, " ")}</strong>
            </span>
          </div>
          {mode === "analyst" && (
            <div className="analytics-planning-steps">
              {analyticsPlan.steps.slice(0, 5).map((step) => (
                <p key={step.stepId}>{step.label}: {step.status.replace(/_/g, " ")}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {executionContract && (
        <div className="execution-contract-panel compact" aria-label="Task run boundary layer">
          <span>Run boundary</span>
          <strong>{executionContractSummary}</strong>
          <div className="execution-contract-grid">
            <span>
              Stages
              <strong>{executionContract.sizing.estimatedExecutionStages}</strong>
            </span>
            <span>
              Outputs
              <strong>{executionContract.sizing.estimatedProjectedOutputs}</strong>
            </span>
            <span>
              Analysis paths
              <strong>{executionContract.engines.length}</strong>
            </span>
            <span>
              Score
              <strong>{executionContract.readinessScore}</strong>
            </span>
          </div>
          {mode === "analyst" && (
            <div className="execution-contract-notes">
              {executionContract.blockedReasons.slice(0, 3).map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
              {executionContract.relationshipDependencyChains.slice(0, 2).map((chain) => (
                <p key={chain}>{chain}</p>
              ))}
            </div>
          )}
        </div>
      )}
      {relationshipPlan.hasWorkbookContext && (
        <div className="relationship-aware-planning-panel">
          <span>Relationship-aware planning</span>
          <strong>{getRelationshipPlanningReadinessLabel(relationshipPlan)}</strong>
          {relationshipPlan.relatedWorksheets.length > 0 && (
            <div className="relationship-planning-chips">
              {relationshipPlan.relatedWorksheets.map((worksheet) => (
                <small key={worksheet}>{worksheet}</small>
              ))}
            </div>
          )}
          {relationshipPlan.suggestedRelationshipPaths.slice(0, 3).map((path) => (
            <div className="relationship-planning-path" key={path.join("->")}>
              {path.map((part, index) => (
                <small key={part}>
                  {index > 0 ? "-> " : ""}
                  {part}
                </small>
              ))}
            </div>
          ))}
          <div className="relationship-planning-chips">
            <small>{relationshipPlan.highestConfidence || "no"} confidence</small>
            <small>{relationshipPlan.futureJoinRequirementStatus.replace(/_/g, " ")}</small>
          </div>
          {relationshipPlan.readinessNotes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      )}
      <div className="engine-compatibility-panel">
        <span>Analysis support</span>
        {engineCompatibility.compatibleEngines.map((result) => (
          <div key={result.engine.id} className="engine-compatibility-card">
            <strong>{result.engine.label}</strong>
            <small>{getEngineReadinessLabel(result.engine)}</small>
            <p>{result.engine.description}</p>
            <div>
              {listEngineCapabilities(result.engine).map((capability) => (
                <small key={capability}>{capability}</small>
              ))}
            </div>
          </div>
        ))}
      </div>
      {task.optionalInputs.length > 0 && (
        <div className="task-detail-list">
          <span>Optional inputs</span>
          {task.optionalInputs.map((input) => (
            <small key={input.id}>{input.label}</small>
          ))}
        </div>
      )}
      </details>
      <p className="task-safe-note">
        This is guidance only. Nothing runs, and no SQL is created from this view.
      </p>
    </aside>
  );
}

function TaskLauncherPanel({
  dataset = null,
  mode = "human",
  selectedTaskId,
  onSelectedTaskIdChange,
}: {
  dataset?: DatasetMetadata | null;
  mode?: WorkspaceMode;
  selectedTaskId?: string | null;
  onSelectedTaskIdChange?: (taskId: string | null) => void;
}) {
  const { taskGroups, selectedTask, selectTask, clearSelectedTask } = useTaskLauncher({
    selectedTaskId,
    onSelectedTaskIdChange,
  });
  const [selectedCategoryId, setSelectedCategoryId] = useState<AnalyticsTaskCategory | null>(
    selectedTask?.category || null,
  );
  const selectedCategoryGroup = useMemo(
    () => taskGroups.find((group) => group.category.id === selectedCategoryId) || null,
    [selectedCategoryId, taskGroups],
  );

  useEffect(() => {
    if (selectedTask) setSelectedCategoryId(selectedTask.category);
  }, [selectedTask]);

  const chooseCategory = (categoryId: AnalyticsTaskCategory) => {
    setSelectedCategoryId(categoryId);
  };

  const returnToGoals = () => {
    clearSelectedTask();
    setSelectedCategoryId(null);
  };

  const returnToWorkflows = () => {
    clearSelectedTask();
  };

  return (
    <section className="task-launcher-panel task-launcher-panel--focused" aria-label="Human mode analytics task launcher">
      <div className="summary-header task-investigation-heading">
        <div>
          <p className="section-label">Explore opportunities</p>
          <h2>Suggested investigations</h2>
          <p>
            Start with a business goal, choose one investigation, then confirm only the context that matters.
          </p>
        </div>
        <span className="dataset-count-pill">
          {taskGroups.reduce((count, group) => count + group.tasks.length, 0)}
        </span>
      </div>

      <div className="task-investigation-progress" aria-label="Investigation progress">
        <span className={!selectedCategoryGroup && !selectedTask ? "is-active" : "is-complete"}>Goal</span>
        <span className={selectedCategoryGroup && !selectedTask ? "is-active" : selectedTask ? "is-complete" : ""}>Investigation</span>
        <span className={selectedTask ? "is-active" : ""}>Prepare</span>
      </div>

      {!selectedCategoryGroup && !selectedTask && (
        <div className="task-investigation-step" aria-label="Choose Investigation Goal">
          <div className="task-step-header">
            <span>Step 1</span>
            <strong>Choose investigation goal</strong>
            <p>Select the business area you want to explore. Investigation ideas appear after a goal is selected.</p>
          </div>
          <div className="task-goal-grid">
          {taskGroups.map((group) => (
            <button
              type="button"
              className="task-goal-card"
              key={group.category.id}
              onClick={() => chooseCategory(group.category.id)}
            >
              <span>{group.tasks.length} ideas</span>
              <strong>{group.category.label}</strong>
              <small>{group.category.description}</small>
            </button>
          ))}
          </div>
        </div>
      )}

      {selectedCategoryGroup && !selectedTask && (
        <div className="task-investigation-step" aria-label="Choose Investigation">
          <div className="task-flow-nav">
            <button type="button" className="text-button" onClick={returnToGoals}>
              Back to goals
            </button>
          </div>
          <div className="task-step-header">
            <span>Step 2</span>
            <strong>{selectedCategoryGroup.category.label}</strong>
            <p>{selectedCategoryGroup.category.description}</p>
          </div>
          <div className="task-workflow-list">
            {selectedCategoryGroup.tasks.map((task) => (
              <button
                type="button"
                className="task-workflow-option"
                key={task.id}
                onClick={() => selectTask(task)}
              >
                <strong>{task.label}</strong>
                <span>{task.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="task-investigation-step task-workspace-stage" aria-label="Focused Investigation Workspace">
          <TaskDetail
            task={selectedTask}
            dataset={dataset}
            mode={mode}
            onClose={returnToWorkflows}
          />
        </div>
      )}
    </section>
  );
}

export default TaskLauncherPanel;
