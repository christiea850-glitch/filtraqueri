import type { AnalyticsTask } from "../tasks";
import type { TaskCategoryGroup } from "./taskLauncherSelectors";
import TaskCard from "./TaskCard";

type TaskCategorySectionProps = {
  group: TaskCategoryGroup;
  selectedTaskId: string | null;
  onTaskSelect: (task: AnalyticsTask) => void;
};

function TaskCategorySection({
  group,
  selectedTaskId,
  onTaskSelect,
}: TaskCategorySectionProps) {
  return (
    <section className="task-category-section" aria-label={group.category.label}>
      <div className="builder-block-header">
        <span>{group.category.label}</span>
        <small>{group.tasks.length} tasks</small>
      </div>
      <p>{group.category.description}</p>
      <div className="task-card-grid">
        {group.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            isSelected={task.id === selectedTaskId}
            onSelect={onTaskSelect}
          />
        ))}
      </div>
    </section>
  );
}

export default TaskCategorySection;
