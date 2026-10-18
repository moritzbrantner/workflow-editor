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

## Version 3: Workflow References (TECH-005, #95)

Pass `resolveWorkflowReference` (for a library, `createWorkflowEditorLibraryReferenceResolver(library)`)
to compile documents whose top-level nodes reference other Workflow Documents. Without a resolver,
references are still rejected with `nested-workflow-not-supported`. Documents without references
keep compiled v1/v2. The shared fixture is `fixtures/compiled-v3-workflow-references.json`.

- **Closure:** each referenced document is resolved once at compile time, frozen as
  `workflows["<documentId>@<version>"]` and compiled with its own type declarations. Diamond
  dependencies appear once, and the runner never looks up a library at execution time.
- **Interface (owner decision 2026-10-18):** a referenced workflow's inputs are its `control.start`
  output ports and its outputs are its `control.end` input ports, listed in
  `definition.interface`. The reference node's ports match them by port id:
  - every reference input must exist on the interface and be assignable to it;
  - every interface input must be provided;
  - every reference output must exist and accept the interface output's type.

  A mismatch reports `workflow-reference-interface`.

- **Reference nodes** carry `workflowRef: { workflow: "<documentId>@<version>", maxDepth? }`. The
  runner runs that definition with the node's inputs as interface inputs and emits its interface
  outputs on the node's outputs.
- **Recursion:** a reference cycle (including self-reference) compiles only when at least one
  reference on it declares a finite `maxDepth`. Otherwise it reports
  `unbounded-recursive-reference`, and the runner enforces the bound. Missing documents report
  `missing-workflow-reference`. Diagnostics inside a referenced definition use paths prefixed with
  `workflows.<key>.`.

## Human tasks (editor #105, Engine TECH-001)

Nodes of kind `human.task.approval` and `human.task.input` (default templates **Approval** and
**Human input**, category "Human task") compile with a `humanTask` contract. Documents without
them keep their output unchanged, and the shared fixture is `fixtures/compiled-v1-human-tasks.json`.

```jsonc
// Approval: ports request → approved | rejected
{ "kind": "approval", "prompt": "Approve this expense?", "outcomes": ["approved", "rejected"] }
// Typed input: optional context input → value output
{ "kind": "input", "prompt": "Enter the corrected amount.", "responseType": { "kind": "typescript", "source": "number" } }
```

- **Response contract:** the host's answer is `{ decision: "approved" | "rejected", comment? }`
  for approval and `{ value, comment? }` for input. The approval decision names the active output
  port, and both outputs carry the `request` value. An input task emits `value` on its `value`
  port.
- **Validation:** `validateWorkflowEditorHumanTaskResponse(humanTask, response, { typeDeclarations })`
  checks a response against the contract. Typed values use the same TypeScript checker as ports,
  with the compiled workflow's `typeDeclarations`.
- **Ownership:** the runner suspends the node through its executor and resumes the same run with
  the response. The engine persists the wait and the task, authorizes nothing itself (the host
  does), and validates the response before resuming. The editor stores no task state.

## Per-node result persistence (TECH-011)

A node may set `persistence: "on-completion"` (inspector: **Execution → Persist result on
completion**). The compiled node then carries `persistence: "on-completion"`, which asks the
runner to hand that node's result to host persistence as soon as the node completes. Without the
setting, the compiled node has no `persistence` field and results persist with the terminal run
result, so existing compiled-v1 output is unchanged. The setting applies to iteration nodes and
iteration-body nodes in the same way. The editor stores no results.

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

### Measurements (TECH-004, #96)

An iteration body may expose named, typed **measurements** besides `next` and `converged`. These
are output boundaries whose `wrapperPortId` is an identifier (letters, digits, `_`) and whose
values are computed by ordinary body nodes.

- They compile to `iteration.body.outputs.measurements: [{ id, nodeId, portId, type }]`, sorted by
  id. The field is present only when measurements exist, so other compiled v2 output is unchanged.
- The `result` port type gains `measurements: { <id>: <type>; … }` on both result statuses. The
  runner reports the last completed iteration's values.
- A measurement is never a quality or convergence metric. Convergence stays the boolean
  `converged` output.

Duplicate or malformed names report `iteration-boundary-invalid`. The shared fixture is
`fixtures/compiled-v2-bounded-iteration-measurements.json`.
