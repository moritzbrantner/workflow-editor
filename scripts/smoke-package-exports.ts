import ts from "typescript";
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
    path: "../dist/cardinality.js",
    exports: [
      "analyzeWorkflowEditorPortCardinality",
      "connectWorkflowEditorNodesWithCardinality",
      "validateWorkflowEditorConnectionWithCardinality",
    ],
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
      ["../dist/core.js", "../dist/compiler.js", "../dist/cardinality.js", "../dist/layout.js"].map(
        (entrypoint) => findArchitectureBoundaryFailures(entrypoint),
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
            `${entrypoint}: ${new URL(fileUrl).pathname.split("/").at(-1)} imports ${reference}`,
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
  await Promise.all(
    ts
      .preProcessFile(content)
      .importedFiles.map((reference) => reference.fileName)
      .filter((specifier) => specifier.startsWith(".") && specifier.endsWith(".js"))
      .map((specifier) => collectRelativeModuleFiles(new URL(specifier, entryUrl), seen)),
  );

  return seen;
}

async function readText(fileUrl) {
  return readFile(fileURLToPath(fileUrl), "utf8");
}

function containsBannedReference(content, reference) {
  return ts
    .preProcessFile(content)
    .importedFiles.some(
      ({ fileName }) => fileName === reference || fileName.startsWith(`${reference}/`),
    );
}
