import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  advisoryFeatureFolders,
  advisoryHardFailImportTargets,
  allowedBoundaryErrors,
  allowedBoundaryWarnings,
  continuationCallbackFieldNames,
  controlledHashNavigationAllowedFiles,
  continuationMetadataFolders,
  executableImportTargets,
  investigationWorkspaceOwnershipFiles,
  investigationWorkspaceOwnershipForbiddenImports,
  investigationWorkspaceRenderingFiles,
  investigationWorkspaceRenderingForbiddenImports,
  navigationFolders,
  navigationForbiddenImports,
  presentationalFiles,
  presentationalFolders,
  presentationalForbiddenImports,
  runtimeBridgeConsumerFolders,
  runtimeBridgeConsumerForbiddenImports,
  runtimeBridgeArchitectureLayerOrder,
  runtimeBridgeArchitectureLayers,
  runtimeMetadataFolders,
  runtimeMetadataForbiddenImports,
  workspaceGovernanceFolders,
  workspaceGovernanceForbiddenImports,
} from "./governance-boundary-rules.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, "..");
const srcRoot = path.join(frontendRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const toPosix = (value) => value.split(path.sep).join("/");

const toProjectPath = (absolutePath) => toPosix(path.relative(frontendRoot, absolutePath));

const stripExtension = (projectPath) =>
  projectPath.replace(/\.(tsx?|jsx?)$/, "").replace(/\/index$/, "");

const isSourceFile = (filePath) => sourceExtensions.has(path.extname(filePath));

const pathExists = async (targetPath) => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const listSourceFiles = async (targetPath) => {
  if (!(await pathExists(targetPath))) return [];

  const targetStat = await stat(targetPath);
  if (targetStat.isFile()) return isSourceFile(targetPath) ? [targetPath] : [];

  const entries = await readdir(targetPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(targetPath, entry.name);
      if (entry.isDirectory()) return listSourceFiles(entryPath);
      return isSourceFile(entryPath) ? [entryPath] : [];
    }),
  );

  return nestedFiles.flat();
};

const unique = (items) => [...new Set(items)];

const readSourceFile = async (filePath) => ({
  absolutePath: filePath,
  projectPath: toProjectPath(filePath),
  source: await readFile(filePath, "utf8"),
});

const readProjectSourceFile = async (projectPath) =>
  readSourceFile(path.join(frontendRoot, projectPath));

const collectFilesFromProjectPaths = async (projectPaths) => {
  const files = await Promise.all(
    projectPaths.map((projectPath) => listSourceFiles(path.join(frontendRoot, projectPath))),
  );
  return unique(files.flat());
};

