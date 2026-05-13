import type { BusinessIntentInputType } from "../businessIntent";

export type AnalyticsTaskInput = {
  id: string;
  type: BusinessIntentInputType;
  label: string;
  description: string;
  required: boolean;
  acceptsMultiple?: boolean;
  placeholder?: string;
  exampleValues?: string[];
};

export const taskInputPresets = {
  metric: {
    id: "metric",
    type: "metric",
    label: "Metric",
    description: "Business value to measure, such as revenue, profit, cost, or quantity.",
    required: true,
    placeholder: "Choose a numeric business measure",
    exampleValues: ["revenue", "profit", "quantity"],
  },
  dateField: {
    id: "date-field",
    type: "dateField",
    label: "Date field",
    description: "Date column used to place the analysis on a timeline.",
    required: true,
    placeholder: "Choose a date column",
    exampleValues: ["order_date", "invoice_date", "month"],
  },
  groupingField: {
    id: "grouping-field",
    type: "groupingField",
    label: "Group by",
    description: "Business segment used to organize the answer.",
    required: false,
    placeholder: "Choose a category or segment",
    exampleValues: ["product", "department", "region"],
  },
  entityField: {
    id: "entity-field",
    type: "entityField",
    label: "Entity",
    description: "Primary business entity, such as customer, product, employee, or account.",
    required: true,
    placeholder: "Choose an entity column",
    exampleValues: ["customer_id", "product", "employee_id"],
  },
} satisfies Record<string, AnalyticsTaskInput>;
