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
- `normalizeWorkflowEditorDocument(...)`, `connectWorkflowEditorNodes(...)`, `duplicateWorkflowEditorNode(...)`, and node/edge mutation helpers.
- `validateWorkflowEditorConnection(...)`, `detectWorkflowEditorCycles(...)`, `topologicallySortWorkflowEditorNodes(...)`, and UI adapter helpers.

## Notes

- The package also exposes `@moritzbrantner/workflow-editor/core` and `@moritzbrantner/workflow-editor/react` subpaths.
- The package owns workflow document state and graph validation; `@moritzbrantner/ui` supplies the generic graph surface and inspector controls.

## Enhancement Roadmap

- Undo/redo transaction history for document mutations.
- Clipboard copy/paste for selected nodes and connected subgraphs.
- Selection box and multi-select operations.
- Automatic graph layout helpers.
- Optional cycle prevention for new connections.
- Port cardinality rules for single-input and multi-input ports.
- Typed node template registries with validation.
- Import/export helpers for JSON workflow documents.
- Accessibility coverage for keyboard-only graph editing.
- Demo pages for pipeline, automation, and branching workflow examples.