const importRegex =
  /import\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|export\s+(type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;

const parseImports = (source) => {
  const imports = [];
  let match;

  while ((match = importRegex.exec(source))) {
    imports.push({
      isTypeOnly: Boolean(match[1] || match[3]),
      specifier: match[2] || match[4],
    });
  }

  return imports;
};

const resolveImportTarget = (specifier, importerAbsolutePath) => {
  if (specifier.startsWith(".")) {
    const resolved = path.resolve(path.dirname(importerAbsolutePath), specifier);
    const projectPath = toProjectPath(resolved);
    return stripExtension(projectPath);
  }

  if (specifier.startsWith("@/")) return stripExtension(`src/${specifier.slice(2)}`);
  if (specifier.startsWith("/src/")) return stripExtension(specifier.slice(1));
  if (specifier.startsWith("src/")) return stripExtension(specifier);

  return specifier;
};

const matchesTarget = (resolvedTarget, configuredTarget) =>
  resolvedTarget === configuredTarget ||
  resolvedTarget.startsWith(`${configuredTarget}/`) ||
  resolvedTarget.startsWith(`${configuredTarget}.`);

const isAllowedWarning = ({ rule, file, importTarget, fieldName }) =>
  allowedBoundaryWarnings.some((allowedWarning) => {
    if (allowedWarning.rule !== rule) return false;
    if (allowedWarning.file && allowedWarning.file !== file) return false;
    if (allowedWarning.importTarget && allowedWarning.importTarget !== importTarget) return false;
    if (allowedWarning.fieldName && allowedWarning.fieldName !== fieldName) return false;
    return true;
  });

const isAllowedError = ({ rule, file, importTarget, fieldName }) =>
  allowedBoundaryErrors.some((allowedError) => {
    if (allowedError.rule !== rule) return false;
    if (allowedError.file && allowedError.file !== file) return false;
    if (allowedError.importTarget && allowedError.importTarget !== importTarget) return false;
    if (allowedError.fieldName && allowedError.fieldName !== fieldName) return false;
    return true;
  });

const createFinding = ({ severity, rule, file, importTarget, specifier, detail, fieldName }) => {
  const allowlistInput = { rule, file, importTarget, fieldName };
  if (severity === "error" && isAllowedError(allowlistInput)) return null;
  if (severity === "warn" && isAllowedWarning(allowlistInput)) return null;

  return {
    severity,
    rule,
    file,
    message: specifier
      ? `${rule}: ${file} imports ${specifier} (${detail})`
      : `${rule}: ${file} ${detail}`,
  };
};

const runtimeBridgeUsagePatterns = [
  {
    rule: "runtime-bridge-storage-api",
    importTarget: "browser-storage-api",
    patterns: [
      /\blocalStorage\s*\./,
      /\bsessionStorage\s*\./,
      /\bindexedDB\s*\./,
      /\bindexedDB\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-network-api",
    importTarget: "network-api",
    patterns: [
      /\bfetch\s*\(/,
      /\baxios\s*\./,
      /\baxios\s*\(/,
      /\bnew\s+WebSocket\s*\(/,
      /\bWebSocket\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-timer-api",
    importTarget: "timer-api",
    patterns: [
      /\bsetInterval\s*\(/,
      /\bsetTimeout\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-nondeterministic-id",
    importTarget: "nondeterministic-id-api",
    patterns: [
      /\bDate\.now\s*\(/,
      /\bMath\.random\s*\(/,
      /\bcrypto\.randomUUID\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-import-react",
    importTarget: "react-hook",
    patterns: [
      /\buse[A-Z][A-Za-z0-9_]*\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-import-chart-rendering",
    importTarget: "svg-canvas-rendering-api",
    patterns: [
      /\bcreateElementNS\s*\(\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/,
      /\bgetContext\s*\(\s*["']2d["']/,
      /\bnew\s+Path2D\s*\(/,
      /\bCanvasRenderingContext2D\b/,
      /\bSVGElement\b/,
    ],
  },
];

const runtimeBridgeConsumerUsagePatterns = [
  {
    rule: "runtime-bridge-consumer-storage-api",
    importTarget: "browser-storage-api",
    patterns: [
      /\blocalStorage\s*\./,
      /\bsessionStorage\s*\./,
      /\bindexedDB\s*\./,
      /\bindexedDB\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-consumer-network-api",
    importTarget: "network-api",
    patterns: [
      /\bfetch\s*\(/,
      /\baxios\s*\./,
      /\baxios\s*\(/,
      /\bnew\s+WebSocket\s*\(/,
      /\bWebSocket\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-consumer-timer-api",
    importTarget: "timer-api",
    patterns: [
      /\bsetInterval\s*\(/,
      /\bsetTimeout\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-consumer-nondeterministic-api",
    importTarget: "nondeterministic-api",
    patterns: [
      /\bDate\.now\s*\(/,
      /\bnew\s+Date\s*\(/,
      /\bMath\.random\s*\(/,
      /\bcrypto\.randomUUID\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-consumer-react-hook",
    importTarget: "react-hook",
    patterns: [
      /\buse[A-Z][A-Za-z0-9_]*\s*\(/,
    ],
  },
  {
    rule: "runtime-bridge-consumer-dom-rendering-api",
    importTarget: "dom-svg-canvas-api",
    patterns: [
      /\bdocument\./,
      /\bwindow\./,
      /\bcreateElementNS\s*\(/,
      /\bgetContext\s*\(\s*["']2d["']/,
      /\bnew\s+Path2D\s*\(/,
      /\bCanvasRenderingContext2D\b/,
      /\bSVGElement\b/,
      /\bHTMLElement\b/,
    ],
  },
  {
    rule: "runtime-bridge-consumer-async-io",
    importTarget: "async-io",
    patterns: [
      /\basync\s+/,
      /\bawait\s+/,
      /\bnew\s+Promise\s*\(/,
    ],
  },
];

const investigationWorkspaceRenderingUsagePatterns = [
  {
    rule: "investigation-workspace-rendering-browser-history-api",
    importTarget: "browser-history-api",
    patterns: [
      /\bglobalThis\.history\./,
      /\bhistory\.pushState\s*\(/,
      /\bhistory\.replaceState\s*\(/,
      /\baddEventListener\s*\(\s*["']hashchange["']/,
      /\baddEventListener\s*\(\s*["']popstate["']/,
      /\bonhashchange\b/,
      /\bonpopstate\b/,
    ],
  },
  {
    rule: "investigation-workspace-rendering-storage-api",
    importTarget: "browser-storage-api",
    patterns: [
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /\bindexedDB\b/,
    ],
  },
  {
    rule: "investigation-workspace-rendering-network-api",
    importTarget: "network-api",
    patterns: [
      /\bfetch\s*\(/,
      /\baxios\s*\./,
      /\baxios\s*\(/,
      /\bnew\s+WebSocket\s*\(/,
      /\bWebSocket\s*\(/,
    ],
  },
];

const isRuntimeBridgeFile = (projectPath) =>
  projectPath === "src/features/runtimeBridge" ||
  projectPath.startsWith("src/features/runtimeBridge/");

const isRuntimeBridgeIndexFile = (projectPath) =>
  projectPath === "src/features/runtimeBridge/index.ts" ||
  projectPath === "src/features/runtimeBridge/_contracts/index.ts" ||
  projectPath === "src/features/runtimeBridge/_kernel/index.ts" ||
  projectPath === "src/features/runtimeBridge/_registry/index.ts";

const isRuntimeBridgeModuleTarget = (projectPath) =>
  projectPath === "src/features/runtimeBridge" ||
  projectPath.startsWith("src/features/runtimeBridge/");

const getRuntimeBridgeLayer = (projectPath) => {
  const strippedProjectPath = stripExtension(projectPath);
  const exactLayer = runtimeBridgeArchitectureLayers[strippedProjectPath];
  if (exactLayer) return exactLayer;

  const prefix = Object.keys(runtimeBridgeArchitectureLayers)
    .filter((configuredPath) => strippedProjectPath.startsWith(`${configuredPath}/`))
    .sort((left, right) => right.length - left.length)[0];

  return prefix ? runtimeBridgeArchitectureLayers[prefix] : null;
};

const getRuntimeBridgeLayerRank = (layer) => runtimeBridgeArchitectureLayerOrder[layer] ?? Number.POSITIVE_INFINITY;

const runtimeBridgeRuleForLayerViolation = (sourceLayer, targetLayer, resolvedTarget) => {
  if (sourceLayer === "kernel" && targetLayer !== "kernel" && targetLayer !== "foundation") {
    return "runtime-bridge-kernel-reverse-dependency";
  }

  if (
    (sourceLayer === "visualization" &&
      ["lifecycle", "resilience", "observability"].includes(targetLayer)) ||
    (sourceLayer === "governance" &&
      resolvedTarget === "src/features/runtimeBridge/runtimeBridgeExecutivePresentationOrchestration")
  ) {
    return "runtime-bridge-cross-layer-violation";
  }

  return "runtime-bridge-forbidden-layer-direction";
};

const createRuntimeBridgeArchitectureFinding = ({
  rule,
  file,
  importTarget,
  specifier,
  detail,
}) =>
  createFinding({
    severity: "error",
    rule,
    file,
    importTarget,
    specifier,
    detail,
  });

const createRuntimeBridgeImportFinding = ({
  file,
  importEntry,
  resolvedTarget,
  target,
  rule,
}) =>
  createFinding({
    severity: "error",
    rule,
    file: file.projectPath,
    importTarget: target,
    specifier: importEntry.specifier,
    detail: `matches ${resolvedTarget}`,
  });

const findRuntimeBridgeCycle = (graph) => {
  const sortedNodes = [...graph.keys()].sort();
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  const visit = (node) => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      return [...stack.slice(cycleStart), node];
    }
    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);

    for (const nextNode of [...(graph.get(node) || [])].sort()) {
      const cycle = visit(nextNode);
      if (cycle) return cycle;
    }

    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };

  for (const node of sortedNodes) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }

  return null;
};

const runtimeBridgeRegistryForbiddenCapabilityValues = [
  "runtime_execution",
  "workflow_dispatch",
  "backend_api",
  "storage_write",
  "memory_persistence",
  "session_restore",
  "react_rendering",
  "chart_rendering",
  "network_call",
  "timer_loop",
  "random_id",
];

const matchAllStrings = (source, pattern) => [...source.matchAll(pattern)].map((match) => match[1]);

const auditRuntimeBridgeRegistry = async () => {
  const files = await collectFilesFromProjectPaths(["src/features/runtimeBridge/_registry"]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const approvedLayers = new Set(Object.keys(runtimeBridgeArchitectureLayerOrder));
  const findings = [];

  for (const file of sourceFiles) {
    const moduleIds = matchAllStrings(file.source, /\bmoduleId:\s*"([^"]+)"/g);
    for (const moduleId of moduleIds) {
      if (/^[a-z0-9:-]+$/.test(moduleId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-registry-nondeterministic-id",
        file: file.projectPath,
        message: `runtime-bridge-registry-nondeterministic-id: ${file.projectPath} moduleId "${moduleId}" is not a deterministic slug`,
      });
    }

    const layerValues = matchAllStrings(file.source, /\blayer:\s*"([^"]+)"/g);
    const dependencyLayerBlocks = [...file.source.matchAll(/\ballowedDependencyLayers:\s*\[([\s\S]*?)\]/g)]
      .map((match) => match[1]);
    const dependencyLayerValues = dependencyLayerBlocks.flatMap((block) =>
      matchAllStrings(block, /"([^"]+)"/g),
    );

    for (const layer of [...layerValues, ...dependencyLayerValues]) {
      if (approvedLayers.has(layer)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-registry-unapproved-layer",
        file: file.projectPath,
        message: `runtime-bridge-registry-unapproved-layer: ${file.projectPath} declares layer "${layer}"`,
      });
    }

    if (/\bgovernanceClassification:\s*"(?!metadata_only")/.test(file.source)) {
      findings.push({
        severity: "error",
        rule: "runtime-bridge-registry-not-metadata-only",
        file: file.projectPath,
        message: `runtime-bridge-registry-not-metadata-only: ${file.projectPath} declares non metadata-only governance classification`,
      });
    }

    if (/\bmetadataOnly:\s*false\b/.test(file.source)) {
      findings.push({
        severity: "error",
        rule: "runtime-bridge-registry-not-metadata-only",
        file: file.projectPath,
        message: `runtime-bridge-registry-not-metadata-only: ${file.projectPath} declares metadataOnly false`,
      });
    }

    const deterministicCapabilityBlocks = [...file.source.matchAll(/\bdeterministicCapabilities:\s*\[([\s\S]*?)\]/g)]
      .map((match) => match[1]);
    for (const block of deterministicCapabilityBlocks) {
      for (const capability of runtimeBridgeRegistryForbiddenCapabilityValues) {
        if (!block.includes(`"${capability}"`)) continue;

        findings.push({
          severity: "error",
          rule: "runtime-bridge-registry-forbidden-capability",
          file: file.projectPath,
          message: `runtime-bridge-registry-forbidden-capability: ${file.projectPath} declares "${capability}" as deterministic capability`,
        });
      }
    }
  }

  return findings;
};

const runtimeBridgeApprovedReadinessIds = new Set([
  "metadata_only",
  "advisory_ready",
  "runtime_candidate",
  "execution_prohibited",
  "governance_review_required",
  "future_runtime_possible",
]);

const runtimeBridgeApprovedBoundaryIds = new Set([
  "metadata_boundary",
  "runtime_boundary",
  "orchestration_boundary",
  "persistence_boundary",
  "rendering_boundary",
  "backend_boundary",
  "agent_boundary",
  "export_boundary",
]);

const runtimeBridgeForbiddenEligibilityFields = [
  "executable",
  "runtimeEligible",
  "uiEligible",
  "persistenceEligible",
  "orchestrationEligible",
  "exportEligible",
  "backendEligible",
  "agentEligible",
  "workflowEligible",
];

const runtimeBridgeApprovedSnapshotPostures = new Set([
  "governance_hardened",
  "metadata_only_enforced",
  "runtime_execution_prohibited",
  "deterministic_compliance_verified",
  "advisory_runtime_separation_verified",
  "future_runtime_review_required",
]);

const runtimeBridgeApprovedSnapshotIntegrityValues = new Set([
  "verified",
  "review_required",
]);

const runtimeBridgeApprovedSnapshotSupportIds = new Set([
  "runtime-bridge-capability-posture",
  "runtime-bridge-compliance-posture-summary",
  "runtime-bridge-deterministic-posture-summary",
  "runtime-bridge-execution-boundary-posture",
  "runtime-bridge-execution-boundary-snapshot-summary",
  "runtime-bridge-governance-enforcement-posture",
  "runtime-bridge-governance-registry-posture",
  "runtime-bridge-governance-snapshot",
  "runtime-bridge-governance-snapshot-summary",
  "runtime-bridge-integrity-posture-summary",
  "runtime-bridge-metadata-only-compliance-posture",
  "runtime-bridge-readiness-posture-summary",
  "runtime-bridge-registry-layer-validation",
  "runtime-bridge-runtime-eligibility-posture",
  "runtime-bridge-runtime-readiness-posture",
]);

const splitObjectLiteralBlocks = (source) => {
  const blocks = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    }
    if (character !== "}") continue;

    depth -= 1;
    if (depth === 0 && start >= 0) {
      blocks.push(source.slice(start, index + 1));
      start = -1;
    }
  }

  return blocks;
};

const auditRuntimeBridgeCapabilityContracts = async () => {
  const files = await collectFilesFromProjectPaths(["src/features/runtimeBridge/_contracts"]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const approvedLayers = new Set(Object.keys(runtimeBridgeArchitectureLayerOrder));
  const findings = [];

  for (const file of sourceFiles) {
    const capabilityIds = matchAllStrings(file.source, /\bcapabilityId:\s*"([^"]+)"/g);
    for (const capabilityId of capabilityIds) {
      if (/^[a-z0-9:-]+$/.test(capabilityId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-contract-nondeterministic-id",
        file: file.projectPath,
        message: `runtime-bridge-contract-nondeterministic-id: ${file.projectPath} capabilityId "${capabilityId}" is not a deterministic slug`,
      });
    }

    for (const layer of matchAllStrings(file.source, /\blayer:\s*"([^"]+)"/g)) {
      if (approvedLayers.has(layer)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-contract-unapproved-layer",
        file: file.projectPath,
        message: `runtime-bridge-contract-unapproved-layer: ${file.projectPath} declares layer "${layer}"`,
      });
    }

    for (const readinessId of matchAllStrings(file.source, /\breadiness:\s*"([^"]+)"/g)) {
      if (runtimeBridgeApprovedReadinessIds.has(readinessId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-contract-unapproved-readiness",
        file: file.projectPath,
        message: `runtime-bridge-contract-unapproved-readiness: ${file.projectPath} declares readiness "${readinessId}"`,
      });
    }

    for (const boundaryId of matchAllStrings(file.source, /\bexecutionBoundary:\s*"([^"]+)"/g)) {
      if (runtimeBridgeApprovedBoundaryIds.has(boundaryId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-contract-unapproved-boundary",
        file: file.projectPath,
        message: `runtime-bridge-contract-unapproved-boundary: ${file.projectPath} declares boundary "${boundaryId}"`,
      });
    }

    const blocks = splitObjectLiteralBlocks(file.source);
    for (const block of blocks) {
      const capabilityId = (block.match(/\bcapabilityId:\s*"([^"]+)"/) || [])[1];
      if (!capabilityId) continue;

      for (const fieldName of runtimeBridgeForbiddenEligibilityFields) {
        if (!new RegExp(`\\b${fieldName}:\\s*true\\b`).test(block)) continue;

        findings.push({
          severity: "error",
          rule: "runtime-bridge-contract-executable-capability",
          file: file.projectPath,
          message: `runtime-bridge-contract-executable-capability: ${file.projectPath} contract "${capabilityId}" declares ${fieldName}: true`,
        });
      }

      if (/\badvisoryOnly:\s*true\b/.test(block) && /\bruntimeEligible:\s*true\b/.test(block)) {
        findings.push({
          severity: "error",
          rule: "runtime-bridge-contract-advisory-runtime-eligible",
          file: file.projectPath,
          message: `runtime-bridge-contract-advisory-runtime-eligible: ${file.projectPath} contract "${capabilityId}" is advisory-only and runtime eligible`,
        });
      }

      if (/\blayer:\s*"kernel"/.test(block) && /\bruntimeEligible:\s*true\b/.test(block)) {
        findings.push({
          severity: "error",
          rule: "runtime-bridge-contract-kernel-runtime-eligible",
          file: file.projectPath,
          message: `runtime-bridge-contract-kernel-runtime-eligible: ${file.projectPath} contract "${capabilityId}" makes kernel runtime eligible`,
        });
      }

      if (/\bexecutionBoundary:\s*"(?!metadata_boundary")/.test(block)) {
        findings.push({
          severity: "error",
          rule: "runtime-bridge-contract-boundary-conflict",
          file: file.projectPath,
          message: `runtime-bridge-contract-boundary-conflict: ${file.projectPath} contract "${capabilityId}" does not use metadata_boundary`,
        });
      }

      if (/\bmetadataOnly:\s*false\b/.test(block) || /\bdeterministicOnly:\s*false\b/.test(block)) {
        findings.push({
          severity: "error",
          rule: "runtime-bridge-contract-not-metadata-only",
          file: file.projectPath,
          message: `runtime-bridge-contract-not-metadata-only: ${file.projectPath} contract "${capabilityId}" is not deterministic metadata only`,
        });
      }
    }
  }

  return findings;
};

const auditRuntimeBridgeGovernanceSnapshots = async () => {
  const files = await collectFilesFromProjectPaths(["src/features/runtimeBridge/_snapshots"]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    const snapshotIds = [
      ...matchAllStrings(file.source, /\bsnapshotId:\s*"([^"]+)"/g),
      ...matchAllStrings(file.source, /\bsummaryId:\s*"([^"]+)"/g),
      ...matchAllStrings(file.source, /\bpostureId:\s*"([^"]+)"/g),
    ];

    for (const snapshotId of snapshotIds) {
      if (/^[a-z0-9:_-]+$/.test(snapshotId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-nondeterministic-id",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-nondeterministic-id: ${file.projectPath} id "${snapshotId}" is not a deterministic slug`,
      });
    }

    for (const postureId of matchAllStrings(file.source, /\bpostureId:\s*"([^"]+)"/g)) {
      if (runtimeBridgeApprovedSnapshotPostures.has(postureId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-invalid-posture",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-invalid-posture: ${file.projectPath} declares posture "${postureId}"`,
      });
    }

    for (const posture of matchAllStrings(file.source, /\barchitecturePostures:\s*\[([\s\S]*?)\]/g)
      .flatMap((block) => matchAllStrings(block, /"([^"]+)"/g))) {
      if (runtimeBridgeApprovedSnapshotPostures.has(posture)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-invalid-posture",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-invalid-posture: ${file.projectPath} declares architecture posture "${posture}"`,
      });
    }

    for (const integrity of matchAllStrings(file.source, /\bintegrity:\s*"([^"]+)"/g)) {
      if (runtimeBridgeApprovedSnapshotIntegrityValues.has(integrity)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-invalid-integrity",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-invalid-integrity: ${file.projectPath} declares integrity "${integrity}"`,
      });
    }

    for (const posture of matchAllStrings(file.source, /\bposture:\s*"([^"]+)"/g)) {
      if (runtimeBridgeApprovedSnapshotIntegrityValues.has(posture)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-invalid-posture",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-invalid-posture: ${file.projectPath} declares compliance posture "${posture}"`,
      });
    }

    const supportBlocks = [
      ...matchAllStrings(file.source, /\bsupportedBy:\s*\[([\s\S]*?)\]/g),
      ...matchAllStrings(file.source, /\bsupportingIds:\s*\[([\s\S]*?)\]/g),
    ];
    for (const supportId of supportBlocks.flatMap((block) => matchAllStrings(block, /"([^"]+)"/g))) {
      if (runtimeBridgeApprovedSnapshotSupportIds.has(supportId)) continue;

      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-unsupported-claim",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-unsupported-claim: ${file.projectPath} references unsupported snapshot support id "${supportId}"`,
      });
    }

    const blocks = splitObjectLiteralBlocks(file.source);
    for (const block of blocks) {
      const snapshotId = (block.match(/\b(?:snapshotId|summaryId|postureId):\s*"([^"]+)"/) || [])[1];
      if (!snapshotId) continue;

      for (const fieldName of runtimeBridgeForbiddenEligibilityFields) {
        if (!new RegExp(`\\b${fieldName}:\\s*true\\b`).test(block)) continue;

        findings.push({
          severity: "error",
          rule: "runtime-bridge-snapshot-executable-declaration",
          file: file.projectPath,
          message: `runtime-bridge-snapshot-executable-declaration: ${file.projectPath} snapshot "${snapshotId}" declares ${fieldName}: true`,
        });
      }

      if (/\bmetadataOnly:\s*false\b/.test(block)) {
        findings.push({
          severity: "error",
          rule: "runtime-bridge-snapshot-not-metadata-only",
          file: file.projectPath,
          message: `runtime-bridge-snapshot-not-metadata-only: ${file.projectPath} snapshot "${snapshotId}" declares metadataOnly false`,
        });
      }
    }

    if (/\bexecutionBoundaryPosture:\s*"verified"/.test(file.source) && /\bnonMetadataBoundaryCount\s*!==?\s*0\b/.test(file.source)) {
      findings.push({
        severity: "error",
        rule: "runtime-bridge-snapshot-runtime-contradiction",
        file: file.projectPath,
        message: `runtime-bridge-snapshot-runtime-contradiction: ${file.projectPath} verifies execution boundary posture while checking for non-metadata boundaries`,
      });
    }
  }

  return findings;
};

const auditAdvisoryImports = async () => {
  const files = await collectFilesFromProjectPaths(advisoryFeatureFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      if (importEntry.isTypeOnly) continue;

      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);
      const matchedTarget = executableImportTargets.find((target) =>
        matchesTarget(resolvedTarget, target),
      );

      if (!matchedTarget) continue;

      const isHardFailTarget = advisoryHardFailImportTargets.some((target) =>
        matchesTarget(resolvedTarget, target),
      );
      const finding = createFinding({
        severity: isHardFailTarget ? "error" : "warn",
        rule: isHardFailTarget
          ? "advisory-import-backend-execution"
          : "advisory-import-executable",
        file: file.projectPath,
        importTarget: matchedTarget,
        specifier: importEntry.specifier,
        detail: `matches ${matchedTarget}`,
      });
      if (finding) findings.push(finding);
    }
  }

  return findings;
};

const auditRuntimeMetadataImports = async () => {
  const files = await collectFilesFromProjectPaths(runtimeMetadataFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);
    const isBridgeFile = isRuntimeBridgeFile(file.projectPath);

    for (const importEntry of imports) {
      if (importEntry.isTypeOnly) continue;

      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);

      if (isBridgeFile) {
        const reactTarget = runtimeMetadataForbiddenImports.react.find((target) =>
          matchesTarget(resolvedTarget, target),
        );
        const chartRenderingTarget = runtimeMetadataForbiddenImports.chartRendering.find((target) =>
          matchesTarget(resolvedTarget, target),
        );
        const backendTarget = runtimeMetadataForbiddenImports.backend.find((target) =>
          matchesTarget(resolvedTarget, target),
        );
        const persistenceTarget = runtimeMetadataForbiddenImports.persistence.find((target) =>
          matchesTarget(resolvedTarget, target),
        );
        const executionTarget = runtimeMetadataForbiddenImports.execution.find((target) =>
          matchesTarget(resolvedTarget, target),
        );

        if (reactTarget) {
          const finding = createRuntimeBridgeImportFinding({
            file,
            importEntry,
            resolvedTarget,
            target: reactTarget,
            rule: "runtime-bridge-import-react",
          });
          if (finding) findings.push(finding);
        }

        if (chartRenderingTarget) {
          const finding = createRuntimeBridgeImportFinding({
            file,
            importEntry,
            resolvedTarget,
            target: chartRenderingTarget,
            rule: "runtime-bridge-import-chart-rendering",
          });
          if (finding) findings.push(finding);
        }

        if (backendTarget) {
          const finding = createRuntimeBridgeImportFinding({
            file,
            importEntry,
            resolvedTarget,
            target: backendTarget,
            rule: "runtime-bridge-import-backend",
          });
          if (finding) findings.push(finding);
        }

        if (persistenceTarget) {
          const finding = createRuntimeBridgeImportFinding({
            file,
            importEntry,
            resolvedTarget,
            target: persistenceTarget,
            rule: "runtime-bridge-import-persistence",
          });
          if (finding) findings.push(finding);
        }

        if (executionTarget) {
          const finding = createRuntimeBridgeImportFinding({
            file,
            importEntry,
            resolvedTarget,
            target: executionTarget,
            rule: "runtime-bridge-import-execution",
          });
          if (finding) findings.push(finding);
        }

        continue;
      }

      if (runtimeMetadataForbiddenImports.react.some((target) => matchesTarget(resolvedTarget, target))) {
        const finding = createFinding({
          severity: "error",
          rule: "metadata-only-import-react-hook",
          file: file.projectPath,
          importTarget: "react",
          specifier: importEntry.specifier,
          detail: "runtime metadata should stay metadata-only",
        });
        if (finding) findings.push(finding);
        continue;
      }

      const persistenceTarget = runtimeMetadataForbiddenImports.persistence.find((target) =>
        matchesTarget(resolvedTarget, target),
      );
      const executionTarget = runtimeMetadataForbiddenImports.execution.find((target) =>
        matchesTarget(resolvedTarget, target),
      );

      if (persistenceTarget) {
        const finding = createFinding({
          severity: "error",
          rule: "metadata-only-import-persistence",
          file: file.projectPath,
          importTarget: persistenceTarget,
          specifier: importEntry.specifier,
          detail: `matches ${persistenceTarget}`,
        });
        if (finding) findings.push(finding);
      }

      if (executionTarget) {
        const finding = createFinding({
          severity: "error",
          rule: "metadata-only-import-execution",
          file: file.projectPath,
          importTarget: executionTarget,
          specifier: importEntry.specifier,
          detail: `matches ${executionTarget}`,
        });
        if (finding) findings.push(finding);
      }
    }

    if (!isBridgeFile) continue;

    for (const usagePattern of runtimeBridgeUsagePatterns) {
      if (!usagePattern.patterns.some((pattern) => pattern.test(file.source))) continue;

      const finding = createFinding({
        severity: "error",
        rule: usagePattern.rule,
        file: file.projectPath,
        importTarget: usagePattern.importTarget,
        detail: `uses ${usagePattern.importTarget}`,
      });
      if (finding) findings.push(finding);
    }
  }

  return findings;
};

const auditRuntimeBridgeConsumers = async () => {
  const files = await collectFilesFromProjectPaths(runtimeBridgeConsumerFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    if (file.projectPath.endsWith(".tsx") || file.projectPath.endsWith(".jsx")) {
      findings.push({
        severity: "error",
        rule: "runtime-bridge-consumer-jsx-file",
        file: file.projectPath,
        message: `runtime-bridge-consumer-jsx-file: ${file.projectPath} must be pure TypeScript, not JSX/TSX`,
      });
    }

    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);

      if (matchesTarget(resolvedTarget, "src/features/runtimeBridge") && !importEntry.isTypeOnly) {
        const finding = createFinding({
          severity: "error",
          rule: "runtime-bridge-consumer-runtime-bridge-value-import",
          file: file.projectPath,
          importTarget: "src/features/runtimeBridge",
          specifier: importEntry.specifier,
          detail: "Runtime Bridge imports must be type-only inside consumers",
        });
        if (finding) findings.push(finding);
        continue;
      }

      if (importEntry.isTypeOnly) continue;

      for (const [category, targets] of Object.entries(runtimeBridgeConsumerForbiddenImports)) {
        const matchedTarget = targets.find((target) => matchesTarget(resolvedTarget, target));
        if (!matchedTarget) continue;

        const finding = createFinding({
          severity: "error",
          rule: `runtime-bridge-consumer-import-${category}`,
          file: file.projectPath,
          importTarget: matchedTarget,
          specifier: importEntry.specifier,
          detail: `matches ${matchedTarget}`,
        });
        if (finding) findings.push(finding);
      }
    }

    for (const usagePattern of runtimeBridgeConsumerUsagePatterns) {
      if (!usagePattern.patterns.some((pattern) => pattern.test(file.source))) continue;

      const finding = createFinding({
        severity: "error",
        rule: usagePattern.rule,
        file: file.projectPath,
        importTarget: usagePattern.importTarget,
        detail: `uses ${usagePattern.importTarget}`,
      });
      if (finding) findings.push(finding);
    }

    if (/\bkind:\s*"(?!consumer-readonly")/.test(file.source)) {
      findings.push({
        severity: "error",
        rule: "runtime-bridge-consumer-invalid-kind",
        file: file.projectPath,
        message: `runtime-bridge-consumer-invalid-kind: ${file.projectPath} declares a non consumer-readonly kind`,
      });
    }
  }

  return findings;
};

const auditNavigationSkeleton = async () => {
  const files = await collectFilesFromProjectPaths(navigationFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    if (file.projectPath.endsWith(".tsx") || file.projectPath.endsWith(".jsx")) {
      findings.push({
        severity: "error",
        rule: "navigation-jsx-file",
        file: file.projectPath,
        message: `navigation-jsx-file: ${file.projectPath} must remain a non-rendering TypeScript skeleton`,
      });
    }

    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);

      for (const [category, targets] of Object.entries(navigationForbiddenImports)) {
        const matchedTarget = targets.find((target) => matchesTarget(resolvedTarget, target));
        if (!matchedTarget) continue;

        const finding = createFinding({
          severity: "error",
          rule: `navigation-import-${category}`,
          file: file.projectPath,
          importTarget: matchedTarget,
          specifier: importEntry.specifier,
          detail: `matches ${matchedTarget}`,
        });
        if (finding) findings.push(finding);
      }
    }

    for (const usagePattern of runtimeBridgeConsumerUsagePatterns) {
      if (!usagePattern.patterns.some((pattern) => pattern.test(file.source))) continue;

      const finding = createFinding({
        severity: "error",
        rule: usagePattern.rule.replace("runtime-bridge-consumer", "navigation"),
        file: file.projectPath,
        importTarget: usagePattern.importTarget,
        detail: `uses ${usagePattern.importTarget}`,
      });
      if (finding) findings.push(finding);
    }

    const routeIds = matchAllStrings(file.source, /\brouteId:\s*"([^"]+)"/g);
    for (const routeId of routeIds) {
      if (/^[a-z0-9:-]+$/.test(routeId)) continue;

      findings.push({
        severity: "error",
        rule: "navigation-nondeterministic-route-id",
        file: file.projectPath,
        message: `navigation-nondeterministic-route-id: ${file.projectPath} routeId "${routeId}" is not a deterministic slug`,
      });
    }

    for (const depth of matchAllStrings(file.source, /\bdepth:\s*(\d+)/g)) {
      const parsedDepth = Number(depth);
      if (parsedDepth >= 1 && parsedDepth <= 4) continue;

      findings.push({
        severity: "error",
        rule: "navigation-route-depth-exceeded",
        file: file.projectPath,
        message: `navigation-route-depth-exceeded: ${file.projectPath} declares route depth ${depth}`,
      });
    }
  }

  return findings;
};

const auditRouteGovernanceStabilization = async () => {
  const [
    routeRegistry,
    preservationRegistry,
    integrityRegistry,
    routedActivations,
    routeGovernanceSnapshot,
  ] = await Promise.all([
    readProjectSourceFile("src/features/navigation/routeRegistry.ts"),
    readProjectSourceFile("src/features/navigation/preservationRegistry.ts"),
    readProjectSourceFile("src/features/navigation/navigationIntegrityRegistry.ts"),
    readProjectSourceFile("src/features/navigation/routedDetailActivation.ts"),
    readProjectSourceFile("src/features/navigation/routeGovernanceSnapshot.ts"),
  ]);
  const findings = [];

  if (!/navigationRouteRegistryVersion\s*=\s*"s5-3[cd]-/.test(routeRegistry.source)) {
    findings.push({
      severity: "error",
      rule: "route-governance-stale-route-registry-version",
      file: routeRegistry.projectPath,
      message: `route-governance-stale-route-registry-version: ${routeRegistry.projectPath} must reflect the active S5-3 routed governance state`,
    });
  }

  const patternPreviewBlock = splitObjectLiteralBlocks(routeRegistry.source).find((block) =>
    block.includes('routeId: "detail:pattern-preview"'),
  );
  if (!patternPreviewBlock?.includes('routeTemplate: "pattern_template"')) {
    findings.push({
      severity: "error",
      rule: "route-governance-pattern-route-untagged",
      file: routeRegistry.projectPath,
      message: `route-governance-pattern-route-untagged: ${routeRegistry.projectPath} must tag detail:pattern-preview as a pattern template`,
    });
  }

  if (/\bunsupportedActivationCount:\s*[1-9]\d*\b/.test(routeGovernanceSnapshot.source)) {
    findings.push({
      severity: "error",
      rule: "route-governance-unsupported-active-state",
      file: routeGovernanceSnapshot.projectPath,
      message: `route-governance-unsupported-active-state: ${routeGovernanceSnapshot.projectPath} must not declare unsupported active route states`,
    });
  }

  if (/\bworkspaceRoutingActive:\s*true\b|\bglobalRoutingMigrationActive:\s*true\b/.test(routeGovernanceSnapshot.source)) {
    findings.push({
      severity: "error",
      rule: "route-governance-global-routing-active",
      file: routeGovernanceSnapshot.projectPath,
      message: `route-governance-global-routing-active: ${routeGovernanceSnapshot.projectPath} must keep workspace/global routing inactive`,
    });
  }

  if (/\bdeepLinkReady\b/.test(routedActivations.source)) {
    findings.push({
      severity: "error",
      rule: "route-governance-misleading-deeplink-readiness",
      file: routedActivations.projectPath,
      message: `route-governance-misleading-deeplink-readiness: ${routedActivations.projectPath} must not imply full deep-link restoration readiness`,
    });
  }

  const activationBlocks = splitObjectLiteralBlocks(routedActivations.source).filter((block) =>
    /\bactivationId:\s*"[^"]+"/.test(block),
  );
  const routeSource = routeRegistry.source;
  const preservationSource = preservationRegistry.source;
  const integritySource = integrityRegistry.source;

  for (const block of activationBlocks) {
    const activationId = (block.match(/\bactivationId:\s*"([^"]+)"/) || [])[1];
    const routeId = (block.match(/\brouteId:\s*"([^"]+)"/) || [])[1];
    const sourceRouteId = (block.match(/\bsourceRouteId:\s*"([^"]+)"/) || [])[1];
    const preservationId = (block.match(/\bpreservationId:\s*"([^"]+)"/) || [])[1];
    const assertionIds = matchAllStrings(block, /"((?:assert:)[^"]+)"/g);

    if (!activationId || !routeId || !sourceRouteId || !preservationId || assertionIds.length === 0) {
      findings.push({
        severity: "error",
        rule: "route-governance-activation-incomplete-linkage",
        file: routedActivations.projectPath,
        message: `route-governance-activation-incomplete-linkage: ${routedActivations.projectPath} activation "${activationId || "unknown"}" is missing route, source, preservation, or integrity linkage`,
      });
      continue;
    }

    if (!routeSource.includes(`routeId: "${routeId}"`) || !routeSource.includes(`routeId: "${sourceRouteId}"`)) {
      findings.push({
        severity: "error",
        rule: "route-governance-activation-missing-route-linkage",
        file: routedActivations.projectPath,
        message: `route-governance-activation-missing-route-linkage: ${activationId} references an unregistered route`,
      });
    }

    if (
      !preservationSource.includes(`preservationId: "${preservationId}"`) ||
      !preservationSource.includes(`sourceRouteId: "${sourceRouteId}"`) ||
      !preservationSource.includes(`targetRouteId: "${routeId}"`)
    ) {
      findings.push({
        severity: "error",
        rule: "route-governance-activation-missing-preservation-linkage",
        file: routedActivations.projectPath,
        message: `route-governance-activation-missing-preservation-linkage: ${activationId} is not linked to matching preservation metadata`,
      });
    }

    for (const assertionId of assertionIds) {
      const assertionParts = assertionId.split(":");
      const assertionPrefix = assertionParts.slice(0, 2).join(":");
      const assertionSuffix = assertionParts.slice(2).join(":");
      if (integritySource.includes(assertionPrefix) && integritySource.includes(`:${assertionSuffix}`)) continue;

      findings.push({
        severity: "error",
        rule: "route-governance-activation-missing-integrity-linkage",
        file: routedActivations.projectPath,
        message: `route-governance-activation-missing-integrity-linkage: ${activationId} references missing assertion "${assertionId}"`,
      });
    }

    if (!block.includes("hashRouteAddressable: true") || !block.includes('restorationCapability: "hash_addressable_only"')) {
      findings.push({
        severity: "error",
        rule: "route-governance-activation-restoration-overstated",
        file: routedActivations.projectPath,
        message: `route-governance-activation-restoration-overstated: ${activationId} must declare hash-addressable-only restoration semantics`,
      });
    }
  }

  return findings;
};

const auditWorkspaceGovernanceStabilization = async () => {
  const [snapshot, report] = await Promise.all([
    readProjectSourceFile("src/features/workspaces/workspaceGovernanceSnapshot.ts"),
    readProjectSourceFile("src/features/workspaces/workspaceGovernanceReport.ts"),
  ]);
  const findings = [];

  if (
    /\bworkspaceRoutingActive:\s*true\b|\bworkspaceOrchestrationActive:\s*true\b|\bworkspacePersistenceActive:\s*true\b|\bworkspaceUiActive:\s*true\b/.test(
      snapshot.source,
    )
  ) {
    findings.push({
      severity: "error",
      rule: "workspace-governance-unexpected-active-state",
      file: snapshot.projectPath,
      message: `workspace-governance-unexpected-active-state: ${snapshot.projectPath} must keep routing, orchestration, persistence, and UI inactive`,
    });
  }

  if (!/\bunsupportedStateCount\s*=\s*workspaceGovernanceReport\.unsupportedSummaries\.length\b/.test(snapshot.source)) {
    findings.push({
      severity: "error",
      rule: "workspace-governance-snapshot-unsupported-state-untracked",
      file: snapshot.projectPath,
      message: `workspace-governance-snapshot-unsupported-state-untracked: ${snapshot.projectPath} must derive unsupported state count from the governance report`,
    });
  }

  if (!/\bunsupportedActivationCandidateCount\b/.test(report.source)) {
    findings.push({
      severity: "error",
      rule: "workspace-governance-report-missing-activation-drift-check",
      file: report.projectPath,
      message: `workspace-governance-report-missing-activation-drift-check: ${report.projectPath} must report unsupported activation candidates`,
    });
  }

  return findings;
};

const auditControlledHashNavigationPreparation = async () => {
  const files = await collectFilesFromProjectPaths(["src"]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const allowedFiles = new Set(controlledHashNavigationAllowedFiles);
  const findings = [];
  const hashMutationPattern = /\bglobalThis\.history\.|\baddEventListener\s*\(\s*"hashchange"|\baddEventListener\s*\(\s*"popstate"/;

  for (const file of sourceFiles) {
    if (!hashMutationPattern.test(file.source)) continue;
    if (allowedFiles.has(file.projectPath)) continue;

    findings.push({
      severity: "error",
      rule: "controlled-hash-navigation-unapproved-surface",
      file: file.projectPath,
      message: `controlled-hash-navigation-unapproved-surface: ${file.projectPath} uses controlled hash navigation outside the S6-A allowlist`,
    });
  }

  return findings;
};

const auditControlledHashDetailHelperIntegrity = async () => {
  const [helper, routedActivations, activationIntegrityRegistry, routeGovernanceReport] = await Promise.all([
    readProjectSourceFile("src/features/navigation/controlledHashDetailHelper.ts"),
    readProjectSourceFile("src/features/navigation/routedDetailActivation.ts"),
    readProjectSourceFile("src/features/navigation/routeActivationIntegrityRegistry.ts"),
    readProjectSourceFile("src/features/navigation/routeGovernanceReport.ts"),
  ]);
  const findings = [];
  const approvedRouteIds = [
    "detail:results-insight",
    "detail:dataset-intelligence",
  ];
  const approvedActivationIds = [
    "activate:results-insight-detail",
    "activate:dataset-intelligence-detail",
  ];

  for (const routeId of approvedRouteIds) {
    if (routedActivations.source.includes(`routeId: "${routeId}"`)) continue;

    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-approved-route-missing",
      file: routedActivations.projectPath,
      message: `controlled-hash-helper-approved-route-missing: ${routedActivations.projectPath} must include approved route "${routeId}"`,
    });
  }

  for (const activationId of approvedActivationIds) {
    if (routedActivations.source.includes(`activationId: "${activationId}"`)) continue;

    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-approved-activation-missing",
      file: routedActivations.projectPath,
      message: `controlled-hash-helper-approved-activation-missing: ${routedActivations.projectPath} must include approved activation "${activationId}"`,
    });
  }

  const activationBlocks = splitObjectLiteralBlocks(routedActivations.source).filter((block) =>
    /\bactivationId:\s*"[^"]+"/.test(block),
  );
  if (activationBlocks.length !== approvedActivationIds.length) {
    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-unapproved-activation-count",
      file: routedActivations.projectPath,
      message: `controlled-hash-helper-unapproved-activation-count: ${routedActivations.projectPath} must only contain the two currently approved controlled detail activations`,
    });
  }

  for (const block of activationBlocks) {
    const routeId = (block.match(/\brouteId:\s*"([^"]+)"/) || [])[1];
    const activationId = (block.match(/\bactivationId:\s*"([^"]+)"/) || [])[1];
    if (approvedRouteIds.includes(routeId) && approvedActivationIds.includes(activationId)) continue;

    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-unapproved-route",
      file: routedActivations.projectPath,
      message: `controlled-hash-helper-unapproved-route: ${activationId || "unknown"} / ${routeId || "unknown"} is not approved for controlled hash detail navigation`,
    });
  }

  const requiredHelperGuards = [
    "routeActivationIntegrityRegistry",
    "entry.issues.length === 0",
    'entry.activation.activationMode === "controlled-hash-route"',
    "entry.activation.hashRouteAddressable",
    'entry.activation.restorationCapability === "hash_addressable_only"',
    "controlledRouteIds.has(currentRoute)",
    'reason: "unsupported-route"',
    "controlledHashDetailHelperIntegritySummary",
    "rejectsUnknownRoutes: true",
    "requiresRouteActivationIntegrity: true",
    "globalRoutingController: false",
    "workspaceRoutingActive: false",
  ];

  for (const guard of requiredHelperGuards) {
    if (helper.source.includes(guard)) continue;

    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-missing-integrity-guard",
      file: helper.projectPath,
      message: `controlled-hash-helper-missing-integrity-guard: ${helper.projectPath} must include guard "${guard}"`,
    });
  }

  if (!activationIntegrityRegistry.source.includes("checkRouteActivationIntegrity")) {
    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-missing-activation-integrity-registry",
      file: activationIntegrityRegistry.projectPath,
      message: `controlled-hash-helper-missing-activation-integrity-registry: ${activationIntegrityRegistry.projectPath} must derive entries from route activation checks`,
    });
  }

  if (!routeGovernanceReport.source.includes("unsupportedActivationCount")) {
    findings.push({
      severity: "error",
      rule: "controlled-hash-helper-missing-unsupported-route-reporting",
      file: routeGovernanceReport.projectPath,
      message: `controlled-hash-helper-missing-unsupported-route-reporting: ${routeGovernanceReport.projectPath} must report unsupported active route states`,
    });
  }

  return findings;
};

