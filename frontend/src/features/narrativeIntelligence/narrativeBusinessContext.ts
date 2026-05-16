import type { BusinessSemanticEntityCategory, BusinessSemanticReport } from "../businessSemantics";
import type { SchemaColumn } from "../dataset/datasetTypes";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const categoryTerms: Record<BusinessSemanticEntityCategory, string[]> = {
  customer: ["customer", "client", "account"],
  product: ["product", "sku", "item"],
  sales: ["sale", "order"],
  revenue: ["revenue", "amount", "total", "sales"],
  expense: ["expense", "cost", "spend"],
  invoice: ["invoice", "receipt", "bill"],
  transaction: ["transaction", "txn", "order"],
  employee: ["employee", "staff", "rep"],
  supplier: ["supplier", "vendor"],
  booking: ["booking", "reservation"],
  inventory: ["inventory", "stock", "warehouse"],
  payment: ["payment", "paid"],
  region: ["region", "city", "state", "country", "location"],
  department: ["department", "team", "division"],
  operational_event: ["status", "ticket", "incident", "workflow"],
  date_dimension: ["date", "month", "year", "period"],
  metric_field: ["amount", "count", "total", "qty", "quantity", "score"],
  dimension_field: ["category", "type", "segment", "group"],
};

export const hasSemanticCategory = (
  report: BusinessSemanticReport | null,
  category: BusinessSemanticEntityCategory,
) => report?.detectedSemanticEntities.some((entity) => entity.category === category) || false;

export const columnMatchesBusinessCategory = (
  column: SchemaColumn | string,
  category: BusinessSemanticEntityCategory,
) => {
  const name = normalize(typeof column === "string" ? column : column.name);
  return categoryTerms[category].some((term) => name.includes(term));
};

export const describeBusinessSubject = (
  columnName: string,
  businessSemanticReport: BusinessSemanticReport | null,
) => {
  if (columnMatchesBusinessCategory(columnName, "region")) return "location";
  if (columnMatchesBusinessCategory(columnName, "customer")) return "customer";
  if (columnMatchesBusinessCategory(columnName, "product")) return "product";
  if (columnMatchesBusinessCategory(columnName, "employee")) return "workload";
  if (columnMatchesBusinessCategory(columnName, "revenue") || hasSemanticCategory(businessSemanticReport, "revenue")) {
    return "revenue";
  }
  if (columnMatchesBusinessCategory(columnName, "operational_event")) return "operational activity";
  return "business activity";
};
