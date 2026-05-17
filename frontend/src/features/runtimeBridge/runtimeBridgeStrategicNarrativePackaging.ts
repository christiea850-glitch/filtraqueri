import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeDeliveryPriority,
  RuntimeBridgeExecutiveAudience,
  RuntimeBridgeExecutiveDeliveryPlan,
  RuntimeBridgeVisualizationIntent,
} from "./runtimeBridgeExecutiveDeliveryIntelligence";
import { createRuntimeBridgeId } from "./runtimeBridgeIds";
import type { RuntimeBridgeInterpretationTheme } from "./runtimeBridgeInsightInterpretation";
import type { RuntimeBridgeSourceModuleReference } from "./runtimeBridgeTypes";

export type RuntimeBridgeNarrativePriority = RuntimeBridgeDeliveryPriority;

export type RuntimeBridgeStrategicTheme =
  | "growth"
  | "risk"
  | "operations"
  | "governance"
  | "financial"
  | "customer"
  | "quality"
  | "evidence"
  | "confidence"
  | "relationship"
  | "opportunity"
  | "context";

export type RuntimeBridgeExecutiveFocusArea =
  | "board_alignment"
  | "executive_action_context"
  | "governance_review"
  | "operational_resilience"
  | "financial_impact"
  | "evidence_confidence"
  | "cross_functional_dependency";