const auditInvestigationWorkspaceBoundary = async () => {
  const renderingFiles = await collectFilesFromProjectPaths(investigationWorkspaceRenderingFiles);
  const sourceFiles = await Promise.all(renderingFiles.map(readSourceFile));
  const ownershipFiles = await collectFilesFromProjectPaths(investigationWorkspaceOwnershipFiles);
  const ownershipSourceFiles = await Promise.all(ownershipFiles.map(readSourceFile));
  const allWorkspaceFiles = await Promise.all(
    (await collectFilesFromProjectPaths(["src/features/investigationWorkspace"])).map(readSourceFile),
  );
  const resultsInvestigationSurface = await readProjectSourceFile(
    "src/components/results/ResultsInvestigationSurface.tsx",
  );
  const readme = await readFile(
    path.join(frontendRoot, "src/features/investigationWorkspace/README.md"),
    "utf8",
  ).catch(() => "");
  const findings = [];

  const requiredReadmePhrases = [
    "local-state-only",
    "non-routed",
    "presentation-only",
    "no persistence",
    "no execution",
    "no orchestration",
    "no App.tsx ownership migration",
    "Results ownership remains external",
    "consumer/presentation surface only",
    "no result lifecycle ownership",
  ];

  for (const phrase of requiredReadmePhrases) {
    if (readme.includes(phrase)) continue;

    findings.push({
      severity: "error",
      rule: "investigation-workspace-boundary-readme-incomplete",
      file: "src/features/investigationWorkspace/README.md",
      message: `investigation-workspace-boundary-readme-incomplete: README must document "${phrase}"`,
    });
  }

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);

      for (const [category, targets] of Object.entries(investigationWorkspaceRenderingForbiddenImports)) {
        const matchedTarget = targets.find((target) => matchesTarget(resolvedTarget, target));
        if (!matchedTarget) continue;

        const finding = createFinding({
          severity: "error",
          rule: `investigation-workspace-rendering-import-${category}`,
          file: file.projectPath,
          importTarget: matchedTarget,
          specifier: importEntry.specifier,
          detail: `matches ${matchedTarget}`,
        });
        if (finding) findings.push(finding);
      }
    }

    for (const usagePattern of investigationWorkspaceRenderingUsagePatterns) {
      if (!usagePattern.patterns.some((pattern) => pattern.test(file.source))) continue;

      const finding = createFinding({
        severity: "error",
        rule: usagePattern.rule,
        file: file.projectPath,
        importTarget: usagePattern.importTarget,
        detail: `uses ${usagePattern.importTarget}`,
      });
      if (finding) findings.push(finding);
    }
  }

  for (const file of ownershipSourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);

      for (const [category, targets] of Object.entries(investigationWorkspaceOwnershipForbiddenImports)) {
        const matchedTarget = targets.find((target) => matchesTarget(resolvedTarget, target));
        if (!matchedTarget) continue;

        const finding = createFinding({
          severity: "error",
          rule: `investigation-workspace-ownership-import-${category}`,
          file: file.projectPath,
          importTarget: matchedTarget,
          specifier: importEntry.specifier,
          detail: `matches ${matchedTarget}`,
        });
        if (finding) findings.push(finding);
      }
    }
  }

  const resultsOwnerIntegrationGuards = [
    {
      guard: "activeResultModel: ActiveResultModel",
      detail: "Results integration must receive and own the ActiveResultModel",
    },
    {
      guard: "<InvestigationWorkspaceSurface",
      detail: "Results integration must remain the Investigation Workspace mounting owner",
    },
    {
      guard: "resultsContext={{",
      detail: "Results integration must pass a read-only result context",
    },
    {
      guard: "rowCountLabel: resultRowsLabel",
      detail: "Results integration must supply row count presentation metadata",
    },
    {
      guard: "filterSortLabel",
      detail: "Results integration must supply filter/sort presentation metadata",
    },
  ];

  for (const { guard, detail } of resultsOwnerIntegrationGuards) {
    if (resultsInvestigationSurface.source.includes(guard)) continue;

    findings.push({
      severity: "error",
      rule: "investigation-workspace-results-owner-integration-drift",
      file: resultsInvestigationSurface.projectPath,
      message: `investigation-workspace-results-owner-integration-drift: ${detail}`,
    });
  }

  const protectedWorkspacePatterns = [
    {
      rule: "investigation-workspace-controlled-hash-helper-usage",
      detail: "uses controlledHashDetailHelper",
      pattern: /\bcontrolledHashDetailHelper\b/,
    },
    {
      rule: "investigation-workspace-route-activation-usage",
      detail: "uses route activation governance",
      pattern: /\brouteActivation|routedDetailActivation|openControlledHashDetailRoute|subscribeControlledHashDetailRoute\b/,
    },
    {
      rule: "investigation-workspace-app-ownership-migration",
      detail: "references App ownership",
      pattern: /\bsrc\/App\b|\.\.\/\.\.\/App\b|\bfrom\s+["'][^"']*App["']/,
    },
  ];

  for (const file of allWorkspaceFiles) {
    for (const protectedPattern of protectedWorkspacePatterns) {
      if (!protectedPattern.pattern.test(file.source)) continue;

      findings.push({
        severity: "error",
        rule: protectedPattern.rule,
        file: file.projectPath,
        message: `${protectedPattern.rule}: ${file.projectPath} ${protectedPattern.detail}`,
      });
    }
  }

  return findings;
};

