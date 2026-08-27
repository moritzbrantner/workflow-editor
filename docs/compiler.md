# Workflow compiler

`workflow-editor` owns the authoring document. Runners do not execute `WorkflowEditorDocument` directly.

Use the dedicated compiler entrypoint:

```ts
import { compileWorkflowEditorDocument } from "@moritzbrantner/workflow-editor/compiler";

const compiled = compileWorkflowEditorDocument(document);
```

The compiler emits `@moritzbrantner/workflow/compiled` version 1: a deterministic, execution-neutral DAG containing executable node kinds, ports, data, edges, and a complete topological order. Editor-only position, viewport, grouping, status, chrome, and layout state are intentionally absent.

Version 1 rejects nested workflow references and embedded compositions instead of giving them implicit runtime semantics. Those features can receive explicit compilation semantics in a later contract version without coupling the runner to editor internals.
