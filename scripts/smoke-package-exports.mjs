const modules = [
  {
    path: "../dist/index.js",
    exports: ["WorkflowEditor", "WorkflowWorkbench", "normalizeWorkflowEditorDocument"],
  },
  {
    path: "../dist/core.js",
    exports: ["validateWorkflowEditorDocument", "normalizeWorkflowEditorDocument"],
  },
  {
    path: "../dist/react.js",
    exports: ["WorkflowWorkbench"],
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
  }),
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
