# Workflow Editor landscape roadmap

This roadmap complements `docs/roadmap.md`. The existing roadmap owns workflow features; this document owns the dependency and editor-family sequencing around them.

## 1. Rebase workflow semantics on current graph-editor

Use source-first development to make current Graph Editor the generic graph implementation beneath Workflow Editor.

### Acceptance criteria

- generic graph runtime, operations, commands, selection, layout, connection interaction, and canvas behavior come from graph-editor
- generic editor behavior inherited by graph-editor comes from editor-core
- workflow wrappers remain only where they enforce workflow semantics
- source verification can exercise workflow-editor -> graph-editor -> editor-core without publishing intermediate packages
- packed/registry verification remains an independent release check

## 2. Keep the workflow boundary narrow

Workflow Editor owns:

- directed workflow/DAG policies
- typed ports and assignability
- port cardinality
- workflow node templates and validated registries
- composed nodes
- nested workflow references
- workflow-specific clipboard semantics where generic graph semantics are insufficient
- workflow-specific editor chrome and diagnostics

Workflow Editor does not own:

- generic graph selection/manipulation
- generic canvas or viewport behavior
- generic graph grouping/layout
- a workflow execution scheduler
- editor-wide persistence/command/history primitives that already exist lower in the stack

## 3. Continue the existing workflow roadmap

After the generic dependency boundary is clean, implement the existing roadmap in roughly this order:

1. configurable validation policies
2. port cardinality rules
3. typed node-template registries
4. keyboard-only connection editing
5. richer domain-shaped demos

Each feature should reuse graph/editor-core diagnostics and command surfaces rather than adding parallel infrastructure.

## 4. Execution-state visualization without owning execution

Later hosts may want to display running, succeeded, failed, skipped, or retrying nodes and edges.

Model that as host-provided execution state projected onto an authored workflow. Do not embed orchestration, scheduling, queueing, or worker execution into workflow-editor.

### Acceptance criteria

- execution state can be supplied independently of the workflow document
- authored workflow semantics remain serializable without runtime status
- read-only/live execution views reuse the same graph projection where possible

## 5. Dogfood before broadening APIs

Use at least two concrete workflow domains before adding new generic concepts. Prefer host adapters and typed registries over expanding the core workflow document model for one product.
