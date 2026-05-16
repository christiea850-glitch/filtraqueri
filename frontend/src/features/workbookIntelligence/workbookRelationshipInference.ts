import type { SchemaColumn } from "../dataset/datasetTypes";
import { normalizeColumnName } from "../dataIntelligence/structuralPresentation";
import type { WorkbookMetadata, WorksheetMetadata } from "../workbook";
import type {
  InferredWorkbookRelationshipType,
  WorkbookComplexityLevel,
  WorkbookEntityRole,
  WorkbookEntityRoleSummary,
  WorkbookRelationshipConfidence,
  WorkbookRelationshipEvidence,
  WorkbookRelationshipIntelligence,
  WorkbookRelationshipJoinSuggestion,
} from "./workbookRelationshipTypes";

type RoleKeywordProfile = {
  role: WorkbookEntityRole;
  keywords: string[];
};

const roleKeywordProfiles: RoleKeywordProfile[] = [
  { role: "customers", keywords: ["customer", "client", "account", "buyer", "bill to", "sold to"] },
  { role: "orders", keywords: ["order", "sales order", "purchase order", "po"] },
  { role: "invoices", keywords: ["invoice", "bill", "billing", "statement"] },
  { role: "products", keywords: ["product", "item", "sku", "service", "catalog"] },
  { role: "employees", keywords: ["employee", "staff", "personnel", "associate", "worker"] },
  { role: "managers", keywords: ["manager", "supervisor", "lead"] },
  { role: "transactions", keywords: ["transaction", "ledger", "activity", "entry", "journal"] },
  { role: "inventory", keywords: ["inventory", "stock", "warehouse", "on hand"] },
  { role: "payments", keywords: ["payment", "paid", "receipt", "remittance"] },
  { role: "regions", keywords: ["region", "territory", "country", "state", "location", "market"] },
];

const idLikePattern = /\b(id|number|no|num|code|key|ref|reference|sku|account|invoice|order|customer|employee|manager|product)\b/i;

