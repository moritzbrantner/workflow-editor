# @moritzbrantner/workflow-editor

## Unreleased

### Patch Changes

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
