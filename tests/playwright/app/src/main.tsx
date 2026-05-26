import "@moritzbrantner/ui/styles.css";

import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  WorkflowEditor,
  activeWorkflowEditorEntry,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocumentPathItem,
  type WorkflowEditorDocument,
  type WorkflowEditorLibrary,
  type WorkflowWorkbenchSelection,
} from "@moritzbrantner/workflow-editor";

const initialDocument: WorkflowEditorDocument = normalizeWorkflowEditorDocument({
  nodes: [
    {
      id: "input",
      label: "Input",
      x: 0,
      y: 0,
      category: "Source",
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "transform",
      label: "Transform",
      x: 280,
      y: 0,
      category: "Processor",
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "output",
      label: "Output",
      x: 560,
      y: 0,
      category: "Sink",
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    },
  ],
  edges: [
    {
      id: "input-transform",
      sourceNodeId: "input",
      sourcePortId: "out",
      targetNodeId: "transform",
      targetPortId: "in",
    },
  ],
});

const initialLibrary = createWorkflowEditorLibrary({
  activeDocumentId: "demo-workflow",
  documents: [
    createWorkflowEditorEntry({
      id: "demo-workflow",
      name: "Demo Workflow",
      document: initialDocument,
    }),
  ],
});

const nodeTemplates = [
  {
    id: "decision",
    label: "Decision",
    description: "Route a workflow by condition.",
    category: "Logic",
    inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    outputs: [
      { id: "yes", label: "Yes", type: { kind: "string" } },
      { id: "no", label: "No", type: { kind: "string" } },
    ],
  },
  {
    id: "webhook",
    label: "Webhook",
    description: "Send workflow data to an HTTP endpoint.",
    category: "Integration",
    inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
  },
];

function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const readOnly = searchParams.get("readonly") === "1";
  const maxDepth = Number(searchParams.get("maxDepth") ?? 64);
  const [library, setLibrary] = useState<WorkflowEditorLibrary>(initialLibrary);
  const [selection, setSelection] = useState<WorkflowWorkbenchSelection>(null);
  const [documentPath, setDocumentPath] = useState<WorkflowEditorDocumentPathItem[]>([
    { documentId: "demo-workflow" },
  ]);
  const activeEntry = activeWorkflowEditorEntry(library);
  const document = activeEntry?.document ?? initialDocument;
  const selectedNodeId = selection?.type === "node" ? selection.id : null;
  const selectedEdgeId = selection?.type === "edge" ? selection.id : null;
  const summary = useMemo(
    () => ({
      activeDocumentId: library.activeDocumentId,
      edges: document.edges.map((edge) => edge.id).sort(),
      nodes: document.nodes.map((node) => node.id).sort(),
      selected: selection ? `${selection.type}:${selection.id}` : "none",
      versions: activeEntry?.versions.length ?? 0,
    }),
    [activeEntry?.versions.length, document, library.activeDocumentId, selection],
  );

  return (
    <div role="main" aria-label="Workflow editor Playwright fixture">
      <h1
        style={{
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          height: 1,
          overflow: "hidden",
          position: "absolute",
          whiteSpace: "nowrap",
          width: 1,
        }}
      >
        Workflow editor Playwright fixture
      </h1>
      <WorkflowEditor
        storageKey="workflow-editor-playwright"
        initialLibrary={initialLibrary}
        readOnly={readOnly}
        maxNestedWorkflowDepth={Number.isFinite(maxDepth) ? maxDepth : 64}
        nodeTemplates={nodeTemplates}
        renderNodeTemplate={(template) => (
          <span>
            <strong>{template.label}</strong>
            {template.description ? <span> {template.description}</span> : null}
          </span>
        )}
        onLibraryChange={setLibrary}
        onDocumentPathChange={setDocumentPath}
        onSelectionChange={setSelection}
      />
      <section aria-label="Test state">
        <div data-testid="active-document-name">{activeEntry?.name ?? ""}</div>
        <div data-testid="document-count">{library.documents.length}</div>
        <div data-testid="node-count">{document.nodes.length}</div>
        <div data-testid="edge-count">{document.edges.length}</div>
        <div data-testid="version-count">{activeEntry?.versions.length ?? 0}</div>
        <pre data-testid="summary-json">{JSON.stringify(summary)}</pre>
        <pre data-testid="document-json">{JSON.stringify(document)}</pre>
        <pre data-testid="library-json">{JSON.stringify(library)}</pre>
        <pre data-testid="document-path-json">{JSON.stringify(documentPath)}</pre>
        <pre data-testid="selection-json">{JSON.stringify(selection)}</pre>
        <pre data-testid="selected-node-id">{JSON.stringify(selectedNodeId)}</pre>
        <pre data-testid="selected-edge-id">{JSON.stringify(selectedEdgeId)}</pre>
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