const compactName = (value: string) =>
  normalizeColumnName(value)
    .toLowerCase()
    .replace(/\b(number|num|no|#)\b/g, " id ")
    .replace(/\bidentifier\b/g, " id ")
    .replace(/\breference\b/g, " ref ")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/ids$/, "id");

const sampleSet = (column: SchemaColumn) =>
  new Set(
    (column.sample_values || [])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
      .map((value) => String(value).trim().toLowerCase()),
  );

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const confidenceFromScore = (score: number): WorkbookRelationshipConfidence => {
  if (score >= 76) return "high";
  if (score >= 54) return "medium";
  return "low";
};

const roleLabel = (role: WorkbookEntityRole) =>
  role === "unknown"
    ? "worksheet"
    : role
        .split("_")
        .join(" ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const normalizeRelationshipKey = (name: string) => compactName(name);

export const inferWorksheetRole = (worksheet: WorksheetMetadata): WorkbookEntityRoleSummary => {
  const sheetText = normalizeColumnName(`${worksheet.displayName || worksheet.sheetName}`).toLowerCase();
  const columnText = worksheet.schema.map((column) => normalizeColumnName(column.name).toLowerCase()).join(" ");
  const combinedText = `${sheetText} ${columnText}`;
  const scores = roleKeywordProfiles.map((profile) => {
    const sheetHits = profile.keywords.filter((keyword) => sheetText.includes(keyword)).length;
    const columnHits = profile.keywords.filter((keyword) => columnText.includes(keyword)).length;
    return {
      ...profile,
      score: sheetHits * 3 + columnHits,
      reasons: [
        ...(sheetHits > 0 ? [`Sheet name suggests ${roleLabel(profile.role).toLowerCase()}.`] : []),
        ...(columnHits > 0 ? [`Fields include ${roleLabel(profile.role).toLowerCase()} language.`] : []),
      ],
    };
  });
  const best = scores.sort((left, right) => right.score - left.score)[0];

  if (!best || best.score === 0 || !combinedText.trim()) {
    return {
      worksheetId: worksheet.worksheetId,
      worksheetName: worksheet.displayName || worksheet.sheetName,
      role: "unknown",
      confidence: "low",
      reasons: ["Business role is not obvious from the sheet name or fields."],
      recommendedStart: false,
    };
  }

  return {
    worksheetId: worksheet.worksheetId,
    worksheetName: worksheet.displayName || worksheet.sheetName,
    role: best.role,
    confidence: best.score >= 4 ? "high" : best.score >= 2 ? "medium" : "low",
    reasons: best.reasons.slice(0, 2),
    recommendedStart: false,
  };
};

const nameSimilarity = (sourceKey: string, targetKey: string) => {
  if (!sourceKey || !targetKey) return 0;
  if (sourceKey === targetKey) return 1;
  if (sourceKey.includes(targetKey) || targetKey.includes(sourceKey)) return 0.72;

  const sourceTokens = new Set(normalizeColumnName(sourceKey).toLowerCase().split(/\s+/).filter(Boolean));
  const targetTokens = new Set(normalizeColumnName(targetKey).toLowerCase().split(/\s+/).filter(Boolean));
  const overlap = Array.from(sourceTokens).filter((token) => targetTokens.has(token)).length;
  const denominator = Math.max(sourceTokens.size, targetTokens.size, 1);
  return overlap / denominator;
};

const typeCompatible = (source: SchemaColumn, target: SchemaColumn) => {
  if (source.inferred_type === target.inferred_type) return true;
  const textLike = new Set(["text", "categorical"]);
  return textLike.has(source.inferred_type) && textLike.has(target.inferred_type);
};

const columnCoverage = (column: SchemaColumn, rowCount: number) => {
  if (rowCount <= 0) return 0;
  return clamp01((rowCount - (column.null_count || 0)) / rowCount);
};

const uniqueRatio = (column: SchemaColumn, rowCount: number) => {
  if (rowCount <= 0) return 0;
  return clamp01((column.unique_count || 0) / rowCount);
};

const valueOverlapRatio = (source: SchemaColumn, target: SchemaColumn) => {
  const sourceValues = sampleSet(source);
  const targetValues = sampleSet(target);
  const denominator = Math.min(sourceValues.size, targetValues.size);
  if (denominator === 0) return 0;
  const overlapCount = Array.from(sourceValues).filter((value) => targetValues.has(value)).length;
  return overlapCount / denominator;
};

const relationshipTypeFromRatios = (
  sourceUniqueRatio: number,
  targetUniqueRatio: number,
): InferredWorkbookRelationshipType => {
  if (sourceUniqueRatio >= 0.82 && targetUniqueRatio >= 0.82) return "same_entity";
  if (sourceUniqueRatio < 0.72 && targetUniqueRatio >= 0.78) return "lookup";
  if (sourceUniqueRatio >= 0.78 && targetUniqueRatio < 0.72) return "transaction_detail";
  if (Math.max(sourceUniqueRatio, targetUniqueRatio) >= 0.72) return "reference";
  return "unknown";
};

const makeGuidance = (
  sourceWorksheetName: string,
  sourceColumn: string,
  targetWorksheetName: string,
  targetColumn: string,
) => {
  const sourceLabel = normalizeColumnName(sourceColumn);
  const targetLabel = normalizeColumnName(targetColumn);
  const sharedLabel = compactName(sourceColumn) === compactName(targetColumn) ? sourceLabel : `${sourceLabel} and ${targetLabel}`;
  return `${sourceWorksheetName} likely connects to ${targetWorksheetName} through ${sharedLabel}.`;
};

const buildRelationshipEvidence = (
  sourceWorksheet: WorksheetMetadata,
  sourceColumn: SchemaColumn,
  targetWorksheet: WorksheetMetadata,
  targetColumn: SchemaColumn,
): { evidence: WorkbookRelationshipEvidence; confidenceScore: number; relationshipType: InferredWorkbookRelationshipType } => {
  const sourceKey = compactName(sourceColumn.name);
  const targetKey = compactName(targetColumn.name);
  const similarity = nameSimilarity(sourceKey, targetKey);
  const exactNameMatch = sourceKey === targetKey && sourceKey.length > 0;
  const sourceUnique = uniqueRatio(sourceColumn, sourceWorksheet.rowCount);
  const targetUnique = uniqueRatio(targetColumn, targetWorksheet.rowCount);
  const uniquenessSimilarity = 1 - Math.abs(sourceUnique - targetUnique);
  const overlapRatio = valueOverlapRatio(sourceColumn, targetColumn);
  const sourceCoverage = columnCoverage(sourceColumn, sourceWorksheet.rowCount);
  const targetCoverage = columnCoverage(targetColumn, targetWorksheet.rowCount);
  const rowCoverageConsistency = 1 - Math.abs(sourceCoverage - targetCoverage);
  const sourceIdLike = idLikePattern.test(normalizeColumnName(sourceColumn.name));
  const targetIdLike = idLikePattern.test(normalizeColumnName(targetColumn.name));
  const idPatternMatch = sourceIdLike && targetIdLike;
  const compatible = typeCompatible(sourceColumn, targetColumn);
  const reasons = [
    ...(exactNameMatch ? ["Field names normalize to the same business key."] : []),
    ...(idPatternMatch ? ["Both fields look like identifiers or reference numbers."] : []),
    ...(overlapRatio > 0 ? ["Sampled values overlap across sheets."] : []),
    ...(uniquenessSimilarity >= 0.8 ? ["Field uniqueness looks similar across sheets."] : []),
    ...(compatible ? ["Field types look compatible."] : []),
  ];
  const confidenceScore =
    (exactNameMatch ? 30 : similarity * 24) +
    (idPatternMatch ? 16 : 0) +
    overlapRatio * 24 +
    uniquenessSimilarity * 10 +
    rowCoverageConsistency * 8 +
    (compatible ? 8 : 0);

  return {
    evidence: {
      normalizedNameMatch: exactNameMatch,
      nameSimilarity: similarity,
      uniquenessSimilarity,
      overlapRatio,
      idPatternMatch,
      rowCoverageConsistency,
      typeCompatible: compatible,
      reasons: reasons.length > 0 ? reasons : ["Relationship signal is weak and advisory."],
    },
    confidenceScore: Math.round(confidenceScore),
    relationshipType: relationshipTypeFromRatios(sourceUnique, targetUnique),
  };
};

const buildJoinSuggestions = (worksheets: WorksheetMetadata[]): WorkbookRelationshipJoinSuggestion[] => {
  const suggestions: WorkbookRelationshipJoinSuggestion[] = [];

  worksheets.forEach((sourceWorksheet, sourceIndex) => {
    worksheets.slice(sourceIndex + 1).forEach((targetWorksheet) => {
      sourceWorksheet.schema.forEach((sourceColumn) => {
        targetWorksheet.schema.forEach((targetColumn) => {
          const { evidence, confidenceScore, relationshipType } = buildRelationshipEvidence(
            sourceWorksheet,
            sourceColumn,
            targetWorksheet,
            targetColumn,
          );
          const hasStrongNameSignal = evidence.normalizedNameMatch || evidence.nameSimilarity >= 0.72;
          const hasValueSignal = evidence.overlapRatio >= 0.2;
          const shouldKeep = evidence.typeCompatible && confidenceScore >= 46 && (hasStrongNameSignal || hasValueSignal);

          if (!shouldKeep) return;

          const sourceWorksheetName = sourceWorksheet.displayName || sourceWorksheet.sheetName;
          const targetWorksheetName = targetWorksheet.displayName || targetWorksheet.sheetName;

          suggestions.push({
            id: [
              "workbook-intelligence",
              sourceWorksheet.worksheetId,
              compactName(sourceColumn.name),
              targetWorksheet.worksheetId,
              compactName(targetColumn.name),
            ].join(":"),
            sourceWorksheetId: sourceWorksheet.worksheetId,
            sourceWorksheetName,
            sourceColumn: sourceColumn.name,
            targetWorksheetId: targetWorksheet.worksheetId,
            targetWorksheetName,
            targetColumn: targetColumn.name,
            confidenceScore,
            confidence: confidenceFromScore(confidenceScore),
            relationshipType,
            guidance: makeGuidance(sourceWorksheetName, sourceColumn.name, targetWorksheetName, targetColumn.name),
            evidence,
          });
        });
      });
    });
  });

  const seen = new Set<string>();
  return suggestions
    .sort((left, right) => right.confidenceScore - left.confidenceScore)
    .filter((suggestion) => {
      const pairKey = [suggestion.sourceWorksheetId, suggestion.targetWorksheetId, suggestion.sourceColumn, suggestion.targetColumn]
        .sort()
        .join(":");
      if (seen.has(pairKey)) return false;
      seen.add(pairKey);
      return true;
    })
    .slice(0, 10);
};

const recommendStartingRole = (roles: WorkbookEntityRoleSummary[]) => {
  const preferredRoles: WorkbookEntityRole[] = ["orders", "invoices", "transactions", "payments", "inventory"];
  return (
    preferredRoles
      .map((role) => roles.find((summary) => summary.role === role))
      .find(Boolean) ||
    roles.find((summary) => summary.confidence !== "low") ||
    roles[0] ||
    null
  );
};

const complexityFromWorkbook = (
  worksheetCount: number,
  relationshipCount: number,
): WorkbookComplexityLevel => {
  if (worksheetCount >= 7 || relationshipCount >= 8) return "complex";
  if (worksheetCount >= 3 || relationshipCount >= 3) return "moderate";
  return "simple";
};

export const buildWorkbookRelationshipIntelligence = (
  workbook?: WorkbookMetadata | null,
): WorkbookRelationshipIntelligence | null => {
  const worksheets = (workbook?.worksheets || []).filter((worksheet) => worksheet.status === "ready");
  if (!workbook || worksheets.length < 2) return null;

  const roleSummaries = worksheets.map(inferWorksheetRole);
  const recommendedStart = recommendStartingRole(roleSummaries);
  const entityRoles = roleSummaries.map((roleSummary) => ({
    ...roleSummary,
    recommendedStart: roleSummary.worksheetId === recommendedStart?.worksheetId,
  }));
  const joinSuggestions = buildJoinSuggestions(worksheets);
  const complexity = complexityFromWorkbook(worksheets.length, joinSuggestions.length);
  const graph = {
    nodes: worksheets.map((worksheet) => {
      const roleSummary = entityRoles.find((role) => role.worksheetId === worksheet.worksheetId);
      return {
        id: worksheet.worksheetId,
        label: worksheet.displayName || worksheet.sheetName,
        role: roleSummary?.role || "unknown",
        rowCount: worksheet.rowCount,
        columnCount: worksheet.columnCount,
      };
    }),
    edges: joinSuggestions.map((suggestion) => ({
      id: suggestion.id,
      source: suggestion.sourceWorksheetId,
      target: suggestion.targetWorksheetId,
      confidence: suggestion.confidence,
      relationshipType: suggestion.relationshipType,
      sourceColumn: suggestion.sourceColumn,
      targetColumn: suggestion.targetColumn,
      label: suggestion.guidance,
    })),
  };

  return {
    workbookId: workbook.workbookId,
    workbookName: workbook.name,
    worksheetCount: worksheets.length,
    complexity,
    recommendedStartingWorksheetId: recommendedStart?.worksheetId || null,
    recommendedStartingWorksheetName: recommendedStart?.worksheetName || null,
    entityRoles,
    joinSuggestions,
    graph,
    humanSummary:
      joinSuggestions.length > 0
        ? `${joinSuggestions.length} possible worksheet connection${joinSuggestions.length === 1 ? "" : "s"} found.`
        : "This workbook has multiple sheets, but no strong worksheet connections are obvious yet.",
  };
};
