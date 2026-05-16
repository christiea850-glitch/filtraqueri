import type { MetadataOnlyBoundaryContract } from "../governance/boundaryTypes";
import type {
  RuntimeBridgeCompositionResult,
  RuntimeBridgeCompositionSourceSummary,
} from "./runtimeBridgeComposition";
import type { RuntimeBridgeRelationshipTrace } from "./runtimeBridgeLineage";
import type {
  RuntimeBridgeContinuationReference,
  RuntimeBridgeSnapshot,
} from "./runtimeBridgeTypes";

export const runtimeBridgeGovernance = {
  mode: "metadata_only",
  contractId: "runtime-bridge-schema",
  label: "Runtime bridge schema",
  description:
    "Metadata-only bridge contracts connecting runtime lineage, advisory intelligence, investigations, explanations, continuations, and active result references.",
  confidence: "high",
  canExecute: false,
  canMutateWorkspace: false,
  canCallBackend: false,
  lineageRefs: [
    "runtime-bridge-node",
    "runtime-bridge-edge",
    "runtime-bridge-artifact",
    "runtime-bridge-continuation",
    "runtime-bridge-advisory",
    "runtime-bridge-investigation",
    "runtime-bridge-explanation",
    "runtime-bridge-result",
    "runtime-bridge-confidence",
    "runtime-bridge-event",
  ],
} satisfies MetadataOnlyBoundaryContract;

export type RuntimeBridgeCapabilityClassification =
  | "metadata_only"
  | "inspection_only"
  | "lineage_only"
  | "composition_only"
  | "advisory_only";

export type RuntimeBridgeRiskClassification =
  | "safe"
  | "review_required"
  | "execution_risk"
  | "orchestration_risk"
  | "replay_risk";

export type RuntimeBridgePolicyTag =
  | "metadata_only"
  | "serializable"
  | "inspection_only"
  | "lineage_only"
  | "composition_only"
  | "advisory_only"
  | "contains_continuations"
  | "contains_events"
  | "contains_runtime_references"
  | "contains_forbidden_execution_terms"
  | "contains_replay_terms"
  | "contains_autonomous_agent_terms"
  | "review_required";

export type RuntimeBridgeGovernanceSummary = {
  readonly subjectId: string;
  readonly capabilityClassification: RuntimeBridgeCapabilityClassification;
  readonly riskClassification: RuntimeBridgeRiskClassification;
  readonly policyTags: ReadonlyArray<RuntimeBridgePolicyTag>;
  readonly executionLeakageCount: number;
  readonly forbiddenImportCount: number;
  readonly replayMetadataCount: number;
  readonly autonomousAgentMetadataCount: number;
  readonly metadataOnly: true;
};

export type RuntimeBridgeGovernanceReport = RuntimeBridgeGovernanceSummary & {
  readonly findings: ReadonlyArray<string>;
  readonly valid: boolean;
  readonly metadataOnly: true;
};

type RuntimeBridgeGovernanceSubject =
  | RuntimeBridgeSnapshot
  | RuntimeBridgeCompositionResult
  | RuntimeBridgeCompositionSourceSummary
  | RuntimeBridgeRelationshipTrace
  | RuntimeBridgeContinuationReference
  | Record<string, unknown>;

const executableStyleTerms = [
  "callback",
  "handler",
  "onclick",
  "onrun",
  "onexecute",
  "execute",
  "executionpayload",
  "run",
  "dispatch",
  "mutation",
  "effect",
  "queryexecution",
  "sqlexecution",
  "exportexecution",
];

const forbiddenRuntimeImportTerms = [
  "executeworkspacequery",
  "useresultexecutioncoordinator",
  "useexportcontroller",
  "useworkspacedatasetcontroller",
  "useworkspaceruntimecoordinator",
  "runtimepersistence",
  "services/api",
  "app.tsx",
];

const replayStyleTerms = [
  "replay",
  "rerun",
  "restore",
  "reapply",
  "orchestrate",
  "schedule",
  "workflowdispatch",
];

