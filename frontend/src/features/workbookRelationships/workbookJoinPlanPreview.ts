import type { AnalyticsTaskCategory } from "../tasks";
import type {
  WorkbookJoinPlanPreview,
  WorkbookRelationship,
} from "./workbookRelationshipTypes";

const describeJoinBehavior = (relationship: WorkbookRelationship) => {
  const source = relationship.sourceSheet;
  const target = relationship.targetSheet;
  const sourceKey = relationship.candidateKeys[0]?.sourceColumn || "source key";
  const targetKey = relationship.candidateKeys[0]?.targetColumn || "target key";

  if (relationship.relationshipType === "one_to_many") {
    return `${target} can enrich or group many ${source} rows through ${sourceKey} to ${targetKey}.`;
  }
  if (relationship.relationshipType === "many_to_one") {
    return `${source} can enrich or group many ${target} rows through ${sourceKey} to ${targetKey}.`;
  }
  if (relationship.relationshipType === "one_to_one") {
    return `${source} and ${target} may describe the same business entity at a matching grain.`;
  }
  if (relationship.relationshipType === "many_to_many") {
    return `${source} and ${target} may require an intermediate bridge before future analysis.`;
  }
  return `${source} and ${target} may be related, but the future join behavior still needs review.`;
};

const buildFutureNotes = (relationship: WorkbookRelationship) => {
  const notes = [
    "Metadata-only preview; no join will execute in this phase.",
    "Future execution must validate worksheet status, table mappings, and key compatibility.",
  ];

  if (relationship.relationshipStatus !== "user_confirmed") {
    notes.push("Relationship should be reviewed before any future execution phase.");
  }
  if (relationship.confidenceLevel === "low") {
    notes.push("Low-confidence relationship should remain advisory until re-profiled or confirmed.");
  }

  return notes;
};

const uniqueCategories = (categories: AnalyticsTaskCategory[]) => Array.from(new Set(categories));

export const buildWorkbookJoinPlanPreviews = (
  relationships: WorkbookRelationship[],
): WorkbookJoinPlanPreview[] =>
  relationships
    .filter((relationship) => relationship.relationshipStatus !== "unsupported")
    .slice(0, 12)
    .map((relationship) => ({
      id: `join-preview:${relationship.id}`,
      relatedSheets: [relationship.sourceSheet, relationship.targetSheet],
      suggestedRelationshipPath: [
        `${relationship.sourceTable}.${relationship.candidateKeys[0]?.sourceColumn || "source_key"}`,
        `${relationship.targetTable}.${relationship.candidateKeys[0]?.targetColumn || "target_key"}`,
      ],
      expectedJoinBehavior: describeJoinBehavior(relationship),
      supportedTaskCategories: uniqueCategories(relationship.supportedAnalysisTypes),
      futureExecutionNotes: buildFutureNotes(relationship),
      relationshipIds: [relationship.id],
    }));
