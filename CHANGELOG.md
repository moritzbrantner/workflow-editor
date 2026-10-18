# @moritzbrantner/workflow-editor

## Unreleased

### Minor Changes

- Pages reference examples (W-10, Decisions 5.1/5.2/5.4): **Sales Data Pipeline** (source → transform → validate → branch → output) is now the first-open example, and **Product Image Generation** routes a media input through one opaque external ComfyUI operation to a published artifact. Both have typed ports, an intentionally invalid connection under test, and are compiled but not executed (see `docs/reference-examples.md`). The compact document menu now opens above the node palette.
- Export and import portable workflow bundles (W-09): a root document with its complete referenced-document closure, stable ids, versions and reference provenance (see `docs/bundles.md`).
  - `buildWorkflowEditorBundle` reports missing references and unbounded recursive references before export; recursion bounded by the new optional `WorkflowEditorWorkflowReference.maxDepth` keeps its closure and bound.
  - `parseWorkflowEditorBundle` returns structured diagnostics; `planWorkflowEditorBundleImport` previews an import without changing the library, with explicit `reuse`, `replace`, `duplicate` and `abort` collision strategies and deterministic reference rewriting; `applyWorkflowEditorBundleImportPlan` applies it.
  - The editor shell adds **Import bundle** / **Export bundle**, an import preview with a collision-strategy choice, and an alert listing rejected bundle diagnostics.
- Author and compile bounded iteration (TECH-002, Decisions 2.6 and 2.8).
  - A `control.iterate` node holds its loop body as its embedded composition, with typed `state`, a required finite `maxIterations`, an optional boolean `converged` stop output, and a generated `result` port typed `{ status: "converged" | "limit-exhausted"; value; iterations; maxIterations }`.
  - `validateWorkflowEditorIterationNode` reports missing or invalid bounds, body, boundary, state-type and stop-type problems, and nested iterations. A cyclic body is rejected on import instead of being repaired.
  - Documents with iteration compile to **compiled v2**; documents without it stay byte-identical v1. `CompiledWorkflow` is now `CompiledWorkflowV1 | CompiledWorkflowV2`.
  - The workbench shows "≤ N iterations · until converged" on the node face and adds an **Iteration** inspector section.
  - The Pages example adds a "Compile workflow" action, which reports "not executed", and a **Bounded Approximation (Newton √2)** example.
  - A cleared number field in the inspector now stays empty instead of becoming 0, and field validation messages are linked to their inputs.
- Configure shared, deterministic colors for TypeScript port types and their connections. The Pages workbench retains color settings across reloads without changing workflow documents.
- Use TypeScript 6's checker for workflow port compatibility, with offline ES2022/DOM libraries, document-owned type declarations, editable port expressions, native diagnostics, and propagated branch/collection output contracts. Legacy port records remain readable and compiled workflows optionally carry declarations. The Pages workbench includes a TypeScript ports example. Type checking remains execution-neutral.
- Type diagnostics are now the TypeScript compiler's messages (for example `TS2304: Cannot find name 'Missing'.` and `TS2456: Type alias 'A' circularly references itself.`) instead of the former `Missing workflow port type definition` / `Cyclic workflow port type reference` texts. Declarations that reference reserved `__Workflow` checker names are rejected.

- Author buffered and streamed binary ports: `WorkflowEditorPort.payload` (`{ mode: "buffered" | "streamed"; mediaType? }`) is validated after TypeScript assignability. Delivery mode and media mismatches are rejected with distinct reasons and messages, and analysis reports them on existing edges. The compiler copies `payload` onto compiled ports and rejects incompatible edges. The workbench shows payloads in port badges, edits them under **Port delivery** in the node inspector, explains rejections in the port connection menu, and adds a **Binary Audio Ports** example.

### Patch Changes

- Accessibility (#18): the compact document menu is now a labelled popover instead of an ARIA menu holding form controls, the workflow types panel has a heading, and the Pages example has a page heading. When a focused workbench control is removed, hidden or disabled without a document edit (for example on drill-in to a nested workflow), focus returns to the canvas instead of the page body.
- Explain rejected workflow imports: the editor shows the restore error (for example `Unsupported workflow port type at …`) in a dismissible alert beside the save state, and exposes it as `controller.importError` / `actions.dismissImportError` and the `WorkflowEditorImportErrorAlert` chrome component. Rejected files still never reach the library.
- Build the package in a `prepare` script so consumers can install it as a commit-pinned git dependency (`git+https://github.com/moritzbrantner/workflow-editor.git#<sha>` listed in `trustedDependencies`).
- Retire npm publishing: remove the changesets Release workflow and its `NPM_TOKEN` use. Version 0.2.0 was never published to npm; releases are commits on `main`.

## 0.2.0

### Minor Changes

- [`d6d8875`](https://github.com/moritzbrantner/workflow-editor/commit/d6d8875148da29cc1b2e7d4ce750722a68dada9a) - Refactor workflow document, runtime, layout, and workbench internals onto the npm `@moritzbrantner/graph-editor` primitives while preserving workflow-specific DAG validation, typed ports, constructor expansion, compositions, nested workflow metadata, chrome, and clipboard behavior.

  Add workflow-named graph runtime aliases, keep UI adapter helpers on the React entrypoint, harden public API and packed-consumer smoke checks, and expand release verification with API Extractor, public type tests, package export boundary checks, coverage gates, and clean npm dependency ranges.

  The new aliases are `createWorkflowGraphRuntime`, `applyWorkflowGraphOperation`, `WorkflowGraphOperation`, `WorkflowGraphRuntimeState`, and `WorkflowGraphWorkbenchController`; `WorkflowWorkbenchController.graph` is a compatibility controller assignable to npm `GraphWorkbenchController`.

  Breaking migration: generic graph helpers should be imported from `@moritzbrantner/graph-editor`; workflow-editor keeps wrappers only where workflow semantics are enforced.

- [`c930625`](https://github.com/moritzbrantner/workflow-editor/commit/c930625f86162cd4e5f070bd6de04980f3f906b6) - Make workflow document validation strict by default, add document validation diagnostics, expand verification coverage, and quiet Playwright web server color warnings.

- [#31](https://github.com/moritzbrantner/workflow-editor/pull/31) [`2a31e2f`](https://github.com/moritzbrantner/workflow-editor/commit/2a31e2ff809c5fceecb97b552807ab5763ae592f) Thanks [@moritzbrantner](https://github.com/moritzbrantner)! - Add the execution-neutral compiled workflow contract and deterministic workflow compiler entrypoint for runner and engine integrations.

- [#34](https://github.com/moritzbrantner/workflow-editor/pull/34) [`4accbf4`](https://github.com/moritzbrantner/workflow-editor/commit/4accbf4a3205d85c6015e243356212917b3d242c) Thanks [@moritzbrantner](https://github.com/moritzbrantner)! - Add an opt-in workflow port-cardinality contract with bounded connection validation, diagnostics, and compiler preservation.

### Patch Changes

- [#42](https://github.com/moritzbrantner/workflow-editor/pull/42) [`1140cdb`](https://github.com/moritzbrantner/workflow-editor/commit/1140cdbc184e0b1918f7cffd5be177469d69bdd0) Thanks [@moritzbrantner](https://github.com/moritzbrantner)! - Delegate workflow marquee selection to graph-editor's GraphCanvas and forward the complete controlled selection state, preventing duplicate selection rectangles and conflicting node selection while preserving workflow-specific viewport gestures.

## 0.1.1

- Initial public standalone release.