const auditWorkspaceGovernance = async () => {
  const files = await collectFilesFromProjectPaths(workspaceGovernanceFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    if (file.projectPath.endsWith(".tsx") || file.projectPath.endsWith(".jsx")) {
      findings.push({
        severity: "error",
        rule: "workspace-governance-jsx-file",
        file: file.projectPath,
        message: `workspace-governance-jsx-file: ${file.projectPath} must remain metadata-only TypeScript, not JSX/TSX`,
      });
    }

    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);

      for (const [category, targets] of Object.entries(workspaceGovernanceForbiddenImports)) {
        const matchedTarget = targets.find((target) => matchesTarget(resolvedTarget, target));
        if (!matchedTarget) continue;

        const finding = createFinding({
          severity: "error",
          rule: `workspace-governance-import-${category}`,
          file: file.projectPath,
          importTarget: matchedTarget,
          specifier: importEntry.specifier,
          detail: `matches ${matchedTarget}`,
        });
        if (finding) findings.push(finding);
      }
    }

    for (const usagePattern of runtimeBridgeConsumerUsagePatterns) {
      if (!usagePattern.patterns.some((pattern) => pattern.test(file.source))) continue;

      const finding = createFinding({
        severity: "error",
        rule: usagePattern.rule.replace("runtime-bridge-consumer", "workspace-governance"),
        file: file.projectPath,
        importTarget: usagePattern.importTarget,
        detail: `uses ${usagePattern.importTarget}`,
      });
      if (finding) findings.push(finding);
    }

    const workspaceIds = matchAllStrings(file.source, /\bworkspaceId:\s*"([^"]+)"/g);
    for (const workspaceId of workspaceIds) {
      if (/^[a-z0-9:-]+$/.test(workspaceId)) continue;

      findings.push({
        severity: "error",
        rule: "workspace-governance-nondeterministic-workspace-id",
        file: file.projectPath,
        message: `workspace-governance-nondeterministic-workspace-id: ${file.projectPath} workspaceId "${workspaceId}" is not a deterministic slug`,
      });
    }

    if (/\bactive:\s*true\b/.test(file.source)) {
      findings.push({
        severity: "error",
        rule: "workspace-governance-active-workspace",
        file: file.projectPath,
        message: `workspace-governance-active-workspace: ${file.projectPath} must not activate workspace behavior`,
      });
    }
  }

  return findings;
};