export type RuntimeBridgeNarrativeSection = {
  readonly sectionId: string;
  readonly subjectId: string;
  readonly sequence: number;
  readonly title: string;
  readonly strategicTheme: RuntimeBridgeStrategicTheme;
  readonly priority: RuntimeBridgeNarrativePriority;
  readonly focusAreas: ReadonlyArray<RuntimeBridgeExecutiveFocusArea>;
  readonly sourceIntentIds: ReadonlyArray<string>;
  readonly sourcePackageIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeExecutiveStoryline = {
  readonly storylineId: string;
  readonly subjectId: string;
  readonly audience: RuntimeBridgeExecutiveAudience;
  readonly headline: string;
  readonly narrativePriority: RuntimeBridgeNarrativePriority;
  readonly sectionIds: ReadonlyArray<string>;
  readonly strategicThemes: ReadonlyArray<RuntimeBridgeStrategicTheme>;
  readonly focusAreas: ReadonlyArray<RuntimeBridgeExecutiveFocusArea>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBusinessObjectiveAlignment = {
  readonly alignmentId: string;
  readonly subjectId: string;
  readonly objective: "protect_value" | "improve_operations" | "strengthen_governance" | "grow_opportunity" | "clarify_confidence";
  readonly strategicTheme: RuntimeBridgeStrategicTheme;
  readonly priority: RuntimeBridgeNarrativePriority;
  readonly focusAreaIds: ReadonlyArray<RuntimeBridgeExecutiveFocusArea>;
  readonly sourceSectionIds: ReadonlyArray<string>;
  readonly sourceIntentIds: ReadonlyArray<string>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeKPIStorySequence = {
  readonly sequenceId: string;
  readonly subjectId: string;
  readonly orderedThemeIds: ReadonlyArray<RuntimeBridgeStrategicTheme>;
  readonly orderedSectionIds: ReadonlyArray<string>;
  readonly sourceVisualizationIntentIds: ReadonlyArray<string>;
  readonly priority: RuntimeBridgeNarrativePriority;
  readonly progression: "risk_to_impact" | "context_to_confidence" | "operations_to_outcome" | "evidence_to_decision_context";
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicBriefingBundle = {
  readonly bundleId: string;
  readonly subjectId: string;
  readonly strategicTheme: RuntimeBridgeStrategicTheme;
  readonly priority: RuntimeBridgeNarrativePriority;
  readonly sectionIds: ReadonlyArray<string>;
  readonly objectiveAlignmentIds: ReadonlyArray<string>;
  readonly focusAreas: ReadonlyArray<RuntimeBridgeExecutiveFocusArea>;
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeBoardroomPresentation = {
  readonly presentationId: string;
  readonly subjectId: string;
  readonly audience: RuntimeBridgeExecutiveAudience;
  readonly communicationPosture: "brief" | "evidence_led" | "risk_led" | "strategic_review";
  readonly storylineId: string;
  readonly kpiSequenceId: string;
  readonly bundleIds: ReadonlyArray<string>;
  readonly sectionIds: ReadonlyArray<string>;
  readonly escalationStoryDensity: "low" | "medium" | "high";
  readonly summary: string;
  readonly metadataOnly: true;
};

export type RuntimeBridgeStrategicNarrativePackage = {
  readonly packageId: string;
  readonly subjectId: string;
  readonly storyline: RuntimeBridgeExecutiveStoryline;
  readonly briefingBundles: ReadonlyArray<RuntimeBridgeStrategicBriefingBundle>;
  readonly businessObjectiveAlignments: ReadonlyArray<RuntimeBridgeBusinessObjectiveAlignment>;
  readonly kpiStorySequence: RuntimeBridgeKPIStorySequence;
  readonly boardroomPresentation: RuntimeBridgeBoardroomPresentation;
  readonly narrativeSections: ReadonlyArray<RuntimeBridgeNarrativeSection>;
  readonly strategicThemes: ReadonlyArray<RuntimeBridgeStrategicTheme>;
  readonly narrativePriorities: ReadonlyArray<RuntimeBridgeNarrativePriority>;
  readonly executiveFocusAreas: ReadonlyArray<RuntimeBridgeExecutiveFocusArea>;
  readonly sourceDeliveryPlanId: string;
  readonly metadataOnly: true;
};

export const runtimeBridgeStrategicNarrativePackagingGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-strategic-narrative-packaging",
  label: "Runtime bridge strategic narrative packaging",
  description:
    "Metadata-only executive storyline structures, strategic briefing bundles, business objective alignment metadata, KPI story sequencing, boardroom presentation metadata, and long-form executive intelligence packaging.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-strategic-narrative-package",
    "runtime-bridge-executive-storyline",
    "runtime-bridge-strategic-briefing-bundle",
    "runtime-bridge-business-objective-alignment",
    "runtime-bridge-kpi-story-sequence",
    "runtime-bridge-boardroom-presentation",
    "runtime-bridge-narrative-section",
  ],
} satisfies MetadataOnlyBoundaryContract;

export const runtimeBridgeStrategicNarrativePackagingSourceModule: RuntimeBridgeSourceModuleReference = {
  moduleId: "runtime-bridge-strategic-narrative-packaging",
  modulePath: "frontend/src/features/runtimeBridge/runtimeBridgeStrategicNarrativePackaging.ts",
  capabilityMode: "metadata_only",
  label: "Runtime bridge strategic narrative packaging",
};

const uniqueStable = <T extends string>(items: ReadonlyArray<T>): T[] => {
  const seen = new Set<string>();
  const values: T[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    values.push(item);
  }

  return values;
};

const priorityScore = (priority: RuntimeBridgeNarrativePriority) => {
  if (priority === "critical") return 4;
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
};

const sortPriorities = (
  priorities: ReadonlyArray<RuntimeBridgeNarrativePriority>,
): RuntimeBridgeNarrativePriority[] =>
  uniqueStable(priorities).sort((left, right) => {
    const priorityDelta = priorityScore(right) - priorityScore(left);
    if (priorityDelta !== 0) return priorityDelta;
    return left.localeCompare(right);
  });

const strongestPriority = (
  priorities: ReadonlyArray<RuntimeBridgeNarrativePriority>,
): RuntimeBridgeNarrativePriority => sortPriorities(priorities)[0] || "low";

const mapInterpretationThemeToStrategicTheme = (
  theme: RuntimeBridgeInterpretationTheme,
): RuntimeBridgeStrategicTheme => {
  if (theme === "risk") return "risk";
  if (theme === "governance") return "governance";
  if (theme === "operational") return "operations";
  if (theme === "financial") return "financial";
  if (theme === "quality") return "quality";
  if (theme === "evidence") return "evidence";
  if (theme === "confidence") return "confidence";
  if (theme === "relationship" || theme === "lineage") return "relationship";
  if (theme === "opportunity" || theme === "advisory") return "opportunity";
  return "context";
};

const focusAreasForTheme = (
  theme: RuntimeBridgeStrategicTheme,
): ReadonlyArray<RuntimeBridgeExecutiveFocusArea> => {
  if (theme === "risk" || theme === "governance") return ["governance_review", "board_alignment"];
  if (theme === "operations" || theme === "quality") return ["operational_resilience"];
  if (theme === "financial" || theme === "growth" || theme === "opportunity") {
    return ["financial_impact", "executive_action_context"];
  }
  if (theme === "evidence" || theme === "confidence") return ["evidence_confidence"];
  if (theme === "relationship") return ["cross_functional_dependency"];
  return ["executive_action_context"];
};

const objectiveForTheme = (
  theme: RuntimeBridgeStrategicTheme,
): RuntimeBridgeBusinessObjectiveAlignment["objective"] => {
  if (theme === "risk") return "protect_value";
  if (theme === "governance") return "strengthen_governance";
  if (theme === "operations" || theme === "quality") return "improve_operations";
  if (theme === "opportunity" || theme === "growth" || theme === "financial") return "grow_opportunity";
  return "clarify_confidence";
};

const collectSourcePackageIds = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
  intent: RuntimeBridgeVisualizationIntent,
) =>
  uniqueStable([
    ...intent.sourcePackageIds,
    ...plan.insightDigest.insightPackageIds,
    ...plan.insightDigest.recommendationPackageIds,
  ]);

export const collectRuntimeBridgeStrategicThemes = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeStrategicTheme> => {
  const themes: RuntimeBridgeStrategicTheme[] = [
    ...plan.audience.emphasisThemes.map(mapInterpretationThemeToStrategicTheme),
    ...plan.insightDigest.themeIds.map(mapInterpretationThemeToStrategicTheme),
    ...plan.visualizationIntents.map((intent) => mapInterpretationThemeToStrategicTheme(intent.theme)),
  ];

  if (plan.escalationBriefing.posture === "urgent_review" || plan.escalationBriefing.posture === "review") {
    themes.push("risk");
  }

  return uniqueStable(themes);
};

export const classifyRuntimeBridgeExecutiveFocusAreas = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeExecutiveFocusArea> =>
  uniqueStable(collectRuntimeBridgeStrategicThemes(plan).flatMap(focusAreasForTheme));

export const summarizeRuntimeBridgeNarrativePriorities = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeNarrativePriority> =>
  sortPriorities([
    ...plan.deliveryPriorities,
    plan.audience.priority,
    plan.presentationIntent.deliveryPriority,
    plan.escalationBriefing.priority,
    plan.insightDigest.priority,
  ]);

const buildNarrativeSections = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
): ReadonlyArray<RuntimeBridgeNarrativeSection> => {
  const sections = plan.visualizationIntents.map((intent, index) => {
    const strategicTheme = mapInterpretationThemeToStrategicTheme(intent.theme);
    const priority = intent.insightHighlightImportance;

    return {
      sectionId: createRuntimeBridgeId(
        "runtime-bridge-narrative-section",
        plan.subjectId,
        strategicTheme,
        index + 1,
      ),
      subjectId: plan.subjectId,
      sequence: index + 1,
      title: `${strategicTheme} storyline`,
      strategicTheme,
      priority,
      focusAreas: focusAreasForTheme(strategicTheme),
      sourceIntentIds: [intent.intentId],
      sourcePackageIds: collectSourcePackageIds(plan, intent),
      summary: `${strategicTheme} narrative section sequences ${intent.executiveEmphasis} emphasis with ${priority} priority.`,
      metadataOnly: true as const,
    };
  });

  return sections.sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.sectionId.localeCompare(right.sectionId);
  }).map((section, index) => ({
    ...section,
    sequence: index + 1,
  }));
};

