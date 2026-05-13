import type { DatasetMetadata } from "../dataset/datasetTypes";
import type { AnalyticsTask } from "../tasks";
import {
  getAnalysisPlanReadinessLabel,
  useAnalysisPlan,
} from "../analysisPlan";
import { getEngineReadinessLabel, listEngineCapabilities, useEngineAdapters } from "../engineAdapters";
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
import TaskCategorySection from "./TaskCategorySection";
import useTaskLauncher from "./useTaskLauncher";

function TaskDetail({
  task,
  dataset,
  onClose,
}: {
  task: AnalyticsTask;
  dataset: DatasetMetadata | null;
  onClose: () => void;
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
  const missingInputs = configuration
    ? listMissingRequiredTaskInputs(task, configuration)
    : [];
  const readinessLabel = configuration
    ? getTaskConfigurationReadinessLabel(configuration)
    : "Task not ready";
  const planReadinessLabel = getAnalysisPlanReadinessLabel(analysisPlan);

  return (
    <aside className="task-detail-panel" aria-label="Task details">
      <div className="builder-block-header">
        <span>Task preview</span>
        <button type="button" className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
      <div>
        <p className="section-label">Guided workflow</p>
        <h3>{task.label}</h3>
        <p>{task.description}</p>
      </div>
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
          Supported engines
          <strong>{task.supportedEngines.join(", ")}</strong>
        </span>
        <span>
          Recommended future engine
          <strong>{engineCompatibility.recommendedEngine?.label || "Not available yet"}</strong>
        </span>
        <span>
          Future explanation
          <strong>{task.explanationTemplateKey}</strong>
        </span>
        <span>
          Validation readiness
          <strong>{readinessLabel}</strong>
        </span>
        <span>
          Future plan state
          <strong>{planReadinessLabel}</strong>
        </span>
        <span>
          Relationship planning
          <strong>{getRelationshipPlanningReadinessLabel(relationshipPlan)}</strong>
        </span>
        <span>
          Unified readiness
          <strong>{getPlanningReadinessStatusLabel(planningReadiness.status)}</strong>
        </span>
      </div>
      <div className={`planning-readiness-panel ${getPlanningReadinessTone(planningReadiness.status)}`}>
        <span>Planning readiness</span>
        <strong>{getPlanningReadinessStatusLabel(planningReadiness.status)}</strong>
        <p>{planningReadiness.beginnerSummary}</p>
        <div className="planning-readiness-grid">
          <small>{planningReadiness.confidenceLevel} confidence</small>
          <small>{planningReadiness.supportedWorkflowScope.replace(/_/g, " ")}</small>
          <small>{planningReadiness.explanationReadiness.replace(/_/g, " ")}</small>
          <small>
            {planningReadiness.engineCompatibilitySummary.compatibleEngines.length} engine options
          </small>
        </div>
        {planningReadiness.futureExecutionBlockers.length > 0 && (
          <div className="planning-readiness-list">
            <span>Future blockers</span>
            {planningReadiness.futureExecutionBlockers.slice(0, 3).map((blocker) => (
              <small key={blocker}>{blocker}</small>
            ))}
          </div>
        )}
        <div className="planning-readiness-list">
          <span>Future notes</span>
          {planningReadiness.futureExecutionNotes.slice(0, 3).map((note) => (
            <small key={note}>{note}</small>
          ))}
        </div>
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
      {task.requiredInputs.length > 0 && (
        <div className="guided-input-list">
          <span>Guided input selection</span>
          {[...task.requiredInputs, ...task.optionalInputs].map((input) => {
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
              <select
                value={selection?.value || ""}
                onChange={(event) => guidedInputs.selectInputValue(input, event.target.value)}
                aria-label={`${input.label} guided selection`}
              >
                <option value="">{input.placeholder || "Choose an option"}</option>
                {options.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {validation && <em className={validation.severity}>{validation.message}</em>}
            </label>
            );
          })}
        </div>
      )}
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
        <span>Future engine compatibility</span>
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
      <p className="task-safe-note">
        This task preview is metadata only. Execution, SQL generation, and AI planning are not
        connected yet.
      </p>
    </aside>
  );
}

function TaskLauncherPanel({ dataset = null }: { dataset?: DatasetMetadata | null }) {
  const { taskGroups, selectedTask, selectTask, clearSelectedTask } = useTaskLauncher();

  return (
    <section className="task-launcher-panel" aria-label="Human mode analytics task launcher">
      <div className="summary-header">
        <div>
          <p className="section-label">Tasks & Utilities</p>
          <h2>Guided analytics tasks</h2>
          <p>Choose a business workflow to preview the inputs and outputs FiltraQueri will support.</p>
        </div>
        <span className="dataset-count-pill">
          {taskGroups.reduce((count, group) => count + group.tasks.length, 0)}
        </span>
      </div>

      <div className="task-launcher-layout">
        <div className="task-category-list">
          {taskGroups.map((group) => (
            <TaskCategorySection
              key={group.category.id}
              group={group}
              selectedTaskId={selectedTask?.id || null}
              onTaskSelect={selectTask}
            />
          ))}
        </div>
        {selectedTask && (
          <TaskDetail task={selectedTask} dataset={dataset} onClose={clearSelectedTask} />
        )}
      </div>
    </section>
  );
}

export default TaskLauncherPanel;
