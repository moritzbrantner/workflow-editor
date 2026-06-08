# Workflow Editor Roadmap

This roadmap turns the short README enhancement list into implementation-ready work. Each item
should land behind focused tests and preserve the existing public import paths unless a future
major version explicitly changes them.

## Configurable Graph Validation Policies

### Problem

Workflow documents are currently validated with a small set of global options. Hosts need stricter
or looser policies depending on whether they are editing drafts, importing legacy documents, or
executing production workflows.

### Proposed API

Add a `validationPolicy` option to document validation and normalization options:

```ts
type WorkflowEditorValidationPolicy = {
  allowCycles?: boolean;
  allowDanglingEdges?: boolean;
  allowSelfEdges?: boolean;
  unknownPortBehavior?: "error" | "warning" | "ignore";
};
```

Existing scalar options continue to work and take precedence during a deprecation window.

### Non-Goals

- No execution/runtime scheduler changes.
- No cross-document DAG validation for nested workflow references.

### Acceptance Tests

- Strict mode rejects dangling edges, self edges, and cycles.
- Draft policy reports warnings without throwing during normalization.
- Imported malformed JSON still fails strict editor import.
- Existing `allowCycles` behavior remains compatible.

### Migration Notes

Default behavior remains strict. Existing callers do not need to change.

## Port Cardinality Rules

### Problem

Every compatible edge is currently accepted unless it duplicates an existing edge or creates an
invalid graph. Hosts need ports that accept only one edge, many edges, or a bounded number of
connections.

### Proposed API

Extend `WorkflowEditorPort`:

```ts
type WorkflowEditorPortCardinality = "single" | "many" | { min?: number; max?: number };

type WorkflowEditorPort = {
  cardinality?: WorkflowEditorPortCardinality;
};
```

### Non-Goals

- No automatic edge prioritization.
- No runtime data fan-in/fan-out execution semantics.

### Acceptance Tests

- A `single` input rejects a second incoming edge.
- A `many` input preserves current behavior.
- A bounded port rejects edges past `max`.
- Repair mode removes edges that violate cardinality only when explicitly configured to repair.
- UI connection previews surface a cardinality-specific invalid reason.

### Migration Notes

Ports without `cardinality` keep current behavior.

## Typed Node Template Registries

### Problem

Node templates are editable as data, but there is no first-class registry validation surface for
template ids, port ids, categories, type references, composition payloads, or host metadata.

### Proposed API

Add a headless registry helper:

```ts
type WorkflowEditorNodeTemplateRegistry<TData = Record<string, unknown>> = {
  templates: readonly WorkflowEditorNodeTemplate<TData>[];
  diagnostics: WorkflowEditorNodeTemplateDiagnostic[];
};

function createWorkflowEditorNodeTemplateRegistry(...): WorkflowEditorNodeTemplateRegistry;
function validateWorkflowEditorNodeTemplates(...): WorkflowEditorNodeTemplateDiagnostic[];
```

### Non-Goals

- No schema language beyond the existing TypeScript-like port type objects.
- No remote template loading protocol.

### Acceptance Tests

- Duplicate template ids are reported.
- Duplicate port ids inside a template are reported.
- Missing type refs are reported with paths.
- Invalid composition documents are reported without mutating input.
- Editor catalog panels reuse the same validator.

### Migration Notes

Existing `nodeTemplates` arrays remain accepted. Registry helpers are additive.

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
