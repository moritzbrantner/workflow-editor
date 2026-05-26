# @moritzbrantner/workflow-editor

Node graph workflow document utilities and a controlled React workbench for editing workflow graphs.

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
- `normalizeWorkflowEditorDocument(...)`, `connectWorkflowEditorNodes(...)`, `duplicateWorkflowEditorNode(...)`, and node/edge mutation helpers.
- `validateWorkflowEditorConnection(...)`, `detectWorkflowEditorCycles(...)`, `topologicallySortWorkflowEditorNodes(...)`, and UI adapter helpers.
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
      nodeTemplates={[
        {
          id: "decision",
          label: "Decision",
          inputs: [{ id: "in", label: "In", kind: "text" }],
          outputs: [{ id: "yes", label: "Yes", kind: "text" }],
        },
      ]}
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

## Enhancement Roadmap

- Clipboard copy/paste for selected nodes and connected subgraphs.
- Selection box and multi-select operations.
- Automatic graph layout helpers.
- Optional cycle prevention for new connections.
- Port cardinality rules for single-input and multi-input ports.
- Typed node template registries with validation.
- Accessibility coverage for keyboard-only graph editing.
- Demo pages for pipeline, automation, and branching workflow examples.
