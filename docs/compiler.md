# Workflow compiler

`workflow-editor` owns the authoring document. Runners do not execute `WorkflowEditorDocument` directly.

Use the dedicated compiler entrypoint:

```ts
import { compileWorkflowEditorDocument } from "@moritzbrantner/workflow-editor/compiler";

const compiled = compileWorkflowEditorDocument(document);
```

The compiler emits `@moritzbrantner/workflow/compiled` version 1: a deterministic, execution-neutral DAG containing executable node kinds, ports, data, edges, and a complete topological order. Editor-only position, viewport, grouping, status, chrome, and layout state are intentionally absent.

Version 1 rejects nested workflow references and embedded compositions instead of giving them implicit runtime semantics. Those features can receive explicit compilation semantics in a later contract version without coupling the runner to editor internals.

Compiled ports carry their declared `cardinality` and delivery `payload` (see [port payloads](port-payloads.md)). Ports without them omit the fields, so existing version 1 consumers and fixtures are unaffected.

## Canonical form, fingerprint, stages and source map

`createCompiledWorkflowReport(compiled)` derives host-facing metadata **beside** the compiled artifact. The artifact itself is unchanged, so version 1/2 consumers and their conformance fixtures keep their exact bytes.

```ts
import {
  compileWorkflowEditorDocument,
  createCompiledWorkflowReport,
} from "@moritzbrantner/workflow-editor/compiler";

const compiled = compileWorkflowEditorDocument(document);
const { canonicalJson, fingerprint, stages, sourceMap } = createCompiledWorkflowReport(compiled);
```

- `canonicalJson` (`serializeCompiledWorkflow`): JSON with object keys sorted recursively and no whitespace. Because compilation already orders nodes topologically (ties by ID) and sorts edges by ID, semantically identical documents produce byte-identical output regardless of authoring order, positions, viewport, groups or object key order.
- `fingerprint` (`fingerprintCompiledWorkflow`): `sha256:<hex>` of `canonicalJson`. It is computed synchronously and needs no Node or Web Crypto API. Use it as the canonical workflow identifier for caching, deduplication or run provenance.
- `stages` (`getCompiledWorkflowStages`): top-level nodes grouped by longest dependency path. Every dependency of a node lies in an earlier stage, so the nodes within one stage are independent; IDs within a stage are sorted. Stages are advisory: runners may still schedule from `order` and `edges`.
- `sourceMap` (`createCompiledWorkflowSourceMap`): compiled addresses mapped to authoring paths that use the same notation as compile diagnostics. Top-level nodes and edges use their ID as address; entities inside an iteration body use `<iteration address>/<id>` and record their `parent`.

## Version 2: bounded iteration

A document that contains a bounded iteration node (`control.iterate`, see [TECH-002](technical-decisions.md)) compiles to **version 2**. A document without one still compiles to version 1, byte-for-byte as before, so a v1 consumer never receives loop semantics it cannot honour. Every ordinary connection is still acyclic, inside the body as well. Repetition exists only as the structured construct below.

```ts
type CompiledWorkflowIteration = {
  maxIterations: number; // a whole number of at least 1; the runner enforces it
  state: { inputPortId: "state"; type: WorkflowEditorPortType };
  stop: { kind: "body-output"; outputId: "converged" } | { kind: "limit-only" };
  candidate: "latest-state";
  result: { outputPortId: "result"; statuses: ["converged", "limit-exhausted"] };
  body: {
    nodes;
    edges;
    order; // compiled with the same rules as the top level
    inputs: Array<{ id: string; nodeId: string; portId: string }>; // "state" and invariant inputs
    outputs: { next: { nodeId; portId }; converged?: { nodeId; portId } };
  };
};
```

Runner semantics:

1. Run the body with `state` set to the iteration node's `state` input. Invariant inputs keep the same value in every run.
2. After each run, the `next` output becomes the new state.
3. Stop with `status: "converged"` as soon as the `converged` output is `true`.
4. After `maxIterations` runs without converging, stop with `status: "limit-exhausted"` and the latest state as `value`. Under `limit-only` there is no stop condition, so every completed run ends as `limit-exhausted` and never claims convergence (Decision 2.8).
5. `iterations` is the number of completed runs.

The body chooses the best candidate by carrying it in its state; the editor never picks one. Cancellation, timeout, executor failure and the absence of any result are runner outcomes, not values of the `result` port.

The compiler rejects these cases with structured diagnostics:

| Code                             | Meaning                                        |
| -------------------------------- | ---------------------------------------------- |
| `iteration-bound-required`       | the bound is missing                           |
| `iteration-bound-invalid`        | the bound is not a whole number of at least 1  |
| `iteration-body-missing`         | there is no body, or no `next` output          |
| `iteration-boundary-invalid`     | the boundaries are malformed                   |
| `iteration-state-type`           | the state does not round-trip through the body |
| `iteration-stop-type`            | the `converged` output is not boolean          |
| `nested-iteration-not-supported` | an iteration is nested inside a body           |

Body problems use the usual codes, with paths under `nodes.<id>.composition.`. The shared conformance fixture is `fixtures/compiled-v2-bounded-iteration.json`.
