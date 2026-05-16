import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import { inferBusinessRole, normalizeColumnName } from "../dataIntelligence/structuralPresentation";
import type { ActiveResultModel } from "../results/activeResultModel";
import {
  buildWorkbookRelationshipIntelligence,
  type WorkbookRelationshipIntelligence,
} from "../workbookIntelligence";
import type { InvestigationContext } from "./investigationTypes";

const containsAny = (value: string, keywords: string[]) =>
  keywords.some((keyword) => value.includes(keyword));

const columnText = (column: SchemaColumn) => normalizeColumnName(column.name).toLowerCase();

const byColumnLanguage = (keywords: string[]) => (column: SchemaColumn) =>
  containsAny(columnText(column), keywords);

const customerKeywords = ["customer", "client", "account", "buyer"];
const financialKeywords = [
  "amount",
  "total",
  "revenue",
  "sales",
  "price",
  "cost",
  "balance",
  "paid",
  "payment",
  "invoice",
];
const operationalKeywords = [
  "status",
  "stage",
  "priority",
  "delay",
  "duration",
  "workload",
  "ticket",
  "task",
  "order",
  "quantity",
  "inventory",
];
const workforceKeywords = ["employee", "manager", "staff", "team", "department", "supervisor"];

const uniqueByName = (columns: SchemaColumn[]) => {
  const seen = new Set<string>();
  return columns.filter((column) => {
    if (seen.has(column.name)) return false;
    seen.add(column.name);
    return true;
  });
};

export const buildInvestigationContext = ({
  dataset,
  activeResultModel,
}: {
  dataset: DatasetMetadata | null;
  activeResultModel?: ActiveResultModel | null;
}): InvestigationContext => {
  const columns = dataset?.schema || [];
  const workbookIntelligence: WorkbookRelationshipIntelligence | null =
    buildWorkbookRelationshipIntelligence(dataset?.workbook_metadata);
  const dimensions = columns.filter(
    (column) =>
      column.inferred_type === "categorical" ||
      column.inferred_type === "text" ||
      column.inferred_type === "date",
  );
  const measures = columns.filter((column) => column.inferred_type === "numeric");
  const dateFields = columns.filter((column) => column.inferred_type === "date" || byColumnLanguage(["date", "month", "year"])(column));
  const customerFields = columns.filter((column) => {
    const role = inferBusinessRole(column.name, column.sample_values, column.inferred_type);
    return role === "customer" || byColumnLanguage(customerKeywords)(column);
  });
  const financialFields = columns.filter((column) => {
    const role = inferBusinessRole(column.name, column.sample_values, column.inferred_type);
    return role === "amount" || role === "invoice" || byColumnLanguage(financialKeywords)(column);
  });
  const operationalFields = columns.filter((column) => {
    const role = inferBusinessRole(column.name, column.sample_values, column.inferred_type);
    return (
      role === "status" ||
      role === "quantity" ||
      byColumnLanguage([...operationalKeywords, ...workforceKeywords])(column)
    );
  });
  const workbookRoles = workbookIntelligence?.entityRoles.map((role) => role.role) || [];
  const relationshipHints = workbookIntelligence?.joinSuggestions.map((suggestion) => suggestion.guidance) || [];

  return {
    dataset,
    activeResultModel,
    workbookIntelligence,
    columns,
    dimensions: uniqueByName(dimensions),
    measures: uniqueByName(measures),
    dateFields: uniqueByName(dateFields),
    customerFields: uniqueByName(customerFields),
    financialFields: uniqueByName(financialFields),
    operationalFields: uniqueByName(operationalFields),
    relationshipHints,
    contexts: {
      customer:
        customerFields.length > 0 ||
        workbookRoles.includes("customers") ||
        containsAny(normalizeColumnName(dataset?.original_filename || "").toLowerCase(), customerKeywords),
      financial:
        financialFields.length > 0 ||
        workbookRoles.some((role) => role === "invoices" || role === "payments" || role === "transactions"),
      operational:
        operationalFields.length > 0 ||
        workbookRoles.some((role) => role === "orders" || role === "inventory" || role === "transactions"),
      workforce:
        columns.some(byColumnLanguage(workforceKeywords)) ||
        workbookRoles.some((role) => role === "employees" || role === "managers"),
      workbook: Boolean(workbookIntelligence && workbookIntelligence.worksheetCount > 1),
      temporal: dateFields.length > 0,
    },
  };
};