const autonomousAgentTerms = [
  "agent",
  "autonomous",
  "autopilot",
  "selfexecute",
  "monitoringloop",
  "plannerdispatch",
];

const normalizePolicyTerm = (value: string) => value.toLowerCase().replace(/[^a-z0-9/]+/g, "");

const getSubjectRecord = (subject: RuntimeBridgeGovernanceSubject): Record<string, unknown> =>
  subject as Record<string, unknown>;

const getSubjectId = (subject: RuntimeBridgeGovernanceSubject) => {
  const record = getSubjectRecord(subject);
  const snapshot = "snapshot" in record ? (record.snapshot as Record<string, unknown>) : null;

  return String(
    record.bridgeId ||
      snapshot?.bridgeId ||
      record.sourceId ||
      record.rootNodeId ||
      record.continuationId ||
      record.id ||
      "runtime-bridge-governance-subject",
  );
};

const visitSerializableMetadata = (
  value: unknown,
  visitor: (key: string, value: unknown) => void,
  key = "root",
) => {
  visitor(key, value);

  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => visitSerializableMetadata(item, visitor, `${key}.${index}`));
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    visitSerializableMetadata(childValue, visitor, childKey);
  }
};

const collectMatchingMetadataTerms = (
  subject: RuntimeBridgeGovernanceSubject,
  terms: ReadonlyArray<string>,
) => {
  const matches: string[] = [];

  visitSerializableMetadata(subject, (key, value) => {
    const normalizedKey = normalizePolicyTerm(key);
    const normalizedValue = typeof value === "string" ? normalizePolicyTerm(value) : "";
    const matchedTerm = terms.find(
      (term) => normalizedKey.includes(term) || normalizedValue.includes(term),
    );

    if (matchedTerm) matches.push(`${key}:${matchedTerm}`);
  });

  return matches;
};

export const detectExecutableStyleReferences = (
  subject: RuntimeBridgeGovernanceSubject,
): ReadonlyArray<string> => collectMatchingMetadataTerms(subject, executableStyleTerms);

export const detectForbiddenRuntimeImports = (
  subject: RuntimeBridgeGovernanceSubject,
): ReadonlyArray<string> => collectMatchingMetadataTerms(subject, forbiddenRuntimeImportTerms);

export const detectReplayStyleMetadata = (
  subject: RuntimeBridgeGovernanceSubject,
): ReadonlyArray<string> => collectMatchingMetadataTerms(subject, replayStyleTerms);

export const detectAutonomousAgentMetadata = (
  subject: RuntimeBridgeGovernanceSubject,
): ReadonlyArray<string> => collectMatchingMetadataTerms(subject, autonomousAgentTerms);

export const detectRuntimeBridgeExecutionLeakage = (
  subject: RuntimeBridgeGovernanceSubject,
): ReadonlyArray<string> => [
  ...detectExecutableStyleReferences(subject),
  ...detectForbiddenRuntimeImports(subject),
];

export const isRuntimeBridgeMetadataOnly = (subject: RuntimeBridgeGovernanceSubject) => {
  const record = getSubjectRecord(subject);
  if (record.metadataOnly === true) return true;
  if ("snapshot" in record && (record.snapshot as Record<string, unknown>)?.metadataOnly === true) {
    return true;
  }
  return false;
};

export const classifyRuntimeBridgeCapability = (
  subject: RuntimeBridgeGovernanceSubject,
): RuntimeBridgeCapabilityClassification => {
  const record = getSubjectRecord(subject);

  if ("sourceSummary" in record || "snapshotCount" in record) return "composition_only";
  if ("ancestorNodeIds" in record || "descendantNodeIds" in record) return "lineage_only";
  if ("advisoryId" in record || "advisories" in record) return "advisory_only";
  if ("nodes" in record || "edges" in record || "rootNodeId" in record) return "inspection_only";
  return "metadata_only";
};

