# @moritzbrantner/workflow-editor

## Unreleased

- Refactored workflow document types to specialize `@moritzbrantner/graph-editor` core
  document, node, edge, port, selection, and viewport types.
- Moved generic graph indexes, document context backing, connection validation, layout, and
  common node/edge/group mutations onto graph-editor primitives while preserving workflow
  DAG, typed-port, constructor expansion, composition, nested workflow, and group-size rules.
- Added workflow-named graph runtime aliases:
  `createWorkflowGraphRuntime`, `applyWorkflowGraphOperation`,
  `WorkflowGraphOperation`, `WorkflowGraphRuntimeState`, and
  `WorkflowGraphWorkbenchController`.
- Added `WorkflowWorkbenchController.graph`, a compatibility controller assignable to npm
  `GraphWorkbenchController`.
- Rebuilt `WorkflowWorkbench` generic runtime, history, operation dispatch, command parsing,
  and canvas behavior on npm `@moritzbrantner/graph-editor` primitives.
- Kept workflow-specific chrome, panels, overlays, workflow clipboard behavior, nested workflow
  actions, DAG validation, constructor expansion, and composed-node controls in workflow-editor.
- Breaking migration: generic graph helpers should be imported from
  `@moritzbrantner/graph-editor`; workflow-editor keeps wrappers only where workflow
  semantics are enforced.

## 0.1.1

- Initial public standalone release.
