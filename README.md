# @moritzbrantner/workflow-editor

Node graph workflow document utilities and a controlled React workbench for editing workflow graphs.

[Open the example workbench](https://moritzbrantner.github.io/workflow-editor/)

## Install

```sh
bun add @moritzbrantner/workflow-editor
```

The React workbench expects `react` as a peer dependency and consumes
`@moritzbrantner/ui@^0.8.0`.

## Main APIs

- `WorkflowWorkbench` for a React node graph editor built on `@moritzbrantner/ui`.
- `WorkflowEditor` for a browser-first workflow editor shell with document library controls,
  local saving/loading, JSON import/export, explicit versions, and undo/redo.
- `defaultWorkflowEditorNodeTemplates`,
  `workflowEditorControlFlowNodeTemplates`,
  `workflowEditorJsonNodeTemplates`, and
  `workflowEditorCollectionNodeTemplates` for built-in control-flow, JSON value, and
  collection transform nodes.
- `normalizeWorkflowEditorDocument(...)`, `connectWorkflowEditorNodes(...)`, `duplicateWorkflowEditorNode(...)`, and node/edge mutation helpers.
- `createWorkflowEditorComposedNode(...)`, `composeWorkflowEditorNodes(...)`,
  `restoreWorkflowEditorComposedNode(...)`, and `hasWorkflowEditorNodeComposition(...)`
  for reusable component-style nodes backed by embedded subgraphs.
- `updateWorkflowEditorNodeWorkflowReference(...)`,
  `getWorkflowEditorReferencedDocumentIds(...)`, and
  `getWorkflowEditorReferenceDiagnostics(...)` for reference-based nested workflow support.
- `validateWorkflowEditorConnection(...)`, `detectWorkflowEditorCycles(...)`, `topologicallySortWorkflowEditorNodes(...)`, and UI adapter helpers.
- `validateWorkflowEditorDocument(...)`, `assertWorkflowEditorDocument(...)`, and
  `WorkflowEditorDocumentValidationError` for strict document validation diagnostics.
- `createWorkflowEditorLibrary(...)`, `createLocalStorageWorkflowEditorStorage(...)`,
  `buildWorkflowEditorDocumentFile(...)`, and `parseWorkflowEditorDocumentFile(...)`
  for headless persistence.
- `createWorkflowEditorHistory(...)`, `commitWorkflowEditorHistory(...)`,
  `undoWorkflowEditorHistory(...)`, and `redoWorkflowEditorHistory(...)` for
  headless transaction history.
- `encodeWorkflowEditorSharePayload(...)` and `decodeWorkflowEditorSharePayload(...)`
  for dependency-free share tokens.

## Browser-first Editor

```tsx
import "@moritzbrantner/ui/styles.css";

import {
  WorkflowEditor,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor";

const initialLibrary = createWorkflowEditorLibrary({
  documents: [
    createWorkflowEditorEntry({
      id: "demo",
      name: "Demo workflow",
      document: normalizeWorkflowEditorDocument({
        nodes: [],
        edges: [],
      }),
    }),
  ],
  activeDocumentId: "demo",
});

export function App() {
  return (
    <WorkflowEditor
      storageKey="my-product.workflow-editor"
      initialLibrary={initialLibrary}
      nodeTemplates={defaultWorkflowEditorNodeTemplates}
    />
  );
}
```

## Notes

- The package also exposes `@moritzbrantner/workflow-editor/core` and `@moritzbrantner/workflow-editor/react` subpaths.
- Persistence, history, share, and editor shell helpers are also available through
  `@moritzbrantner/workflow-editor/persistence`,
  `@moritzbrantner/workflow-editor/history`,
  `@moritzbrantner/workflow-editor/share`, and
  `@moritzbrantner/workflow-editor/editor`.
- The package owns workflow document state and graph validation; `@moritzbrantner/ui` supplies the generic graph surface and inspector controls.
- `normalizeWorkflowEditorDocument(...)` validates strictly by default and throws
  `WorkflowEditorDocumentValidationError` when nodes, edges, ids, endpoints, or graph
  cycles are invalid. Use `validateWorkflowEditorDocument(...)` to inspect diagnostics
  without throwing.
- To accept older or partially invalid graph data and preserve the previous pruning behavior,
  use repair mode:

  ```ts
  const document = normalizeWorkflowEditorDocument(importedDocument, { mode: "repair" });
  ```

  Repair mode normalizes node coordinates and viewport values, removes dangling/self/cycle-forming
  edges, and syncs built-in object-constructor and object-decomposition nodes.

- Imported workflow JSON files are validated strictly. Malformed workflow documents fail with
  validation diagnostics instead of being silently repaired.
- Workflow ports use serializable TypeScript-like `type` objects instead of port-level
  `kind` strings. `validateWorkflowEditorConnection(...)` accepts an optional
  `typeDefinitions` registry and allows an output to connect to an input when the
  output type is assignable to the input type.
- Nested workflows are reusable document references stored on nodes as
  `workflowRef: { documentId }`. References may point to any document, including
  the current document. The editor shell supports drill-in breadcrumbs with a
  finite `maxNestedWorkflowDepth` guard; graph DAG validation remains scoped to
  edges inside each individual document.
- Composed workflow nodes embed a normalized subgraph on the node as `composition`.
  `composeWorkflowEditorNodes(...)` wraps selected nodes, exposes boundary ports
  for unconnected or externally connected inputs/outputs, and reroutes external
  edges through the wrapper. `restoreWorkflowEditorComposedNode(...)` expands the
  wrapper back into ordinary nodes and edges.

## Enhancement Roadmap

- Clipboard copy/paste for selected nodes and connected subgraphs.
- Selection box and multi-select operations.
- Automatic graph layout helpers.
- Configurable graph validation policies.
- Port cardinality rules for single-input and multi-input ports.
- Typed node template registries with validation.
- Accessibility coverage for keyboard-only graph editing.
- Demo pages for pipeline, automation, and branching workflow examples.
