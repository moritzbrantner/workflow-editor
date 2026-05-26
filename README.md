# @moritzbrantner/workflow-editor

Node graph workflow document utilities and a controlled React workbench for editing workflow graphs.

## Main APIs

- `WorkflowWorkbench` for a React node graph editor built on `@moritzbrantner/ui`.
- `normalizeWorkflowEditorDocument(...)`, `connectWorkflowEditorNodes(...)`, `duplicateWorkflowEditorNode(...)`, and node/edge mutation helpers.
- `validateWorkflowEditorConnection(...)`, `detectWorkflowEditorCycles(...)`, `topologicallySortWorkflowEditorNodes(...)`, and UI adapter helpers.

## Notes

- The package also exposes `@moritzbrantner/workflow-editor/core` and `@moritzbrantner/workflow-editor/react` subpaths.
- The package owns workflow document state and graph validation; `@moritzbrantner/ui` supplies the generic graph surface and inspector controls.
