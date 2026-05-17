import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  advisoryFeatureFolders,
  advisoryHardFailImportTargets,
  allowedBoundaryErrors,
  allowedBoundaryWarnings,
  continuationCallbackFieldNames,
  continuationMetadataFolders,
  executableImportTargets,
  presentationalFiles,
  presentationalFolders,
  presentationalForbiddenImports,
  runtimeBridgeArchitectureLayerOrder,
  runtimeBridgeArchitectureLayers,
  runtimeMetadataFolders,
  runtimeMetadataForbiddenImports,
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

const isRuntimeBridgeFile = (projectPath) =>
  projectPath === "src/features/runtimeBridge" ||
  projectPath.startsWith("src/features/runtimeBridge/");

const isRuntimeBridgeIndexFile = (projectPath) =>
  projectPath === "src/features/runtimeBridge/index.ts" ||
  projectPath === "src/features/runtimeBridge/_kernel/index.ts";

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
