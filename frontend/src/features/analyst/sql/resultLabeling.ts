import type { BusinessIntent } from "./businessIntentGrounding";
import type { SqlBusinessQuestionShape } from "./sqlBusinessQuestionShape";

export type ResultColumnLabelOrigin = "intent" | "entity" | "aggregate" | "humanized" | "raw";

export type LabeledResultColumn = {
  key: string;
  label: string;
  origin: ResultColumnLabelOrigin;
};

type LabelResultColumnsArgs = {
  columns: readonly string[];
  taskPrompt?: string;
  detectedIntent?: BusinessIntent;
  questionShape?: SqlBusinessQuestionShape;
  sourceLabel?: string | null;
  sourceTableName?: string | null;
};

const ACRONYMS = new Set(["id", "url", "api", "sku", "ip", "sql"]);
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "by",
  "do",
  "does",
  "each",
  "every",
  "for",
  "have",
  "has",
  "in",
  "of",
  "per",
  "the",
  "to",
  "with",
]);

const singularize = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.endsWith("ies") && normalized.length > 4) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("ses") && normalized.length > 4) return normalized.slice(0, -2);
  if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 3) {
    return normalized.slice(0, -1);
  }
  return normalized;
};

const titleCaseToken = (token: string) => {
  const lower = token.toLowerCase();
  if (ACRONYMS.has(lower)) return lower.toUpperCase();
  return lower ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : lower;
};

export const humanizeResultColumnName = (column: string) => {
  const tokens = column
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return column;
  const words = tokens.map((token, index) =>
    index === 0 ? titleCaseToken(token) : titleCaseToken(token).toLowerCase(),
  );
  return words.map((word) => (word.toLowerCase() === "id" ? "ID" : word)).join(" ");
};

const lowercaseHumanLabel = (value: string) => {
  const humanized = humanizeResultColumnName(value);
  return humanized ? `${humanized.charAt(0).toLowerCase()}${humanized.slice(1)}` : humanized;
};

const entityLabel = (entity: string) => humanizeResultColumnName(singularize(entity));

const extractCountEntity = (prompt?: string) => {
  const normalized = prompt
    ?.toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  const howMany = normalized.match(
    /\bhow many\s+([a-z0-9_]+(?:\s+[a-z0-9_]+){0,2}?)(?:\s+by\b|\s+in\b|\s+per\b|\s+for\b|\s+with\b|$)/,
  );
  if (howMany?.[1]) return entityLabel(lastMeaningfulPhraseWord(howMany[1]));
  const countOf = normalized.match(
    /\b(?:count|number)\s+of\s+([a-z0-9_]+(?:\s+[a-z0-9_]+){0,2}?)(?:\s+by\b|\s+in\b|\s+per\b|\s+for\b|$)/,
  );
  if (countOf?.[1]) return entityLabel(lastMeaningfulPhraseWord(countOf[1]));
  return null;
};

const lastMeaningfulPhraseWord = (phrase: string) => {
  const tokens = phrase.split(/\s+/).filter((token) => token && !STOP_WORDS.has(token));
  return tokens[tokens.length - 1] ?? phrase;
};

const dimensionEntityLabel = (column: string, prompt?: string) => {
  const match = column.match(/^(.+)_(id|number|name)$/i);
  if (!match) return null;
  const entity = entityLabel(match[1]);
  const normalizedPrompt = prompt?.toLowerCase() ?? "";
  return normalizedPrompt.includes(entity.toLowerCase()) ? entity : null;
};

const aggregateLabel = (column: string, countEntity: string | null): LabeledResultColumn | null => {
  const normalized = column.toLowerCase();
  if (normalized === "record_count" || normalized === "count") {
    return {
      key: column,
      label: countEntity ? `${countEntity} count` : "Record count",
      origin: countEntity ? "intent" : "aggregate",
    };
  }
  const aggregate = normalized.match(/^(total|sum|avg|average|min|max)_(.+)$/);
  if (!aggregate) return null;
  const prefix = aggregate[1];
  const field = aggregate[2];
  const prefixLabel =
    prefix === "sum" || prefix === "total"
      ? "Total"
      : prefix === "avg" || prefix === "average"
        ? "Average"
        : prefix === "min"
          ? "Minimum"
          : "Maximum";
  return { key: column, label: `${prefixLabel} ${lowercaseHumanLabel(field)}`, origin: "aggregate" };
};

export function labelResultColumns({
  columns,
  taskPrompt,
}: LabelResultColumnsArgs): LabeledResultColumn[] {
  const countEntity = extractCountEntity(taskPrompt);

  return columns.map((column) => {
    const aggregate = aggregateLabel(column, countEntity);
    if (aggregate) return aggregate;

    const dimensionLabel = dimensionEntityLabel(column, taskPrompt);
    if (dimensionLabel) return { key: column, label: dimensionLabel, origin: "entity" };

    const label = humanizeResultColumnName(column);
    return { key: column, label: label || column, origin: label ? "humanized" : "raw" };
  });
}