export const classifyRuntimeBridgeRisk = (
  subject: RuntimeBridgeGovernanceSubject,
): RuntimeBridgeRiskClassification => {
  if (detectAutonomousAgentMetadata(subject).length > 0) return "orchestration_risk";
  if (detectReplayStyleMetadata(subject).length > 0) return "replay_risk";
  if (detectRuntimeBridgeExecutionLeakage(subject).length > 0) return "execution_risk";
  if (!isRuntimeBridgeMetadataOnly(subject)) return "review_required";
  return "safe";
};

export const collectRuntimeBridgePolicyTags = (
  subject: RuntimeBridgeGovernanceSubject,
): ReadonlyArray<RuntimeBridgePolicyTag> => {
  const record = getSubjectRecord(subject);
  const tags = new Set<RuntimeBridgePolicyTag>(["serializable"]);
  const capability = classifyRuntimeBridgeCapability(subject);
  const executionLeakage = detectRuntimeBridgeExecutionLeakage(subject);
  const replayMetadata = detectReplayStyleMetadata(subject);
  const autonomousAgentMetadata = detectAutonomousAgentMetadata(subject);

  tags.add(capability);
  if (isRuntimeBridgeMetadataOnly(subject)) tags.add("metadata_only");
  if ("continuations" in record || "continuationId" in record) tags.add("contains_continuations");
  if ("events" in record || "eventId" in record) tags.add("contains_events");
  if ("nodes" in record || "relatedRuntimeNodeIds" in record) tags.add("contains_runtime_references");
  if (executionLeakage.length > 0) tags.add("contains_forbidden_execution_terms");
  if (replayMetadata.length > 0) tags.add("contains_replay_terms");
  if (autonomousAgentMetadata.length > 0) tags.add("contains_autonomous_agent_terms");
  if (classifyRuntimeBridgeRisk(subject) !== "safe") tags.add("review_required");

  return [...tags];
};

export const summarizeRuntimeBridgeGovernance = (
  subject: RuntimeBridgeGovernanceSubject,
): RuntimeBridgeGovernanceSummary => {
  const executionLeakage = detectRuntimeBridgeExecutionLeakage(subject);
  const forbiddenImports = detectForbiddenRuntimeImports(subject);
  const replayMetadata = detectReplayStyleMetadata(subject);
  const autonomousAgentMetadata = detectAutonomousAgentMetadata(subject);

  return {
    subjectId: getSubjectId(subject),
    capabilityClassification: classifyRuntimeBridgeCapability(subject),
    riskClassification: classifyRuntimeBridgeRisk(subject),
    policyTags: collectRuntimeBridgePolicyTags(subject),
    executionLeakageCount: executionLeakage.length,
    forbiddenImportCount: forbiddenImports.length,
    replayMetadataCount: replayMetadata.length,
    autonomousAgentMetadataCount: autonomousAgentMetadata.length,
    metadataOnly: true,
  };
};

export const validateRuntimeBridgeGovernance = (
  subject: RuntimeBridgeGovernanceSubject,
): RuntimeBridgeGovernanceReport => {
  const executionLeakage = detectRuntimeBridgeExecutionLeakage(subject);
  const forbiddenImports = detectForbiddenRuntimeImports(subject);
  const replayMetadata = detectReplayStyleMetadata(subject);
  const autonomousAgentMetadata = detectAutonomousAgentMetadata(subject);
  const summary = summarizeRuntimeBridgeGovernance(subject);
  const findings = [
    ...(!isRuntimeBridgeMetadataOnly(subject)
      ? ["Subject is not explicitly marked metadataOnly."]
      : []),
    ...executionLeakage.map((finding) => `Execution-style metadata detected: ${finding}.`),
    ...forbiddenImports.map((finding) => `Forbidden runtime import metadata detected: ${finding}.`),
    ...replayMetadata.map((finding) => `Replay-style metadata detected: ${finding}.`),
    ...autonomousAgentMetadata.map((finding) =>
      `Autonomous-agent-style metadata detected: ${finding}.`,
    ),
  ];

  return {
    ...summary,
    findings,
    valid: findings.length === 0,
    metadataOnly: true,
  };
};