const auditRuntimeBridgeArchitecture = async () => {
  const files = await collectFilesFromProjectPaths(["src/features/runtimeBridge"]);
  const sourceFiles = (await Promise.all(files.map(readSourceFile)))
    .filter((file) => !isRuntimeBridgeIndexFile(file.projectPath))
    .sort((left, right) => left.projectPath.localeCompare(right.projectPath));
  const runtimeBridgeFileSet = new Set(sourceFiles.map((file) => stripExtension(file.projectPath)));
  const findings = [];
  const graph = new Map(sourceFiles.map((file) => [stripExtension(file.projectPath), []]));

  for (const file of sourceFiles) {
    const sourceModule = stripExtension(file.projectPath);
    const sourceLayer = getRuntimeBridgeLayer(file.projectPath);

    if (!sourceLayer) {
      findings.push({
        severity: "error",
        rule: "runtime-bridge-unclassified-module",
        file: file.projectPath,
        message: `runtime-bridge-unclassified-module: ${file.projectPath} is not classified`,
      });
      continue;
    }

    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);
      if (matchesTarget(resolvedTarget, "src/features/navigation")) {
        const finding = createRuntimeBridgeArchitectureFinding({
          rule: "runtime-bridge-import-navigation",
          file: file.projectPath,
          importTarget: resolvedTarget,
          specifier: importEntry.specifier,
          detail: "Runtime Bridge must stay independent from navigation",
        });
        if (finding) findings.push(finding);
        continue;
      }

      if (!isRuntimeBridgeModuleTarget(resolvedTarget)) continue;

      const targetLayer = getRuntimeBridgeLayer(resolvedTarget);
      if (!targetLayer) {
        const finding = createRuntimeBridgeArchitectureFinding({
          rule: "runtime-bridge-unclassified-import-target",
          file: file.projectPath,
          importTarget: resolvedTarget,
          specifier: importEntry.specifier,
          detail: "target is not classified",
        });
        if (finding) findings.push(finding);
        continue;
      }

      if (runtimeBridgeFileSet.has(resolvedTarget)) {
        graph.get(sourceModule).push(resolvedTarget);
      }

      const sourceRank = getRuntimeBridgeLayerRank(sourceLayer);
      const targetRank = getRuntimeBridgeLayerRank(targetLayer);
      const isSameModule = sourceModule === resolvedTarget;
      const isAllowedKernelImport = sourceLayer !== "kernel" && targetLayer === "kernel";
      const isKernelAllowedFoundationImport =
        sourceLayer === "kernel" && (targetLayer === "kernel" || targetLayer === "foundation");

      if (
        !isSameModule &&
        !isAllowedKernelImport &&
        !isKernelAllowedFoundationImport &&
        sourceRank < targetRank
      ) {
        const rule = runtimeBridgeRuleForLayerViolation(sourceLayer, targetLayer, resolvedTarget);
        const finding = createRuntimeBridgeArchitectureFinding({
          rule,
          file: file.projectPath,
          importTarget: resolvedTarget,
          specifier: importEntry.specifier,
          detail: `${sourceLayer} cannot import ${targetLayer}`,
        });
        if (finding) findings.push(finding);
      }
    }
  }

  const cycle = findRuntimeBridgeCycle(graph);
  if (cycle) {
    const cyclePath = cycle.map((node) => `${node}.ts`).join(" -> ");
    findings.push({
      severity: "error",
      rule: "runtime-bridge-circular-import",
      file: `${cycle[0]}.ts`,
      message: `runtime-bridge-circular-import: ${cyclePath}`,
    });
  }

  return findings;
};

