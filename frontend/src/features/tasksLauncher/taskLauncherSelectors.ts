import {
  analyticsTaskCategories,
  listAnalyticsTasks,
  type AnalyticsTask,
  type AnalyticsTaskCategory,
  type AnalyticsTaskCategoryMetadata,
} from "../tasks";

export type TaskCategoryGroup = {
  category: AnalyticsTaskCategoryMetadata;
  tasks: AnalyticsTask[];
};

export const groupTasksByCategory = (): TaskCategoryGroup[] =>
  analyticsTaskCategories
    .map((category) => ({
      category,
      tasks: listAnalyticsTasks().filter((task) => task.category === category.id),
    }))
    .filter((group) => group.tasks.length > 0);

export const findTaskCategory = (categoryId: AnalyticsTaskCategory) =>
  analyticsTaskCategories.find((category) => category.id === categoryId) || null;
