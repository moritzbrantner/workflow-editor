import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const modules = [
  {
    path: "../dist/index.js",
    exports: [
      "WorkflowEditor",
      "WorkflowWorkbench",
      "normalizeWorkflowEditorDocument",
      "toUiWorkflowBuilderNodes",
    ],
  },
  {
    path: "../dist/core.js",
    exports: ["validateWorkflowEditorDocument", "normalizeWorkflowEditorDocument"],
    absentExports: ["toUiWorkflowBuilderNodes"],
  },
  {
    path: "../dist/compiler.js",
    exports: ["compileWorkflowEditorDocument", "compiledWorkflowFormat"],
  },
  {
    path: "../dist/react.js",
    exports: ["WorkflowWorkbench", "toUiWorkflowBuilderNodes"],
  },
  {
    path: "../dist/editor.js",
    exports: ["WorkflowEditor"],
  },
  {
    path: "../dist/history.js",
    exports: ["createWorkflowEditorHistory"],
  },
  {
    path: "../dist/layout.js",
    exports: ["layoutWorkflowEditorDocument"],
  },
  {
    path: "../dist/persistence.js",
    exports: ["parseWorkflowEditorDocumentFile"],
  },
  {
    path: "../dist/share.js",
    exports: ["encodeWorkflowEditorSharePayload"],
  },
];

const failures = [];

await Promise.all(
  modules.map(async (moduleDefinition) => {
    let loadedModule;

    try {
      loadedModule = await import(new URL(moduleDefinition.path, import.meta.url));
    } catch (error) {
      failures.push(`${moduleDefinition.path}: failed to import (${formatError(error)})`);
      return;
    }

    for (const exportName of moduleDefinition.exports) {
      if (!(exportName in loadedModule)) {
        failures.push(`${moduleDefinition.path}: missing export ${exportName}`);
      }
    }

    for (const exportName of moduleDefinition.absentExports ?? []) {
      if (exportName in loadedModule) {
        failures.push(`${moduleDefinition.path}: unexpected export ${exportName}`);
      }
    }
  }),
);

failures.push(
  ...(
    await Promise.all(
      ["../dist/core.js", "../dist/compiler.js", "../dist/layout.js"].map((entrypoint) =>
        findArchitectureBoundaryFailures(entrypoint),
      ),
    )
  ).flat(),
);

if (failures.length > 0) {
  process.stderr.write(
    `Package export smoke test failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
  );
  process.stderr.write("\n");
  process.exit(1);
}

process.stdout.write("Package export smoke test passed.\n");

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function findArchitectureBoundaryFailures(entrypoint) {
  const bannedReferences = [
    "@moritzbrantner/graph-editor/react",
    "react",
    "react-dom",
    "lucide-react",
    "@moritzbrantner/ui",
  ];
  const files = await collectRelativeModuleFiles(new URL(entrypoint, import.meta.url));
  const architectureFailures = [];

  await Promise.all(
    [...files].map(async (fileUrl) => {
      const content = await readText(fileUrl);

      for (const reference of bannedReferences) {
        if (containsBannedReference(content, reference)) {
          architectureFailures.push(
            `${entrypoint}: ${fileUrl.pathname.split("/").at(-1)} contains ${reference}`,
          );
        }
      }
    }),
  );

  return architectureFailures;
}

async function collectRelativeModuleFiles(entryUrl, seen = new Set()) {
  const key = entryUrl.href;

  if (seen.has(key)) {
    return seen;
  }

  seen.add(key);
  const content = await readText(entryUrl);
  const moduleSpecifierPattern =
    /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["'](\.[^"']+\.js)["']/g;

  await Promise.all(
    [...content.matchAll(moduleSpecifierPattern)].map((match) =>
      collectRelativeModuleFiles(new URL(match[1], entryUrl), seen),
    ),
  );

  return seen;
}

async function readText(fileUrl) {
  return readFile(fileURLToPath(fileUrl), "utf8");
}

function containsBannedReference(content, reference) {
  return reference === "react"
    ? /(?<![A-Za-z0-9_-])react(?![A-Za-z0-9_-])/.test(content)
    : content.includes(reference);
}
