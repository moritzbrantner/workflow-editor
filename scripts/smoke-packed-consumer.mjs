import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const tempDir = await mkdtemp(path.join(tmpdir(), "workflow-editor-consumer-"));
const keepTemp = process.env.WORKFLOW_EDITOR_KEEP_SMOKE_TEMP === "1";
const consumerDir = path.join(tempDir, "consumer");

try {
  run("bun", ["pm", "pack", "--destination", tempDir], {
    cwd: rootDir,
  });
  const tarballName = (await readdir(tempDir)).find((entry) => entry.endsWith(".tgz"));
  if (!tarballName) {
    throw new Error(`No package tarball was created in ${tempDir}`);
  }
  const tarballPath = path.join(tempDir, tarballName);

  await mkdir(path.join(consumerDir, "src"), { recursive: true });
  await writeFile(
    path.join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        scripts: {
          build: "vite build",
          "check-types": "tsc --noEmit",
        },
        dependencies: {
          "@tailwindcss/vite": "^4.3.0",
          "@vitejs/plugin-react": "latest",
          "@moritzbrantner/graph-editor": "^0.1.0",
          "@moritzbrantner/workflow-editor": `file:${tarballPath}`,
          "@types/react": "^19.2.2",
          "@types/react-dom": "^19.2.2",
          react: "^19.2.0",
          "react-dom": "^19.2.0",
          typescript: "6.0.3",
          vite: "^8.0.14",
        },
        devDependencies: {},
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(consumerDir, "src/vite-env.d.ts"),
    `/// <reference types="vite/client" />\n\ndeclare module "@moritzbrantner/ui/styles.css";\n`,
  );
  await writeFile(
    path.join(consumerDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
        },
        include: ["src"],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(consumerDir, "index.html"),
    `<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n`,
  );
  await writeFile(
    path.join(consumerDir, "src/main.tsx"),
    `import "@moritzbrantner/ui/styles.css";

import { createRoot } from "react-dom/client";
import {
  WorkflowEditor,
  WorkflowWorkbench,
  applyWorkflowGraphOperation,
  createWorkflowEditorEntry,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  createWorkflowGraphRuntime,
  encodeWorkflowEditorSharePayload,
  layoutWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
  parseWorkflowEditorDocumentFile,
  type WorkflowGraphRuntimeState,
} from "@moritzbrantner/workflow-editor";
import { createGraphEditorRuntime } from "@moritzbrantner/graph-editor/runtime";
import { compileWorkflowEditorDocument } from "@moritzbrantner/workflow-editor/compiler";
import { validateWorkflowEditorDocument } from "@moritzbrantner/workflow-editor/core";
import { WorkflowWorkbenchToolbar } from "@moritzbrantner/workflow-editor/react";
import { WorkflowEditorDocumentMenu } from "@moritzbrantner/workflow-editor/editor";
import { createWorkflowEditorHistory as createHistoryFromSubpath } from "@moritzbrantner/workflow-editor/history";
import { layoutWorkflowEditorDocument as layoutFromSubpath } from "@moritzbrantner/workflow-editor/layout";
import { buildWorkflowEditorDocumentFile } from "@moritzbrantner/workflow-editor/persistence";
import { workflowEditorShareUrl } from "@moritzbrantner/workflow-editor/share";

const workflowDocument = normalizeWorkflowEditorDocument({ nodes: [], edges: [] });
const entry = createWorkflowEditorEntry({ id: "demo", name: "Demo", document: workflowDocument });
const library = createWorkflowEditorLibrary({ documents: [entry], activeDocumentId: "demo" });
const graphRuntime = createGraphEditorRuntime({ initialDocument: workflowDocument });
const workflowGraphRuntime: WorkflowGraphRuntimeState = createWorkflowGraphRuntime({
  initialDocument: workflowDocument,
});

compileWorkflowEditorDocument(workflowDocument);
validateWorkflowEditorDocument(workflowDocument);
layoutWorkflowEditorDocument(workflowDocument);
layoutFromSubpath(workflowDocument);
createWorkflowEditorHistory(workflowDocument);
createHistoryFromSubpath(workflowDocument);
encodeWorkflowEditorSharePayload({ document: workflowDocument });
workflowEditorShareUrl("https://example.test/workflows", "demo");
try {
  parseWorkflowEditorDocumentFile("{}");
} catch {
  // Expected: this smoke only verifies the public parser is importable and callable.
}
buildWorkflowEditorDocumentFile(workflowDocument);
applyWorkflowGraphOperation(workflowGraphRuntime, {
  id: "graph.replace-document",
  label: "No-op replace",
  apply: () => workflowDocument,
});
void graphRuntime;
void WorkflowWorkbench;
void WorkflowWorkbenchToolbar;
void WorkflowEditorDocumentMenu;

function App() {
  return <WorkflowEditor initialLibrary={library} />;
}

createRoot(document.getElementById("root")!).render(<App />);
`,
  );
  await writeFile(
    path.join(consumerDir, "vite.config.ts"),
    `import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
  );

  run("bun", ["install"], { cwd: consumerDir });
  run("bunx", ["tsc", "--noEmit"], { cwd: consumerDir });
  run("bunx", ["vite", "build"], { cwd: consumerDir });

  process.stdout.write("Packed consumer smoke test passed.\n");
} catch (error) {
  process.stderr.write(
    `Packed consumer smoke test failed. If the failure is an install error for @moritzbrantner/graph-editor, publish @moritzbrantner/editor-core and @moritzbrantner/graph-editor before publishing this package.\n`,
  );
  throw error;
} finally {
  if (keepTemp) {
    process.stderr.write(`Kept smoke test temp directory: ${tempDir}\n`);
  } else {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function run(command, args, options) {
  execFileSync(command, args, {
    stdio: "inherit",
    ...options,
  });
}
