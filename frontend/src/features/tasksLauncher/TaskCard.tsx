import type { AnalyticsTask } from "../tasks";

type TaskCardProps = {
  task: AnalyticsTask;
  isSelected: boolean;
  onSelect: (task: AnalyticsTask) => void;
};

function TaskCard({ task, isSelected, onSelect }: TaskCardProps) {
  return (
    <button
      type="button"
      className={`task-launcher-card${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(task)}
      aria-pressed={isSelected}
    >
      <span className="task-launcher-card-meta">
        {task.beginnerFriendly ? "Beginner friendly" : "Analyst guided"}
      </span>
      <strong>{task.label}</strong>
      <span>{task.description}</span>
      <small>{task.supportedResultTypes.join(", ")}</small>
    </button>
  );
}

export default TaskCard;
