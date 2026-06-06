import type { WorksheetMetadata } from "../../features/workbook";

export type WorkbookRelationshipReadinessConfidence =
  | "strong_match"
  | "possible_match"
  | "needs_review";

export type WorkbookRelationshipReadinessMatch = {
  id: string;
  sourceWorksheetId: string;
  targetWorksheetId: string;
  sourceDisplayName: string;
  targetDisplayName: string;
  sourceColumnName: string | null;
  targetColumnName: string | null;
  confidence: WorkbookRelationshipReadinessConfidence;
  label: string;
  explanation: string;
};

type NormalizedColumn = {
  originalName: string;
  normalizedName: string;
  compactName: string;
  baseName: string;
  inferredType: string;
  idLike: boolean;
};

const idTerms = new Set(["id", "code", "key", "number", "num"]);

const normalizeText = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

const singularize = (value: string) => {
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("ses") && value.length > 4) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
};

const formatBusinessToken = (value: string) => {
  const normalized = normalizeText(value).replace(/\bid\b/g, "").replace(/\bcode\b/g, "").trim();
  return normalized || normalizeText(value) || "key";
};

const normalizeEntityTokens = (worksheet: WorksheetMetadata) =>
  [worksheet.displayName, worksheet.sheetName, worksheet.tableName]
    .flatMap((name) => normalizeText(name).split(" "))
    .filter(Boolean)
    .map(singularize);

const normalizeColumn = (column: WorksheetMetadata["schema"][number]): NormalizedColumn => {
  const normalizedName = normalizeText(column.name);
  const tokens = normalizedName.split(" ").filter(Boolean);
  const compactName = tokens.join("");
  const nonIdTokens = tokens.filter((token) => !idTerms.has(token));
  const baseName = singularize(nonIdTokens.join(" "));
  const idLike =
    tokens.some((token) => idTerms.has(token)) ||
    compactName.endsWith("id") ||
    compactName.endsWith("code") ||
    compactName.endsWith("key");

  return {
    originalName: column.name,
    normalizedName,
    compactName,
    baseName,
    inferredType: column.inferred_type,
    idLike,
  };
};

const typesAreCompatible = (left: NormalizedColumn, right: NormalizedColumn) =>
  left.inferredType === right.inferredType ||
  (left.idLike && right.idLike) ||
  (["text", "categorical"].includes(left.inferredType) &&
    ["text", "categorical"].includes(right.inferredType));

const getReadinessLabel = (confidence: WorkbookRelationshipReadinessConfidence) => {
  if (confidence === "strong_match") return "Strong match";
  if (confidence === "possible_match") return "Possible match";
  return "Needs review";
};

const scoreColumnPair = (
  left: NormalizedColumn,
  right: NormalizedColumn,
  leftEntityTokens: string[],
  rightEntityTokens: string[],
) => {
  const compatible = typesAreCompatible(left, right);
  const exactShared = left.compactName === right.compactName;
  const sharedBase = left.baseName && left.baseName === right.baseName;
  const leftNamesRightEntity =
    left.idLike && rightEntityTokens.some((token) => token && left.baseName === token);
  const rightNamesLeftEntity =
    right.idLike && leftEntityTokens.some((token) => token && right.baseName === token);
  const codeAlias =
    left.idLike &&
    right.idLike &&
    (left.baseName === "access" || right.baseName === "access") &&
    (left.normalizedName.includes("code") || right.normalizedName.includes("code"));

  if (exactShared && compatible) return { score: left.idLike ? 100 : 88, reason: "exact_shared" };
  if ((sharedBase || codeAlias) && compatible) return { score: 76, reason: "similar_key" };
  if ((leftNamesRightEntity || rightNamesLeftEntity) && compatible) {
    return { score: 64, reason: "entity_key" };
  }
  if ((sharedBase || exactShared) && !compatible) return { score: 46, reason: "review_type" };
  return { score: 0, reason: "none" };
};

const createExplanation = (
  match: {
    confidence: WorkbookRelationshipReadinessConfidence;
    reason: string;
    sourceColumnName: string | null;
    targetColumnName: string | null;
  },
  sourceName: string,
  targetName: string,
) => {
  if (!match.sourceColumnName || !match.targetColumnName) {
    return "No obvious shared key was found from metadata.";
  }

  const businessToken = formatBusinessToken(match.sourceColumnName || match.targetColumnName);

  if (match.confidence === "strong_match") {
    return `Both tables share ${match.sourceColumnName}, so these may connect by ${businessToken}.`;
  }

  if (match.reason === "review_type") {
    return "These tables use similar column names, but the inferred column types differ and should be reviewed.";
  }

  if (match.confidence === "possible_match") {
    return `These tables have similar ID-style columns (${match.sourceColumnName} and ${match.targetColumnName}), so the relationship should be reviewed.`;
  }

  return `${sourceName} and ${targetName} do not show a clear shared key from metadata.`;
};

export const inferWorkbookRelationshipReadiness = (
  worksheets: WorksheetMetadata[],
): WorkbookRelationshipReadinessMatch[] => {
  const results: WorkbookRelationshipReadinessMatch[] = [];

  for (let sourceIndex = 0; sourceIndex < worksheets.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < worksheets.length; targetIndex += 1) {
      const source = worksheets[sourceIndex];
      const target = worksheets[targetIndex];
      const sourceColumns = source.schema.map(normalizeColumn);
      const targetColumns = target.schema.map(normalizeColumn);
      const sourceEntityTokens = normalizeEntityTokens(source);
      const targetEntityTokens = normalizeEntityTokens(target);

      let bestMatch: {
        score: number;
        reason: string;
        sourceColumn: NormalizedColumn | null;
        targetColumn: NormalizedColumn | null;
      } = {
        score: 0,
        reason: "none",
        sourceColumn: null,
        targetColumn: null,
      };

      sourceColumns.forEach((sourceColumn) => {
        targetColumns.forEach((targetColumn) => {
          const scored = scoreColumnPair(
            sourceColumn,
            targetColumn,
            sourceEntityTokens,
            targetEntityTokens,
          );
          if (scored.score > bestMatch.score) {
            bestMatch = {
              ...scored,
              sourceColumn,
              targetColumn,
            };
          }
        });
      });

      const confidence: WorkbookRelationshipReadinessConfidence =
        bestMatch.score >= 85
          ? "strong_match"
          : bestMatch.score >= 60
            ? "possible_match"
            : "needs_review";
      const sourceColumnName = bestMatch.sourceColumn?.originalName || null;
      const targetColumnName = bestMatch.targetColumn?.originalName || null;

      results.push({
        id: `${source.worksheetId}:${target.worksheetId}`,
        sourceWorksheetId: source.worksheetId,
        targetWorksheetId: target.worksheetId,
        sourceDisplayName: source.displayName,
        targetDisplayName: target.displayName,
        sourceColumnName,
        targetColumnName,
        confidence,
        label: getReadinessLabel(confidence),
        explanation: createExplanation(
          {
            confidence,
            reason: bestMatch.reason,
            sourceColumnName,
            targetColumnName,
          },
          source.displayName,
          target.displayName,
        ),
      });
    }
  }

  return results;
};
