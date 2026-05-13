import type {
  BusinessIntentResultType,
  BusinessIntentSafetyLevel,
  BusinessIntentSupportedEngine,
} from "../businessIntent";
import type { AnalyticsTaskCategory } from "./taskCategories";
import type { AnalyticsTaskInput } from "./taskInputs";

export type AnalyticsTaskIconKey =
  | "sales"
  | "trend"
  | "compare"
  | "forecast"
  | "customer"
  | "correlation"
  | "anomaly"
  | "financial";

export type AnalyticsTask = {
  id: string;
  label: string;
  description: string;
  category: AnalyticsTaskCategory;
  iconKey: AnalyticsTaskIconKey;
  beginnerFriendly: boolean;
  supportedIntents: string[];
  requiredInputs: AnalyticsTaskInput[];
  optionalInputs: AnalyticsTaskInput[];
  supportedResultTypes: BusinessIntentResultType[];
  supportedEngines: BusinessIntentSupportedEngine[];
  explanationTemplateKey: string;
  safetyLevel: BusinessIntentSafetyLevel;
};