const createFieldPattern = (fieldName) =>
  new RegExp(`(?:\\b${fieldName}\\b|["']${fieldName}["'])\\s*(?:\\?|:)`, "i");

const auditContinuationCallbackFields = async () => {
  const files = await collectFilesFromProjectPaths(continuationMetadataFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    for (const fieldName of continuationCallbackFieldNames) {
      if (!createFieldPattern(fieldName).test(file.source)) continue;
      if (
        isAllowedError({
          rule: "continuation-callback-field",
          file: file.projectPath,
          fieldName,
        })
      ) {
        continue;
      }

      findings.push({
        severity: "error",
        rule: "continuation-callback-field",
        file: file.projectPath,
        message: `continuation-callback-field: ${file.projectPath} contains field "${fieldName}"`,
      });
    }
  }

  return findings;
};

const auditPresentationalImports = async () => {
  const files = await collectFilesFromProjectPaths([...presentationalFolders, ...presentationalFiles]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const findings = [];

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      if (importEntry.isTypeOnly) continue;

      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);
      const matchedTarget = presentationalForbiddenImports.find((target) =>
        matchesTarget(resolvedTarget, target),
      );

      if (!matchedTarget) continue;

      const finding = createFinding({
        severity: "warn",
        rule: "presentational-import-backend-or-executable",
        file: file.projectPath,
        importTarget: matchedTarget,
        specifier: importEntry.specifier,
        detail: `matches ${matchedTarget}`,
      });
      if (finding) findings.push(finding);
    }
  }

  return findings;
};

