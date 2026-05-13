import type { AnalyticsTask } from "../tasks";
import TaskCategorySection from "./TaskCategorySection";
import useTaskLauncher from "./useTaskLauncher";

function TaskDetail({ task, onClose }: { task: AnalyticsTask; onClose: () => void }) {
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
          Future explanation
          <strong>{task.explanationTemplateKey}</strong>
        </span>
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

function TaskLauncherPanel() {
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
        {selectedTask && <TaskDetail task={selectedTask} onClose={clearSelectedTask} />}
      </div>
    </section>
  );
}

export default TaskLauncherPanel;