export const buildRuntimeBridgeExecutiveStoryline = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
): RuntimeBridgeExecutiveStoryline => {
  const sections = buildNarrativeSections(plan);
  const strategicThemes = uniqueStable(sections.map((section) => section.strategicTheme));
  const focusAreas = uniqueStable(sections.flatMap((section) => section.focusAreas));
  const narrativePriority = strongestPriority(sections.map((section) => section.priority));

  return {
    storylineId: createRuntimeBridgeId("runtime-bridge-executive-storyline", plan.subjectId),
    subjectId: plan.subjectId,
    audience: plan.audience.audience,
    headline: plan.presentationIntent.summary,
    narrativePriority,
    sectionIds: sections.map((section) => section.sectionId),
    strategicThemes,
    focusAreas,
    summary: `Executive storyline packages ${sections.length} narrative sections for ${plan.audience.audience} audience with ${narrativePriority} priority.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeBusinessObjectives = ({
  plan,
  sections = buildNarrativeSections(plan),
}: {
  readonly plan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly sections?: ReadonlyArray<RuntimeBridgeNarrativeSection>;
}): ReadonlyArray<RuntimeBridgeBusinessObjectiveAlignment> =>
  collectRuntimeBridgeStrategicThemes(plan).map((theme) => {
    const themeSections = sections.filter((section) => section.strategicTheme === theme);
    const sourceIntentIds = uniqueStable(themeSections.flatMap((section) => section.sourceIntentIds));
    const priority = strongestPriority(themeSections.map((section) => section.priority));

    return {
      alignmentId: createRuntimeBridgeId("runtime-bridge-business-objective-alignment", plan.subjectId, theme),
      subjectId: plan.subjectId,
      objective: objectiveForTheme(theme),
      strategicTheme: theme,
      priority,
      focusAreaIds: focusAreasForTheme(theme),
      sourceSectionIds: themeSections.map((section) => section.sectionId),
      sourceIntentIds,
      summary: `${theme} narrative metadata aligns to ${objectiveForTheme(theme)} with ${priority} priority.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.alignmentId.localeCompare(right.alignmentId);
  });

