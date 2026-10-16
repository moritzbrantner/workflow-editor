# ComfyUI remains authoritative for native media workflows

The ComfyUI-first product direction is defined by asset-tooling Decision Atlas 5.1.1.
This ADR defines Workflow Editor's integration boundary, not a second product decision.

ComfyUI owns the contents, custom nodes, models, execution and versioned identity of a
native generative-media graph. Use its existing media editor and runtime instead of
reimplementing each ComfyUI node, inference service or queue in workflow-editor.

Workflow-editor owns general typed Workflow Documents, authoring and compilation.
A pinned ComfyUI graph appears as one externally executed asset-tooling operation,
projected through the existing operation-descriptor and Node Template bridge.
Store typed ports, parameter bindings and an immutable native workflow reference.
Do not silently synchronize two independently editable copies of a ComfyUI graph.

ComfyUI can guide general-purpose UX improvements such as previews, discovery and
inspection, but exact feature parity is not a goal. Reuse graph-editor for gestures,
the Editor Catalog for definitions, the existing compiler for general workflow
semantics and an external runner for execution. Later first-party asset providers
retain the same asset-operation boundary and explicit provider selection.

Real integration acceptance belongs to asset-tooling issues #212 and #211; this ADR
does not claim model generation, published UI acceptance or actual image approval.
