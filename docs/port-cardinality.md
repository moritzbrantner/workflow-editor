# Workflow port cardinality

Port cardinality is an optional workflow-owned contract for describing how many edges may enter or leave a port. It lives in `@moritzbrantner/workflow-editor/cardinality` rather than the generic graph or editor kernels.

A cardinality declaration has optional `min` and `max` bounds. `max: null` means unbounded. Undeclared ordinary input ports retain the existing single-input behavior, while outputs remain unbounded unless a maximum is declared. Dynamic JSON array and object constructor inputs retain their expandable behavior.

Use `validateWorkflowEditorConnectionWithCardinality` before adding an edge, `connectWorkflowEditorNodesWithCardinality` for a cardinality-aware mutation, and `analyzeWorkflowEditorPortCardinality` to report documents whose current connection counts violate declared bounds.

The workflow compiler rejects unmet cardinality constraints and preserves declared cardinality in compiled ports so downstream runners can inspect the contract without receiving editor-only layout state.