export const buildRuntimeBridgeKPIStorySequence = ({
  plan,
  sections = buildNarrativeSections(plan),
}: {
  readonly plan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly sections?: ReadonlyArray<RuntimeBridgeNarrativeSection>;
}): RuntimeBridgeKPIStorySequence => {
  const orderedSections = [...sections].sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.sequence - right.sequence;
  });
  const orderedThemeIds = uniqueStable(orderedSections.map((section) => section.strategicTheme));
  const progression: RuntimeBridgeKPIStorySequence["progression"] =
    orderedThemeIds.includes("risk")
      ? "risk_to_impact"
      : orderedThemeIds.includes("operations")
        ? "operations_to_outcome"
        : orderedThemeIds.includes("evidence") || orderedThemeIds.includes("confidence")
          ? "evidence_to_decision_context"
          : "context_to_confidence";

  return {
    sequenceId: createRuntimeBridgeId("runtime-bridge-kpi-story-sequence", plan.subjectId),
    subjectId: plan.subjectId,
    orderedThemeIds,
    orderedSectionIds: orderedSections.map((section) => section.sectionId),
    sourceVisualizationIntentIds: plan.visualizationIntents.map((intent) => intent.intentId),
    priority: strongestPriority(orderedSections.map((section) => section.priority)),
    progression,
    summary: `KPI story sequence follows ${progression} across ${orderedThemeIds.length} strategic themes.`,
    metadataOnly: true,
  };
};