const runAudit = async () => {
  const findingGroups = await Promise.all([
    auditAdvisoryImports(),
    auditRuntimeMetadataImports(),
    auditRuntimeBridgeArchitecture(),
    auditRuntimeBridgeRegistry(),
    auditRuntimeBridgeCapabilityContracts(),
    auditRuntimeBridgeGovernanceSnapshots(),
    auditRuntimeBridgeConsumers(),
    auditNavigationSkeleton(),
    auditRouteGovernanceStabilization(),
    auditWorkspaceGovernance(),
    auditWorkspaceGovernanceStabilization(),
    auditControlledHashNavigationPreparation(),
    auditControlledHashDetailHelperIntegrity(),
    auditInvestigationWorkspaceBoundary(),
    auditContinuationCallbackFields(),
    auditPresentationalImports(),
  ]);
  const findings = findingGroups.flat();
  const warnings = findings.filter((finding) => finding.severity === "warn");
  const errors = findings.filter((finding) => finding.severity === "error");

  console.log("Governance boundary audit");
  console.log("");
  console.log("WARN:");

  if (warnings.length === 0) {
    console.log("- none");
  } else {
    for (const warning of warnings) {
      console.log(`- ${warning.message}`);
    }
  }

  console.log("");
  console.log("ERROR:");

  if (errors.length === 0) {
    console.log("- none");
  } else {
    for (const error of errors) {
      console.log(`- ${error.message}`);
    }
  }

  console.log("");
  console.log("SUMMARY:");
  console.log(`${warnings.length} warnings, ${errors.length} errors`);

  if (errors.length > 0) {
    process.exitCode = 1;
  }
};

runAudit().catch((error) => {
  console.error("Governance boundary audit could not complete.");
  console.error(error instanceof Error ? error.message : String(error));
  console.log("");
  console.log("SUMMARY:");
  console.log("0 warnings, 0 errors");
});
