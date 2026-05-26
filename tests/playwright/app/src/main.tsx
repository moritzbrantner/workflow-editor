import "@moritzbrantner/ui/styles.css";

import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  WorkflowWorkbench,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
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
      outputs: [{ id: "out", label: "Out", kind: "text" }],
    },
    {
      id: "transform",
      label: "Transform",
      x: 280,
      y: 0,
      category: "Processor",
      inputs: [{ id: "in", label: "In", kind: "text" }],
      outputs: [{ id: "out", label: "Out", kind: "text" }],
    },
    {
      id: "output",
      label: "Output",
      x: 560,
      y: 0,
      category: "Sink",
      inputs: [{ id: "in", label: "In", kind: "text" }],
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

const nodeTemplates = [
  {
    id: "decision",
    label: "Decision",
    description: "Route a workflow by condition.",
    category: "Logic",
    inputs: [{ id: "in", label: "In", kind: "text" }],
    outputs: [
      { id: "yes", label: "Yes", kind: "text" },
      { id: "no", label: "No", kind: "text" },
    ],
  },
  {
    id: "webhook",
    label: "Webhook",
    description: "Send workflow data to an HTTP endpoint.",
    category: "Integration",
    inputs: [{ id: "in", label: "In", kind: "text" }],
  },
];

function App() {
  const readOnly = new URLSearchParams(window.location.search).get("readonly") === "1";
  const [document, setDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<WorkflowWorkbenchSelection>(null);

  const selectedNodeId = selection?.type === "node" ? selection.id : null;
  const selectedEdgeId = selection?.type === "edge" ? selection.id : null;
  const summary = useMemo(
    () => ({
      edges: document.edges.map((edge) => edge.id).sort(),
      nodes: document.nodes.map((node) => node.id).sort(),
      selected: selection ? `${selection.type}:${selection.id}` : "none",
    }),
    [document, selection],
  );

  return (
    <main>
      <WorkflowWorkbench
        document={document}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        readOnly={readOnly}
        nodeTemplates={nodeTemplates}
        renderNodeTemplate={(template) => (
          <span>
            <strong>{template.label}</strong>
            {template.description ? <span> {template.description}</span> : null}
          </span>
        )}
        onDocumentChange={setDocument}
        onSelectionChange={setSelection}
      />
      <section aria-label="Test state">
        <div data-testid="node-count">{document.nodes.length}</div>
        <div data-testid="edge-count">{document.edges.length}</div>
        <pre data-testid="summary-json">{JSON.stringify(summary)}</pre>
        <pre data-testid="document-json">{JSON.stringify(document)}</pre>
        <pre data-testid="selection-json">{JSON.stringify(selection)}</pre>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
