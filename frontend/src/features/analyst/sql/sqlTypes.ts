import type { SchemaColumn } from "../../dataset/datasetTypes";
import type {
  SqlDialectId,
  SqlDialectProfile,
  SqlIntelligenceDiagnostic,
  SqlValidationResult,
  SqlWorkspaceAnalysis,
} from "../../sqlIntelligence";
import type { AnalysisScopeSelection } from "../../workbook";
import type { SqlDialectDraftConversion } from "./sqlDialectDraftConversion";
import type { SqlExecutionErrorInsight } from "./sqlErrorFormatter";
import type { SqlWorkspaceTabCreatedFrom } from "./sqlTabsTypes";
import type { BusinessIntent } from "./businessIntentGrounding";
import type { SqlBusinessQuestionShape } from "./sqlBusinessQuestionShape";
import type { BusinessSqlClarificationDecisionProvenance } from "./businessSqlPreviewProvenance";
import type { SqlExecutionIdentity } from "./sqlExecutionIdentity";

export type SqlExecutionStatus =
  | "idle"
  | "draft-saved"
  | "explain-ready"
  | "running"
  | "success"
  | "error";

export type SqlQueryDraft = {
  id: string;
  name: string;
  sql: string;
  savedAt: string;
  dialect: SqlDialectId;
};

export type SqlPreviewResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  message: string;
  errorInsight?: SqlExecutionErrorInsight | null;
  executedQuestion?: ExecutedQuestionSnapshot;
  executionIdentity?: SqlExecutionIdentity;
};

export type ExecutedQuestionSnapshot = {
  taskPrompt: string;
  detectedIntent?: BusinessIntent;
  questionShape?: SqlBusinessQuestionShape;
  sqlAtRun: string;
  ranAt: string;
  sourceLabel: string | null;
  sourceTableName: string | null;
  clarificationDecision?: BusinessSqlClarificationDecisionProvenance;
};

export type SqlQuestionHandoff = {
  id: string;
  source: "home";
  question: string;
  datasetId: string;
  worksheetId: string | null;
  createdAt: string;
};

export type SqlSuggestion = {
  id: string;
  label: string;
  description: string;
  sql: string;
};

export type SqlTemplate = SqlSuggestion & {
  category: "select" | "aggregate" | "filter" | "sort";
};

export type SqlEditorInterface = {
  value: string;
  onChange: (sqlText: string) => void;
  onRun: () => void;
  onExplain: () => void;
  onSaveDraft: () => void;
  onClear: () => void;
  schema: SchemaColumn[];
  suggestions: SqlSuggestion[];
  templates: SqlTemplate[];
  keywordSuggestions: string[];
  diagnostics: SqlIntelligenceDiagnostic[];
};

export type SqlGuidanceCard = SqlWorkspaceAnalysis["explanationCards"][number];

export type SqlQueryExplanation = {
  title: string;
  summary: string;
  intent: string;
  source: string;
  fields: string[];
  filters: string[];
  grouping: string[];
  sorting: string[];
  joins: string[];
  outputShape: string;
  businessMeaning: string;
  safetyNote: string;
  isComplex: boolean;
  fallbackMessage: string | null;
};

export type SqlReadinessIssue = {
  id: string;
  severity: "info" | "warning";
  message: string;
};

export type SqlReadinessReport = {
  status: "ready" | "info" | "warning";
  summary: string;
  issues: SqlReadinessIssue[];
};

export type SqlDialectOption = Pick<SqlDialectProfile, "id" | "displayName">;

export type SqlDialectContext = {
  selectedDialect: SqlDialectId;
  selectedDialectProfile: SqlDialectProfile;
  dialectOptions: SqlDialectOption[];
  draftConversionPreview: SqlDialectDraftConversion | null;
  onDialectChange: (dialect: SqlDialectId) => void;
  onApplyDraftConversion: () => void;
};

export type SqlWorkspaceTabView = {
  id: string;
  title: string;
  sourceBadge: string | null;
  isActive: boolean;
  isDirty: boolean;
  canClose: boolean;
};

export type SqlWorkspaceTabsInterface = {
  tabs: SqlWorkspaceTabView[];
  activeTabId: string;
  activeTabTitle: string;
  activeTabSourceBadge: string | null;
  activeTabSourceKind: "Original" | "Cleaned" | null;
  activeTabCreatedFrom: SqlWorkspaceTabCreatedFrom | null;
  selectedScopeSelections: AnalysisScopeSelection[];
  appliedScopeSelections: AnalysisScopeSelection[];
  taskPrompt: string;
  selectedTemplateLabel: string | null;
  onSelectedScopeChange: (selections: AnalysisScopeSelection[]) => void;
  onApplyScope: () => void;
  onTaskPromptChange: (prompt: string) => void;
  onMarkTemplate: (template: {
    id?: string;
    label?: string;
    createdFrom?: "template" | "report";
  }) => void;
  onNewTab: () => void;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
};

export type SqlValidationSummary = SqlValidationResult;
