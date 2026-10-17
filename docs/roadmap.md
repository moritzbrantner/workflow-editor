# Workflow Editor Roadmap

This roadmap turns the short README enhancement list into implementation-ready work. Each item
should land behind focused tests and preserve the existing public import paths unless a future
major version explicitly changes them.

## Execution Handoff and Cross-Repository Conformance

### Status

The execution-neutral compiler now emits `@moritzbrantner/workflow/compiled` version 1. A canonical
compiled-v1 fixture is shared as conformance evidence with `workflow-engine` and `workflow-runner`:
workflow-editor must produce it exactly, the engine must version and dispatch it unchanged, and the
runner must execute it without depending on editor internals.

### Next Slices

- Complete the compiler contract with canonical serialization/fingerprints, deterministic execution
  stages, structured source maps, and stable diagnostics.
- Decide explicit compiler behavior for nested workflow references and composed nodes rather than
  giving them implicit runtime semantics.
- Add an external execution-state overlay that consumes runner/engine lifecycle data without
  mutating the editable workflow document or entering undo history.
- Add production-shaped reference applications that compile to the same versioned runtime-neutral
  contract and remain usable as static GitHub Pages examples.

### Acceptance Tests

- The canonical compiled-v1 fixture remains byte-for-semantics stable when editor-only layout or
  chrome state changes.
- Engine and runner conformance tests consume the same fixture shape without importing
  workflow-editor as a runtime dependency.
- Unsupported future compiled versions fail explicitly rather than being silently repaired.
- Runtime execution state remains controlled host data and never becomes workflow document state.

### Non-Goals

- No scheduler, queue, worker, retry engine, or task executor inside workflow-editor.
- No direct dependency from workflow-editor on workflow-engine or workflow-runner.

## Configurable Graph Validation Policies

Delivered by #14 ([Decision Atlas 6.1](DECISION-ATLAS.md#6-document-validation)): a flat
`WorkflowEditorValidationPolicy` with `strict` (default), `draft`, `import` and `execution` presets,
severity on every diagnostic, `normalizeWorkflowEditorDocument` returning `{ document, diagnostics }`,
explicit `repairWorkflowEditorDocument`, and an editor "Document problems" panel with a
"Repair document" action. The former `allowCycles` and `mode` options were removed without a
compatibility layer. Cross-document DAG validation for nested references remains out of scope.

## Port Cardinality Rules

Delivered by #15 ([Decision Atlas 1.10 and 6.2](DECISION-ATLAS.md)); see
[`port-cardinality.md`](port-cardinality.md).

## Typed Node Template Registries

Delivered by #16 ([Decision Atlas 5.18](DECISION-ATLAS.md)): `createWorkflowEditorNodeTemplateRegistry`
derives validation and lookups from the host's template array; the palette and catalog use it and
show invalid templates disabled with their diagnostics. Published template revisions (#65) extend
this registry when needed.

## Keyboard-Only Graph Editing Accessibility

### Problem

The workbench has automated accessibility smoke coverage, but keyboard-only graph editing needs
explicit support for workflows that currently rely on pointer gestures.

### Proposed API

Prefer internal UI behavior over new public API. Add public helpers only if host applications need
to render their own accessible connection menus.

Possible additive API:

```ts
type WorkflowWorkbenchPortConnectionOption = {
  nodeId: string;
  nodeLabel: string;
  portId: string;
  portLabel: string;
  direction: "input" | "output";
};
```

### Non-Goals

- No replacement of pointer drag interactions.
- No full screen-reader graph traversal abstraction in the first pass.

### Acceptance Tests

- Keyboard users can create nodes from the palette.
- Keyboard users can select nodes and edges.
- Keyboard users can create a valid edge through a focused port action menu.
- Keyboard users can edit inspector fields without triggering graph shortcuts.
- Axe checks pass in initial, selected, inspector, settings, empty, and mobile states.

### Migration Notes

Pointer behavior and existing shortcut labels stay unchanged.

## Demo Pages

### Problem

The current example proves the workbench works, but users need domain-shaped examples to evaluate
workflow modeling patterns.

### Proposed Demos

- Data pipeline: source, transform, validate, sink.
- CRM automation: lead intake, enrichment, branching assignment.
- Branching workflow: decision nodes, fallback paths, and error statuses.

### Non-Goals

- No backend service.
- No workflow execution engine.

### Acceptance Tests

- Each demo can be opened directly from the example app.
- Each demo uses typed ports and at least one invalid connection scenario in tests.
- Example build stays static and deployable to GitHub Pages.

### Migration Notes

Demo data is additive and should not change the package runtime API.