export const buildRuntimeBridgeStrategicBriefingBundles = ({
  plan,
  sections = buildNarrativeSections(plan),
  alignments = summarizeRuntimeBridgeBusinessObjectives({ plan, sections }),
}: {
  readonly plan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly sections?: ReadonlyArray<RuntimeBridgeNarrativeSection>;
  readonly alignments?: ReadonlyArray<RuntimeBridgeBusinessObjectiveAlignment>;
}): ReadonlyArray<RuntimeBridgeStrategicBriefingBundle> =>
  collectRuntimeBridgeStrategicThemes(plan).map((theme) => {
    const themeSections = sections.filter((section) => section.strategicTheme === theme);
    const themeAlignments = alignments.filter((alignment) => alignment.strategicTheme === theme);
    const priority = strongestPriority([
      ...themeSections.map((section) => section.priority),
      ...themeAlignments.map((alignment) => alignment.priority),
    ]);

    return {
      bundleId: createRuntimeBridgeId("runtime-bridge-strategic-briefing-bundle", plan.subjectId, theme),
      subjectId: plan.subjectId,
      strategicTheme: theme,
      priority,
      sectionIds: themeSections.map((section) => section.sectionId),
      objectiveAlignmentIds: themeAlignments.map((alignment) => alignment.alignmentId),
      focusAreas: uniqueStable([
        ...focusAreasForTheme(theme),
        ...themeSections.flatMap((section) => section.focusAreas),
      ]),
      summary: `${theme} strategic briefing bundle contains ${themeSections.length} narrative sections and ${themeAlignments.length} objective alignments.`,
      metadataOnly: true as const,
    };
  }).sort((left, right) => {
    const priorityDelta = priorityScore(right.priority) - priorityScore(left.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return left.bundleId.localeCompare(right.bundleId);
  });

export const buildRuntimeBridgeBoardroomPresentation = ({
  plan,
  storyline,
  kpiSequence,
  bundles,
  sections,
}: {
  readonly plan: RuntimeBridgeExecutiveDeliveryPlan;
  readonly storyline: RuntimeBridgeExecutiveStoryline;
  readonly kpiSequence: RuntimeBridgeKPIStorySequence;
  readonly bundles: ReadonlyArray<RuntimeBridgeStrategicBriefingBundle>;
  readonly sections: ReadonlyArray<RuntimeBridgeNarrativeSection>;
}): RuntimeBridgeBoardroomPresentation => {
  const communicationPosture: RuntimeBridgeBoardroomPresentation["communicationPosture"] =
    storyline.narrativePriority === "critical"
      ? "risk_led"
      : plan.audience.posture === "evidence_first"
        ? "evidence_led"
        : bundles.length >= 4
          ? "strategic_review"
          : "brief";
  const escalationStoryDensity: RuntimeBridgeBoardroomPresentation["escalationStoryDensity"] =
    plan.escalationBriefing.posture === "urgent_review"
      ? "high"
      : plan.escalationBriefing.posture === "review" || plan.escalationBriefing.posture === "watch"
        ? "medium"
        : "low";

  return {
    presentationId: createRuntimeBridgeId("runtime-bridge-boardroom-presentation", plan.subjectId),
    subjectId: plan.subjectId,
    audience: plan.audience.audience,
    communicationPosture,
    storylineId: storyline.storylineId,
    kpiSequenceId: kpiSequence.sequenceId,
    bundleIds: bundles.map((bundle) => bundle.bundleId),
    sectionIds: sections.map((section) => section.sectionId),
    escalationStoryDensity,
    summary: `Boardroom presentation metadata uses ${communicationPosture} posture with ${escalationStoryDensity} escalation storytelling density.`,
    metadataOnly: true,
  };
};

export const summarizeRuntimeBridgeStrategicNarrativePosture = (
  strategicPackage: RuntimeBridgeStrategicNarrativePackage,
): string =>
  `Strategic narrative package describes ${strategicPackage.storyline.narrativePriority} priority across ${strategicPackage.strategicThemes.length} strategic themes, ${strategicPackage.executiveFocusAreas.length} focus areas, and ${strategicPackage.narrativeSections.length} narrative sections.`;

export const buildRuntimeBridgeStrategicNarrativePackage = (
  plan: RuntimeBridgeExecutiveDeliveryPlan,
): RuntimeBridgeStrategicNarrativePackage => {
  const narrativeSections = buildNarrativeSections(plan);
  const storyline = buildRuntimeBridgeExecutiveStoryline(plan);
  const businessObjectiveAlignments = summarizeRuntimeBridgeBusinessObjectives({
    plan,
    sections: narrativeSections,
  });
  const kpiStorySequence = buildRuntimeBridgeKPIStorySequence({
    plan,
    sections: narrativeSections,
  });
  const briefingBundles = buildRuntimeBridgeStrategicBriefingBundles({
    plan,
    sections: narrativeSections,
    alignments: businessObjectiveAlignments,
  });
  const boardroomPresentation = buildRuntimeBridgeBoardroomPresentation({
    plan,
    storyline,
    kpiSequence: kpiStorySequence,
    bundles: briefingBundles,
    sections: narrativeSections,
  });

  return {
    packageId: createRuntimeBridgeId("runtime-bridge-strategic-narrative-package", plan.subjectId),
    subjectId: plan.subjectId,
    storyline,
    briefingBundles,
    businessObjectiveAlignments,
    kpiStorySequence,
    boardroomPresentation,
    narrativeSections,
    strategicThemes: collectRuntimeBridgeStrategicThemes(plan),
    narrativePriorities: summarizeRuntimeBridgeNarrativePriorities(plan),
    executiveFocusAreas: classifyRuntimeBridgeExecutiveFocusAreas(plan),
    sourceDeliveryPlanId: plan.planId,
    metadataOnly: true,
  };
};
