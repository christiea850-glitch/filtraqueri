import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import type { AcceptedRelationshipContract } from "../../workbook";
import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityLevel,
} from "../llm/llmGovernanceTypes";
import type { BusinessIntent } from "./businessIntentGrounding";
import type {
  AdaptiveReportProposal,
  MissingRequirement,
  ProposedAssumption,
  ProposedEntity,
  ProposedFilter,
  ProposedGrouping,
  ProposedJoinNeed,
  ProposedMetric,
  ProposedWarning,
} from "./adaptiveReportProposal";
import type { SemanticColumnRole, SemanticHintConfidence } from "./semanticHintRegistry";

export type AdaptiveProposalLlmPayloadProvenance = {
  source: "adaptive_proposal_metadata_only";
  rawRowsIncluded: false;
  sampleValuesIncluded: false;
  topValuesIncluded: false;
  sqlIncluded: false;
  promptTextIncluded: false;
  providerCallMade: false;
};

export type AdaptiveProposalLlmColumnRedaction =
  | "included"
  | "redacted_sensitive"
  | "excluded_restricted";

export type SanitizedAdaptiveColumnMetadata = {
  id: string;
  columnName: string | null;
  redactedColumnId: string | null;
  inferredType: SchemaColumn["inferred_type"];
  nullCount: number;
  uniqueCount: number;
  sensitivity: {
    category: AIColumnSensitivityCategory;
    level: AIColumnSensitivityLevel;
    reasons: string[];
  };
  redaction: AdaptiveProposalLlmColumnRedaction;
};

export type SanitizedAdaptiveTableMetadata = {
  worksheetId: string | null;
  displayName: string | null;
  tableName: string | null;
  redactedTableId: string | null;
  rowCount: number | null;
  columnCount: number;
  columns: SanitizedAdaptiveColumnMetadata[];
};

export type SanitizedSemanticHint = {
  id: string;
  tableName: string | null;
  columnName: string | null;
  redactedColumnId: string | null;
  primaryRole: SemanticColumnRole;
  roles: SemanticColumnRole[];
  confidence: SemanticHintConfidence;
  reasons: string[];
};

export type SanitizedAcceptedRelationship = {
  contractId: string;
  sourceTableName: string | null;
  sourceColumnName: string | null;
  targetTableName: string | null;
  targetColumnName: string | null;
  relationshipType: AcceptedRelationshipContract["relationshipType"];
  confidence: number;
  status: AcceptedRelationshipContract["status"];
  validationState: AcceptedRelationshipContract["validationState"];
};

export type AdaptiveProposalLlmGovernanceSnapshot = {
  providerStatus: "closed";
  providerMode: "provider_disabled";
  consentStatus: "not_requested";
  restrictedColumnCount: number;
  sensitiveColumnCount: number;
  redactedColumnCount: number;
  excludedColumnCount: number;
  blockingReasons: string[];
  notes: string[];
};

export type AdaptiveProposalLlmPayload = {
  schemaVersion: "adaptive-proposal-llm:v1";
  provenance: AdaptiveProposalLlmPayloadProvenance;
  selectedGuidanceDialect?: SqlDialectId;
  detectedIntent: BusinessIntent;
  proposal: Pick<
    AdaptiveReportProposal,
    | "title"
    | "support"
    | "confidence"
    | "entities"
    | "metrics"
    | "groupings"
    | "filters"
    | "joinNeeds"
    | "assumptions"
    | "missingRequirements"
    | "warnings"
    | "payloadFingerprint"
  > & {
    narrative: string;
  };
  tables: SanitizedAdaptiveTableMetadata[];
  semanticHints: SanitizedSemanticHint[];
  relationships: SanitizedAcceptedRelationship[];
  governance: AdaptiveProposalLlmGovernanceSnapshot;
};

export type AdaptiveProposalLlmResponse = {
  schemaVersion: "adaptive-proposal-llm-response:v1";
  title?: string;
  narrative?: string;
  entities?: ProposedEntity[];
  metrics?: ProposedMetric[];
  groupings?: ProposedGrouping[];
  filters?: ProposedFilter[];
  joinNeeds?: ProposedJoinNeed[];
  assumptions?: ProposedAssumption[];
  missingRequirements?: MissingRequirement[];
  warnings?: ProposedWarning[];
};

export type AdaptiveProposalLlmValidationIssue = {
  severity: "warning" | "error";
  code:
    | "invalid_shape"
    | "invalid_schema_version"
    | "forbidden_field"
    | "sql_like_content"
    | "unknown_table"
    | "unknown_column"
    | "redacted_reference"
    | "join_verification_overclaim"
    | "invalid_enum"
    | "overlong_text"
    | "payload_fingerprint_changed"
    | "missing_requirement_removed";
  message: string;
};

export type AdaptiveProposalLlmValidationResult = {
  ok: boolean;
  response: AdaptiveProposalLlmResponse | null;
  issues: AdaptiveProposalLlmValidationIssue[];
};

export type AdaptiveProposalLlmRefinementResult = {
  proposal: AdaptiveReportProposal;
  validation: AdaptiveProposalLlmValidationResult;
  changed: boolean;
};
