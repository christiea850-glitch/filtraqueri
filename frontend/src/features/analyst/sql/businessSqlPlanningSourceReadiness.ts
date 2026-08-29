import type {
  AnalysisScopeSelection,
  WorkbookMetadata,
  WorksheetMetadata,
} from "../../workbook";
import {
  createRelationshipEndpointSignature,
  type RelationshipEndpointSignature,
} from "../../workbook/worksheetSourceRevision";
import {
  createSqlAppliedSourceManifestV2,
  evaluateSqlAppliedSourceManifestV2Readiness,
  type SqlAppliedSourceManifestV2,
  type SqlAppliedSourceManifestV2ReasonCode,
  type SqlAppliedSourceManifestV2RelationshipBinding,
  type SqlAppliedSourceManifestV2SourceBindingInput,
  type SqlAppliedSourceManifestV2SourceMode,
} from "./sqlAppliedSourceManifest";
import {
  evaluateSourceAwareRelationshipSetEligibility,
  type SourceAwareRelationshipEligibilityReasonCode,
  type SourceAwareRelationshipRequest,
} from "./sourceAwareRelationshipEligibility";
import {
  adaptWorkbookSourceAuthority,
  createWorkbookSourceRegistryWorksheetKey,
  type SqlWorkbookSourceAuthorityAdapterReasonCode,
  type ValidatedWorkbookSourceRegistry,
  type ValidatedWorkbookSourceRevisionRecord,
} from "./sqlWorkbookSourceAuthorityAdapter";
import {
  getBusinessSqlAggregateResultConditionTarget,
  normalizeMetricAndMeasures,
  type BusinessSqlDerivedMeasure,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";

export type BusinessSqlPlanningSourceReadinessReasonCode =
  | SqlWorkbookSourceAuthorityAdapterReasonCode
  | SqlAppliedSourceManifestV2ReasonCode
  | SourceAwareRelationshipEligibilityReasonCode
  | "plan_source_mapping_missing"
  | "plan_source_mapping_ambiguous"
  | "plan_source_mapping_contradiction"
  | "relationship_authority_missing"
  | "relationship_endpoint_mismatch";

export type BusinessSqlPlanningSourceReadiness =
  | {
      ready: true;
      status: "ready";
      reasonCodes: [];
      explanations: [];
      manifest: SqlAppliedSourceManifestV2;
      sourceMode: SqlAppliedSourceManifestV2SourceMode;
      sourceBindings: SqlAppliedSourceManifestV2SourceBindingInput[];
      relationshipBindings: SqlAppliedSourceManifestV2RelationshipBinding[];
    }
  | {
      ready: false;
      status: "blocked";
      reasonCodes: BusinessSqlPlanningSourceReadinessReasonCode[];
      explanations: string[];
      manifest: null;
      sourceMode: SqlAppliedSourceManifestV2SourceMode;
      sourceBindings: SqlAppliedSourceManifestV2SourceBindingInput[];
      relationshipBindings: null;
    };

export type EvaluateBusinessSqlPlanningSourceReadinessInput = {
  plan: BusinessSqlQueryPlan;
  datasetId: string;
  workbookMetadata: WorkbookMetadata | null | undefined;
  appliedScopeSelections?: readonly AnalysisScopeSelection[];
};

type PlanSourceMapping = {
  tableName: string;
  worksheet: WorksheetMetadata;
  sourceKind: "original" | "cleaned_working_copy";
};

const hasText = (value: string | undefined | null): value is string =>
  Boolean(value && value.trim());

const normalize = (value: string) => value.trim().toLowerCase();

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();

const uniqueReasons = (
  values: readonly BusinessSqlPlanningSourceReadinessReasonCode[],
): BusinessSqlPlanningSourceReadinessReasonCode[] => Array.from(new Set(values));

const tableList = (values: readonly (string | undefined | null)[]): string[] =>
  uniqueStrings(values.filter(hasText));

const measureDependencyTables = (
  measureId: string,
  measures: readonly BusinessSqlMeasure[],
  derivedMeasures: readonly BusinessSqlDerivedMeasure[],
  seen: Set<string> = new Set(),
): string[] => {
  if (seen.has(measureId)) return [];
  seen.add(measureId);
  const direct = measures.find((measure) => measure.measureId === measureId);
  if (direct) return tableList([direct.table]);
  const derived = derivedMeasures.find((candidate) => candidate.derivedMeasureId === measureId);
  if (!derived) return [];
  return tableList([
    ...measureDependencyTables(derived.leftMeasureId, measures, derivedMeasures, seen),
    ...measureDependencyTables(derived.rightMeasureId, measures, derivedMeasures, seen),
  ]);
};

export const collectBusinessSqlPlanAppliedTables = (
  plan: BusinessSqlQueryPlan,
): string[] => {
  const normalizedPlan = normalizeMetricAndMeasures(plan);
  const tables: Array<string | undefined> = [
    plan.entities.find((entity) => entity.required)?.table,
    normalizedPlan.metric?.table,
    ...normalizedPlan.measures.map((measure) => measure.table),
    ...normalizedPlan.groupings.map((grouping) => grouping.table),
    ...normalizedPlan.filters.flatMap((filter) => [
      filter.table,
      filter.target?.kind === "field" ? filter.target.table : undefined,
    ]),
    ...normalizedPlan.joinPath.edges.flatMap((edge) => [edge.fromTable, edge.toTable]),
    ...normalizedPlan.orderBy.flatMap((sort) => {
      if (sort.target.kind === "field" || sort.target.kind === "grouping") {
        return [sort.target.table];
      }
      if (sort.target.kind === "measure") {
        return measureDependencyTables(
          sort.target.measureId,
          normalizedPlan.measures,
          normalizedPlan.derivedMeasures,
        );
      }
      return measureDependencyTables(
        sort.target.derivedMeasureId,
        normalizedPlan.measures,
        normalizedPlan.derivedMeasures,
      );
    }),
    ...normalizedPlan.aggregateResultConditions.flatMap((condition) => {
      const target = getBusinessSqlAggregateResultConditionTarget(condition);
      if (!target) return [];
      return measureDependencyTables(
        target.kind === "measure" ? target.measureId : target.derivedMeasureId,
        normalizedPlan.measures,
        normalizedPlan.derivedMeasures,
      );
    }),
  ];
  normalizedPlan.derivedMeasures.forEach((derivedMeasure) => {
    tables.push(
      ...measureDependencyTables(
        derivedMeasure.derivedMeasureId,
        normalizedPlan.measures,
        normalizedPlan.derivedMeasures,
      ),
    );
  });
  return tableList(tables);
};

const sourceModeFor = (
  mappings: readonly PlanSourceMapping[],
): SqlAppliedSourceManifestV2SourceMode => {
  const kinds = uniqueStrings(mappings.map((mapping) => mapping.sourceKind));
  if (kinds.length === 0) return "unknown";
  if (kinds.includes("original") && kinds.includes("cleaned_working_copy")) return "mixed";
  if (kinds.includes("cleaned_working_copy")) return "cleaned_only";
  return "original_only";
};

const mapPlanTableToSource = (
  tableName: string,
  workbook: WorkbookMetadata,
  appliedScopeSelections: readonly AnalysisScopeSelection[],
): {
  mapping: PlanSourceMapping | null;
  reasons: BusinessSqlPlanningSourceReadinessReasonCode[];
} => {
  const matches: PlanSourceMapping[] = [];
  workbook.worksheets.forEach((worksheet) => {
    if (normalize(worksheet.tableName) === normalize(tableName)) {
      matches.push({ tableName, worksheet, sourceKind: "original" });
    }
  });
  workbook.cleanedWorkingCopies.forEach((copy) => {
    if (normalize(copy.cleanedTableName) !== normalize(tableName)) return;
    const worksheet = workbook.worksheets.find(
      (candidate) => candidate.worksheetId === copy.sourceWorksheetId,
    );
    if (worksheet) {
      matches.push({ tableName, worksheet, sourceKind: "cleaned_working_copy" });
    }
  });
  if (matches.length === 0) {
    return { mapping: null, reasons: ["plan_source_mapping_missing"] };
  }
  if (matches.length > 1) {
    return { mapping: null, reasons: ["plan_source_mapping_ambiguous"] };
  }
  const mapping = matches[0];
  const applied = appliedScopeSelections.find(
    (selection) => selection.worksheetId === mapping.worksheet.worksheetId,
  );
  if (
    applied &&
    (applied.sourceType !== mapping.sourceKind ||
      normalize(applied.tableName) !== normalize(mapping.tableName))
  ) {
    return { mapping: null, reasons: ["plan_source_mapping_contradiction"] };
  }
  return { mapping, reasons: [] };
};

const currentRevisionFor = (
  registry: ValidatedWorkbookSourceRegistry,
  mapping: PlanSourceMapping,
): ValidatedWorkbookSourceRevisionRecord | null => {
  const source = registry.sourceByWorksheetKey.get(
    createWorkbookSourceRegistryWorksheetKey(mapping.worksheet.worksheetId, mapping.sourceKind),
  );
  if (
    !source ||
    source.sourceKind !== mapping.sourceKind ||
    normalize(source.tableName) !== normalize(mapping.tableName)
  ) {
    return null;
  }
  const revisionId = registry.currentRevisionBySourceId[source.sourceId];
  const revision = revisionId ? registry.revisionById.get(revisionId) : null;
  if (
    !revision ||
    revision.sourceId !== source.sourceId ||
    revision.worksheetId !== source.worksheetId ||
    revision.sourceKind !== source.sourceKind ||
    normalize(revision.tableName) !== normalize(source.tableName)
  ) {
    return null;
  }
  return revision;
};

const columnForEndpoint = (
  worksheet: WorksheetMetadata,
  revision: ValidatedWorkbookSourceRevisionRecord,
  columnName: string | undefined,
): RelationshipEndpointSignature | null => {
  if (!hasText(columnName)) return null;
  const columnIndex = worksheet.schema.findIndex(
    (column) => normalize(column.name) === normalize(columnName),
  );
  if (columnIndex < 0) return null;
  const column = worksheet.schema[columnIndex];
  const structuralColumn = revision.revision.structuralSchemaFingerprint.columns.find(
    (candidate) =>
      candidate.ordinal === columnIndex && normalize(candidate.name) === normalize(column.name),
  );
  if (
    !structuralColumn ||
    structuralColumn.physicalType !== column.type ||
    structuralColumn.logicalType !== (column.inferred_type || column.type)
  ) {
    return null;
  }
  try {
    return createRelationshipEndpointSignature({
      sourceRevision: revision.revision,
      columnId: structuralColumn.columnId,
      columnName: column.name,
      columnOrdinal: columnIndex,
      physicalType: column.type,
      logicalType: column.inferred_type || column.type,
    });
  } catch {
    return null;
  }
};

const explanationFor = (reason: BusinessSqlPlanningSourceReadinessReasonCode): string => {
  if (reason === "source_registry_missing_legacy") return "Current worksheet source authority is unavailable.";
  if (reason === "source_registry_version_unsupported") return "Workbook source authority uses an unsupported version.";
  if (reason === "source_registry_malformed") return "Workbook source authority is malformed.";
  if (reason === "source_registry_not_ready") return "Workbook source authority is not ready.";
  if (reason === "source_revision_missing") return "Current worksheet source revision is unavailable.";
  if (reason === "source_revision_mismatch") return "Current worksheet source revision no longer matches the plan.";
  if (reason === "structural_schema_mismatch") return "Current worksheet schema no longer matches source authority.";
  if (reason === "unsupported_cleaned_source") return "Cleaned worksheet sources are not supported for generated SQL yet.";
  if (reason === "unsupported_mixed_source") return "This plan mixes source modes that are not supported yet.";
  if (reason === "legacy_source_unverifiable") return "Legacy source state cannot be verified for generated SQL.";
  if (reason === "plan_source_mapping_missing") return "A planned table cannot be mapped to a workbook worksheet.";
  if (reason === "plan_source_mapping_ambiguous") return "A planned table maps to more than one workbook worksheet.";
  if (reason === "plan_source_mapping_contradiction") return "Applied worksheet scope contradicts the planned source table.";
  if (reason === "relationship_authority_missing") return "A resolved join is missing authoritative relationship identity.";
  if (reason === "relationship_endpoint_mismatch") return "A relationship endpoint no longer matches the current worksheet source.";
  if (reason === "source_bound_relationship_missing") return "A current source-bound relationship validation is required.";
  if (reason === "source_bound_relationship_mismatch") return "Source-bound relationship authority does not match the current validation and acceptance.";
  if (reason === "relationship_validation_projection_missing" || reason === "relationship_validation_record_missing") {
    return "A current source-bound relationship validation is required.";
  }
  if (reason === "relationship_acceptance_projection_missing" || reason === "relationship_acceptance_record_missing") {
    return "A current source-aware relationship acceptance is required.";
  }
  if (reason === "relationship_acceptance_legacy_source_blind") {
    return "This relationship confirmation is review-only and is not authoritative source validation.";
  }
  if (
    reason === "relationship_validation_stale" ||
    reason === "relationship_source_revision_mismatch" ||
    reason === "relationship_endpoint_renamed" ||
    reason === "relationship_endpoint_type_changed" ||
    reason === "relationship_schema_mismatch" ||
    reason === "relationship_evidence_changed"
  ) {
    return "The relationship validation no longer matches the current source revision.";
  }
  return reason.replace(/_/g, " ");
};

const blocked = ({
  reasonCodes,
  sourceMode = "unknown",
  sourceBindings = [],
}: {
  reasonCodes: BusinessSqlPlanningSourceReadinessReasonCode[];
  sourceMode?: SqlAppliedSourceManifestV2SourceMode;
  sourceBindings?: SqlAppliedSourceManifestV2SourceBindingInput[];
}): BusinessSqlPlanningSourceReadiness => {
  const normalized = uniqueReasons(reasonCodes);
  return {
    ready: false,
    status: "blocked",
    reasonCodes: normalized,
    explanations: uniqueStrings(normalized.map(explanationFor)),
    manifest: null,
    sourceMode,
    sourceBindings,
    relationshipBindings: null,
  };
};

export const evaluateBusinessSqlPlanningSourceReadiness = ({
  plan,
  datasetId,
  workbookMetadata,
  appliedScopeSelections = [],
}: EvaluateBusinessSqlPlanningSourceReadinessInput): BusinessSqlPlanningSourceReadiness => {
  const authority = adaptWorkbookSourceAuthority({
    workbook: workbookMetadata,
    datasetId,
  });
  if (!workbookMetadata || !authority.sourceRegistry) {
    return blocked({
      reasonCodes: authority.reasonCodes.length > 0
        ? authority.reasonCodes
        : ["source_registry_missing_legacy"],
    });
  }

  const tableNames = collectBusinessSqlPlanAppliedTables(plan);
  const mappingReasons: BusinessSqlPlanningSourceReadinessReasonCode[] = [];
  const mappings = tableNames.flatMap((tableName) => {
    const result = mapPlanTableToSource(tableName, workbookMetadata, appliedScopeSelections);
    mappingReasons.push(...result.reasons);
    return result.mapping ? [result.mapping] : [];
  });
  const sourceMode = sourceModeFor(mappings);
  if (mappingReasons.length > 0) {
    return blocked({ reasonCodes: mappingReasons, sourceMode });
  }
  if (sourceMode === "cleaned_only") {
    return blocked({ reasonCodes: ["unsupported_cleaned_source"], sourceMode });
  }
  if (sourceMode === "mixed") {
    return blocked({ reasonCodes: ["unsupported_mixed_source"], sourceMode });
  }
  if (sourceMode === "unknown") {
    return blocked({ reasonCodes: ["legacy_source_unverifiable"], sourceMode });
  }
  if (!authority.ready) {
    return blocked({ reasonCodes: authority.reasonCodes, sourceMode });
  }

  const revisionByWorksheet = new Map<string, ValidatedWorkbookSourceRevisionRecord>();
  const sourceBindings: SqlAppliedSourceManifestV2SourceBindingInput[] = [];
  const revisionReasons: BusinessSqlPlanningSourceReadinessReasonCode[] = [];
  mappings.forEach((mapping) => {
    const revision = currentRevisionFor(authority.sourceRegistry, mapping);
    if (!revision) {
      revisionReasons.push("source_revision_missing");
      return;
    }
    revisionByWorksheet.set(mapping.worksheet.worksheetId, revision);
    sourceBindings.push({
      sourceId: revision.sourceId,
      sourceKind: revision.sourceKind,
      worksheetId: revision.worksheetId,
      tableName: revision.tableName,
      sourceRevisionId: revision.revisionId,
      structuralSchemaFingerprint: revision.revision.structuralSchemaFingerprint.fingerprint,
    });
  });
  if (revisionReasons.length > 0) {
    return blocked({ reasonCodes: revisionReasons, sourceMode, sourceBindings });
  }

  const mappingsByTable = new Map(mappings.map((mapping) => [normalize(mapping.tableName), mapping]));
  const relationshipReasons: BusinessSqlPlanningSourceReadinessReasonCode[] = [];
  const requests: SourceAwareRelationshipRequest[] = [];
  if (sourceBindings.length > 1) {
    for (const edge of plan.joinPath.edges) {
      const fromMapping = hasText(edge.fromTable) ? mappingsByTable.get(normalize(edge.fromTable)) : null;
      const toMapping = hasText(edge.toTable) ? mappingsByTable.get(normalize(edge.toTable)) : null;
      if (!fromMapping || !toMapping) continue;
      const fromRevision = revisionByWorksheet.get(fromMapping.worksheet.worksheetId);
      const toRevision = revisionByWorksheet.get(toMapping.worksheet.worksheetId);
      if (!fromRevision || !toRevision || fromRevision.sourceId === toRevision.sourceId) continue;
      if (!edge.relationshipAuthority?.relationshipId) {
        relationshipReasons.push("relationship_authority_missing");
        continue;
      }
      const leftEndpoint = columnForEndpoint(fromMapping.worksheet, fromRevision, edge.fromField);
      const rightEndpoint = columnForEndpoint(toMapping.worksheet, toRevision, edge.toField);
      const validationProjection = authority.validationLedger.current.find(
        (projection) => projection.relationshipId === edge.relationshipAuthority?.relationshipId,
      );
      const validationRecord = validationProjection
        ? authority.validationLedger.records.find(
            (record) => record.recordId === validationProjection.validationRecordId,
          )
        : null;
      if (!leftEndpoint || !rightEndpoint) {
        relationshipReasons.push("relationship_endpoint_mismatch");
        continue;
      }
      if (!validationRecord) {
        relationshipReasons.push("relationship_validation_projection_missing");
        continue;
      }
      requests.push({
        relationshipId: edge.relationshipAuthority.relationshipId,
        direction: validationRecord.validation.direction,
        leftEndpoint,
        rightEndpoint,
        evidenceFingerprint: validationRecord.validation.evidenceFingerprint.fingerprint,
      });
    }
  }
  if (relationshipReasons.length > 0) {
    return blocked({ reasonCodes: relationshipReasons, sourceMode, sourceBindings });
  }

  const relationshipEligibility = evaluateSourceAwareRelationshipSetEligibility({
    requests,
    validationLedger: authority.validationLedger,
    acceptanceHistory: authority.acceptanceHistory,
    sourceBindingCount: sourceBindings.length,
  });
  if (!relationshipEligibility.ready) {
    return blocked({
      reasonCodes: relationshipEligibility.reasonCodes,
      sourceMode,
      sourceBindings,
    });
  }

  const manifestResult = createSqlAppliedSourceManifestV2({
    datasetId,
    workbookId: workbookMetadata.workbookId,
    sourceMode,
    sourceBindings,
    relationshipBindings: relationshipEligibility.bindings,
  });
  if (manifestResult.status !== "created") {
    return blocked({
      reasonCodes: manifestResult.reasonCodes,
      sourceMode,
      sourceBindings,
    });
  }
  const manifestReadiness = evaluateSqlAppliedSourceManifestV2Readiness({
    manifest: manifestResult.manifest,
    requiredRelationshipIds: requests.map((request) => request.relationshipId),
  });
  if (!manifestReadiness.eligible) {
    return blocked({
      reasonCodes: manifestReadiness.reasonCodes,
      sourceMode,
      sourceBindings,
    });
  }
  return {
    ready: true,
    status: "ready",
    reasonCodes: [],
    explanations: [],
    manifest: manifestResult.manifest,
    sourceMode,
    sourceBindings,
    relationshipBindings: relationshipEligibility.bindings,
  };
};
