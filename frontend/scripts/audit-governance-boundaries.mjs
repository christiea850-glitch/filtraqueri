import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  advisoryFeatureFolders,
  allowedBoundaryWarnings,
  continuationCallbackFieldNames,
  continuationMetadataFolders,
  executableImportTargets,
  presentationalFiles,
  presentationalFolders,
  presentationalForbiddenImports,
  runtimeIntelligenceFolder,
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

const createImportWarning = ({ rule, file, importTarget, specifier, detail }) => {
  if (isAllowedWarning({ rule, file, importTarget })) return null;

  return {
    rule,
    file,
    message: `${rule}: ${file} imports ${specifier} (${detail})`,
  };
};

const auditAdvisoryImports = async () => {
  const files = await collectFilesFromProjectPaths(advisoryFeatureFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const warnings = [];

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      if (importEntry.isTypeOnly) continue;

      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);
      const matchedTarget = executableImportTargets.find((target) =>
        matchesTarget(resolvedTarget, target),
      );

      if (!matchedTarget) continue;

      const warning = createImportWarning({
        rule: "advisory-import-executable",
        file: file.projectPath,
        importTarget: matchedTarget,
        specifier: importEntry.specifier,
        detail: `matches ${matchedTarget}`,
      });
      if (warning) warnings.push(warning);
    }
  }

  return warnings;
};

const auditRuntimeIntelligenceImports = async () => {
  const files = await collectFilesFromProjectPaths([runtimeIntelligenceFolder]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const warnings = [];

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      if (importEntry.isTypeOnly) continue;

      if (importEntry.specifier === "react") {
        const warning = createImportWarning({
          rule: "metadata-only-import-react-hook",
          file: file.projectPath,
          importTarget: "react",
          specifier: importEntry.specifier,
          detail: "runtimeIntelligence should stay metadata-only",
        });
        if (warning) warnings.push(warning);
        continue;
      }

      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);
      const persistenceTarget = runtimeMetadataForbiddenImports.persistence.find((target) =>
        matchesTarget(resolvedTarget, target),
      );
      const executionTarget = runtimeMetadataForbiddenImports.execution.find((target) =>
        matchesTarget(resolvedTarget, target),
      );

      if (persistenceTarget) {
        const warning = createImportWarning({
          rule: "metadata-only-import-persistence",
          file: file.projectPath,
          importTarget: persistenceTarget,
          specifier: importEntry.specifier,
          detail: `matches ${persistenceTarget}`,
        });
        if (warning) warnings.push(warning);
      }

      if (executionTarget) {
        const warning = createImportWarning({
          rule: "metadata-only-import-execution",
          file: file.projectPath,
          importTarget: executionTarget,
          specifier: importEntry.specifier,
          detail: `matches ${executionTarget}`,
        });
        if (warning) warnings.push(warning);
      }
    }
  }

  return warnings;
};

const createFieldPattern = (fieldName) =>
  new RegExp(`(?:\\b${fieldName}\\b|["']${fieldName}["'])\\s*(?:\\?|:)`, "i");

const auditContinuationCallbackFields = async () => {
  const files = await collectFilesFromProjectPaths(continuationMetadataFolders);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const warnings = [];

  for (const file of sourceFiles) {
    for (const fieldName of continuationCallbackFieldNames) {
      if (!createFieldPattern(fieldName).test(file.source)) continue;
      if (
        isAllowedWarning({
          rule: "continuation-callback-field",
          file: file.projectPath,
          fieldName,
        })
      ) {
        continue;
      }

      warnings.push({
        rule: "continuation-callback-field",
        file: file.projectPath,
        message: `continuation-callback-field: ${file.projectPath} contains field "${fieldName}"`,
      });
    }
  }

  return warnings;
};

const auditPresentationalImports = async () => {
  const files = await collectFilesFromProjectPaths([...presentationalFolders, ...presentationalFiles]);
  const sourceFiles = await Promise.all(files.map(readSourceFile));
  const warnings = [];

  for (const file of sourceFiles) {
    const imports = parseImports(file.source);

    for (const importEntry of imports) {
      if (importEntry.isTypeOnly) continue;

      const resolvedTarget = resolveImportTarget(importEntry.specifier, file.absolutePath);
      const matchedTarget = presentationalForbiddenImports.find((target) =>
        matchesTarget(resolvedTarget, target),
      );

      if (!matchedTarget) continue;

      const warning = createImportWarning({
        rule: "presentational-import-backend-or-executable",
        file: file.projectPath,
        importTarget: matchedTarget,
        specifier: importEntry.specifier,
        detail: `matches ${matchedTarget}`,
      });
      if (warning) warnings.push(warning);
    }
  }

  return warnings;
};

const runAudit = async () => {
  const warningGroups = await Promise.all([
    auditAdvisoryImports(),
    auditRuntimeIntelligenceImports(),
    auditContinuationCallbackFields(),
    auditPresentationalImports(),
  ]);
  const warnings = warningGroups.flat();

  console.log("Governance boundary audit");
  console.log("");
  console.log("Warnings:");

  if (warnings.length === 0) {
    console.log("- none");
  } else {
    for (const warning of warnings) {
      console.log(`- ${warning.message}`);
    }
  }

  console.log("");
  console.log("Summary:");
  console.log(`${warnings.length} warnings, 0 errors`);
};

runAudit().catch((error) => {
  console.error("Governance boundary audit could not complete.");
  console.error(error instanceof Error ? error.message : String(error));
  console.log("");
  console.log("Summary:");
  console.log("0 warnings, 0 errors");
});
