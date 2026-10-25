# @moritzbrantner/workflow-editor

## Unreleased

### Minor Changes

- Pages reference applications (#22). The workbench adds **Support Agent with Review** (plan → tool call with retry and fallback → draft → human review → final reply) and **Order Fulfillment Orchestration** (HTTP order → parallel payment, inventory and label tasks → confirm, or cancel on a failed charge). **Lead Intake Automation** becomes the documented CRM reference and notifies the account owner. Every reference example has categorized nodes, an intentionally invalid connection, unit tests and a Pages smoke test. Storybook's **Reference examples/Order Fulfillment run** shows a recorded runner event stream as an execution overlay; Pages executes nothing and shows no run.
- Accessibility (axe-core 4.14, `label-content-name-mismatch`; owner decision 2026-10-21): button names now contain their visible text.
  - The parent link is named "Open parent workflow: <title>", and its arrow is an icon.
  - graph-editor is pinned to `a0c6939`, where port and node buttons keep their chips and package lines beside the button.
  - `@axe-core/playwright` is now 4.14.0.
- Edit an iteration body in its own tab (#94, Decision Atlas 5.25).
  - **Open body** (inspector and node menu) on a `control.iterate` node opens the tab "<workflow> › <iteration> body" with an **↑ Parent** link. Body edits use the normal canvas gestures and are saved inside the parent document, with one undo history.
  - With nothing selected, the body tab's document settings show **Iteration boundaries**: which body inputs the state and invariant inputs feed, the **Next state** and **Converged** outputs, and the iteration diagnostics.
  - `WorkflowEditorDocumentPathItem` gains `nodeId` for a body view. Document tabs have an `id` and a `title`; `switchTab`/`closeTab` take the tab id (a document's id for a document tab).
  - New headless helpers: `getWorkflowEditorIterationBodyDocument`, `setWorkflowEditorIterationBodyDocument`, `updateWorkflowEditorIterationBoundaries` and `findWorkflowEditorIterationBodyNode`. `WorkflowWorkbench` takes `onOpenIterationBody` and `iterationBody`.
  - Pages adds an empty bounded iteration template and the Newton step and Within tolerance nodes. **Compile workflow** in a body tab compiles the whole document.
- Linked shared templates in the workbench (#65).
  - A composed node's inspector has a **Shared template** section. A local composed node can be published as a new shared template or as a new revision of one; the section warns when the ports differ from the latest revision.
  - For a linked instance, the section shows its source and resolved revision and the linked instances across documents. It offers **Upgrade to revision N**, which explains the connections that will be removed, and **Detach to local copy**.
  - Linked nodes re-resolve from the catalog as it changes. The palette lists only the newest revision.
  - `WorkflowEditor` publishes through `onNodeTemplatesChange` and refuses to edit published shared revisions. `WorkflowWorkbench` takes `sharedTemplates` (`onPublish`, `listInstances`).
  - The Pages example stores published revisions in local storage.
  - Shared templates carry their TypeScript declarations (owner answer A, 2026-10-21). Publishing copies the declarations the ports need, with their dependencies, into the revision as `typeDeclarations`. A document that links it adds the ones it does not declare itself, so the instance type-checks and compiles there. New helpers: `extractWorkflowEditorTypeDeclarations` and `mergeWorkflowEditorTypeDeclarations`.
  - Pages **Compile workflow** resolves linked nodes through the catalog and inlines composed nodes (`compositions: "expand"`).
- Linked shared templates, headless model (#65, TECH-001), documented in `docs/linked-templates.md`.
  - Published revisions are immutable catalog templates with `shared: { templateId, revision }`.
  - Linked nodes carry `templateRef` and resolve through the catalog: compatible revisions propagate, incompatible ones wait for an explicit `upgradeWorkflowEditorLinkedNode` (planned with `planWorkflowEditorLinkedTemplateUpgrade`), and `detachWorkflowEditorLinkedNode` makes a local copy.
  - Missing templates or revisions are diagnosed.
  - `compileWorkflowEditorDocument` takes `nodeTemplates` to resolve linked nodes first.
- Pending human tasks in connected runs (#105).
  - `WorkflowWorkbench` and `WorkflowEditor` take `humanTasks={{ pending, respond }}`. The host reads the waits from Workflow Engine (`listPendingTasks`) and answers through `respondToTask`.
  - For a selected node with a pending task, the inspector shows **Pending task** with the prompt and context. An approval has **Approve** and **Reject** with an optional comment. A typed input has a value field checked by the port type checker (`validateWorkflowEditorHumanTaskResponse`).
  - Host errors, such as a stale task, are shown. Static Pages shows no tasks.
- One node geometry model (#48). Workflow nodes are sized and laid out only through graph-editor's layout options: inline minimized nodes (`minimizedNodeLayout="inline"`), per-node widths (`getNodeWidth`), composed body heights and no port column headers. Snapping, arrange and overlays use the same model. The generated CSS that patched graph-editor's node DOM is removed: minimized geometry, port-grid selectors, JSON-node badge hiding, object-constructor width and height overrides, and the minimized `className` overrides. So is the legacy object-constructor output-panel geometry. A new architecture ratchet test, `src/architecture-ratchet.unit.test.ts`, fails if such patches come back. The Object output of an object constructor and its Add property row now fit inside the node.
- Node face versus inspector (#47, Decision Atlas 5.6), documented in `docs/node-editing.md`.
  - The canvas node no longer repeats description, category or kind. `toUiWorkflowBuilderNodes` omits the description, and `fromUiWorkflowBuilderNodes` restores it from the document node. The workbench hides the category/kind chip with graph-editor's `showNodeCategory={false}`.
  - The inspector no longer duplicates the on-node JSON source value editor.
  - Nested workflows open from the node menu (**Open workflow**), also in read-only mode.
  - The CSS override that hid the kind chip on JSON nodes is gone.
- The Pages data pipeline declares typed inputs (#115) through a **Parameters** start node: a required `exportDate: string` and an optional `currency: "EUR" | "USD"` that defaults to EUR. The Inputs panel also warns that profiles are plain saved values, so secrets should be passed as host references.
- Live runs from Workflow Engine (#20). `createWorkflowExecutionSnapshotFromLiveRun` turns `engine.observeRun` / `getLiveRun` notifications into overlay snapshots: retrying nodes show as running with their attempt, suspended nodes as **Waiting** (a new built-in state), and the final notification as a past run.
- Compose and restore from the workbench (#18). The toolbar has **Compose**, which wraps the selected nodes into one composed node and selects it. When a composed node is selected it also shows **Restore composition**, and the same action is in that node's menu; restoring selects the restored nodes. Both work by keyboard. When restoring removes the focused menu trigger, focus moves to the canvas. Controllers gain `actions.composeSelection` and `actions.restoreComposition(nodeId?)`.
- Hosts choose how composed nodes compile (#19, #97) with `compileWorkflowEditorDocument(document, { compositions })`: `"reject"` (default, unchanged), `"opaque"` (one node), or `"expand"` (the embedded subgraph is inlined with `<composed>/<inner>` addresses and rewired boundary connections, also inside iteration bodies). The source map links inlined entities back to their nested authoring paths. New export `expandWorkflowEditorCompositions`. New shared fixture: `fixtures/compiled-v1-composed-expanded.json`.
- The Pages Approval Checklist example uses the human-task nodes (#105): an approval (`human.task.approval`) with approve/reject branches, and on rejection a typed correction (`human.task.input`). It now has a `control.end` interface that matches the Incident Escalation reference node, so both documents compile in Pages (v1 and v3).
- Workflow References inside iteration bodies compile (#95, #97). With `resolveWorkflowReference`, a body node's `workflowRef` compiles into the v3 closure like a top-level reference. Without a resolver it still reports `nested-workflow-not-supported`, now at its nested path (`nodes.<loop>.composition.nodes.<id>.workflowRef`); `missing-node-kind` and `composition-not-supported` inside bodies also get their nested paths. New shared fixture: `fixtures/compiled-v3-reference-in-iteration.json`.
- Workflow Reference editing (#95). The node inspector's **Nested workflow** section edits `workflowRef.maxDepth` ("Maximum recursion depth"; empty means not recursive). It also shows the referenced workflow's start/end interface, and **Sync ports with interface** updates the node's ports and drops connections to removed ports. New headless helpers: `getWorkflowEditorWorkflowInterface`, `workflowEditorReferenceMatchesInterface` and `syncWorkflowEditorReferenceInterface`. `listWorkflowEditorDocumentReferenceOptions` now includes each document's `interface`. Pages "Compile workflow" resolves references from the library, so Lead Intake compiles to the v3 contract.
- Node actions and rename use graph-editor's node chrome (#46). Each node has one action menu, the built-in "Open <node> menu" trigger, with Rename and Delete. Rename edits the label inline in the node header through graph-editor's title slot. The workflow-local action-menu overlay ("<node> node actions"), the portal-positioned rename field and the CSS that hid the built-in trigger are removed. graph-editor is pinned to `69341e3`, so idle nodes no longer draw a status dot (graph-editor#67).
- Dynamic ports are edited on the node (#45, Decision Atlas 5.6), through graph-editor's port-content and body slots:
  - Object Constructor property names are edited beside their input ports.
  - Array Constructor item rows can be removed.
  - Object Decomposition output names are edited beside their outputs.
  - Each family has a compact **+ Add …** action in the node body.
  - The object expression editor moved from a portal overlay into the node body.

  All edits use the workflow-core mutation helpers, so port ids, connections and undo stay authoritative. graph-editor is pinned to `f0e70f8`.

- Typed workflow inputs and named input profiles (#115, Decision Atlas 5.12):
  - A document's inputs are its Start node output ports: name, TypeScript type, required state, and default via `optional` / `defaultValue`. This is the same interface Workflow References use.
  - `getWorkflowEditorInputDeclarations`, `validateWorkflowEditorInputValues` (TypeScript checker) and `resolveWorkflowEditorInputValues` are exported.
  - Named profiles live on the library entry (`inputProfiles`, never inside the document), with `upsertWorkflowEditorInputProfile` / `removeWorkflowEditorInputProfile`.
  - Document settings gain an **Inputs** panel with a generated form, inline validation, and save / switch / delete for profiles.
  - `WorkflowEditor` `onRunWorkflow(values, profile)` is the host Run seam; without it, Pages says runs are unavailable.
- Document tabs (#100, Decision Atlas 5.14): open workflows are tabs, one per Library Entry. The tabs replace the document select and breadcrumb row (owner decision 2026-10-18, B).
  - Opening a Workflow Reference opens or switches to the child's tab, which shows an "↑ Parent" link back to the opening document. There is no breadcrumb trail (owner decision 2026-10-18, A).
  - Tabs keep each document's draft, history and selection, persist in `library.openDocumentIds` across reloads, and can be closed without losing the document.
  - `chrome.documentPath: "breadcrumb"` keeps the legacy path row.
- Workflow triggers (#91, Decision Atlas 5.11): documents declare manual, cron-schedule and webhook triggers (`document.triggers`), validated by `validateWorkflowEditorTriggers`.
  - With nothing selected, the info panel opens on document settings with a **Triggers** panel (owner decision 2026-10-18).
  - A host passes `triggerActivation` to register and activate the triggers; without one, Pages shows "Activation unavailable".
  - `toWorkflowEditorEngineTriggerInputs` produces workflow-engine trigger registrations.
- `applyWorkflowRunnerEventToSnapshot` / `createWorkflowExecutionSnapshotFromRunnerEvents` build the execution overlay snapshot from Workflow Runner lifecycle events (#20). The snapshot covers attempts, retries, durations, failures and waiting tasks. Outputs are summarized by port name only.
- Nested bounded iterations (#97): an iteration body may contain another `control.iterate` node. It compiles into compiled v2 with its own bound and body checks. `nested-iteration-not-supported` is no longer reported.
- Compile Workflow References (TECH-005, #95): with `resolveWorkflowReference` (for example `createWorkflowEditorLibraryReferenceResolver(library)`), documents that reference other Workflow Documents compile to **compiled v3**.
  - v3 freezes each referenced document once as `workflows["<id>@<version>"]` with a typed `control.start` / `control.end` interface.
  - Reference nodes carry `workflowRef: { workflow, maxDepth? }`.
  - The compiler reports `missing-workflow-reference`, `workflow-reference-interface` and `unbounded-recursive-reference`.
  - Documents without references compile as before.
- Human task nodes (editor #105, Decision Atlas 5.16): the **Approval** (`human.task.approval`, with approved/rejected outputs) and **Human input** (`human.task.input`, with a typed `value` output) default templates.
  - Both compile with a `humanTask` contract (prompt, outcomes or response type) and report `invalid-human-task` diagnostics.
  - `validateWorkflowEditorHumanTaskResponse` checks host responses.
  - See `docs/compiler.md` and `fixtures/compiled-v1-human-tasks.json`.
- Iteration measurements (TECH-004, #96): iteration bodies can expose named, typed measurement outputs besides `next` and `converged`.
  - They compile to `iteration.body.outputs.measurements` and appear as `measurements` in the typed `result`.
  - Bodies without measurements compile unchanged.
- Build on current graph-editor (#26): `@moritzbrantner/graph-editor` is now pinned to graph-editor `main` (commit `3f72b6e`) as a git dependency, and `@moritzbrantner/ui` moves to `^1.1.0`.
  - Keyboard users can move selected nodes with **Shift+Arrow** (coarse) and **Alt+Shift+Arrow** (fine) (#18).
  - Hosts must import `@moritzbrantner/ui/component-sources.css` next to their theme stylesheet and add an `@source` for graph-editor's `dist` (see the Pages `styles.css`).
  - `SearchField` now comes from `@moritzbrantner/ui/data`.
  - Graph validation now requires edge port ids. Workflow ports without a label still load and display their id.
  - The node palette list is a focusable, labelled region ("Node templates").
- Document diff and saved-version comparison (W-12): `diffWorkflowEditorDocuments` reports id-matched node, port, edge, group, document and viewport changes with stable paths. Layout-only changes can be included, summarized or ignored, and secret-like fields are redacted by default. The editor adds **Compare** with a summary, a differences list, canvas focus and highlight, and draft ↔ version or version ↔ version selection.
- **Behavior change:** restoring a saved version now asks for confirmation and is one undoable edit, instead of resetting the undo history (see `docs/document-diff.md`).
- Schema-driven inspector fields (W-11): node templates declare `inspectorFields` (text, number, boolean, select, multi-select, json, expression, secret-ref, key-value, custom) with paths into node `data`, defaults, required/read-only state, `visibleWhen` conditions and validation hints. One Apply is one undoable edit. Multi-node selections get a shared-fields panel with mixed-value handling; secret fields store references only. Hosts override renderers through `inspectorFieldRenderers`, and invalid definitions are reported as `invalid-inspector-field` template diagnostics. A `workflowRef` edit in the inspector now keeps the reference's `maxDepth` (see `docs/inspector-fields.md`).
- Pages reference examples (W-10, Decisions 5.1/5.2/5.4): **Sales Data Pipeline** (source → transform → validate → branch → output) is now the first-open example, and **Product Image Generation** routes a media input through one opaque external ComfyUI operation to a published artifact. Both have typed ports, an intentionally invalid connection under test, and are compiled but not executed (see `docs/reference-examples.md`). The compact document menu now opens above the node palette.
- Per-node result persistence (Runner TECH-011, #19): `WorkflowEditorNode.persistence?: "on-completion"` is authored in the node inspector (**Execution → Persist result on completion**). It round-trips through save, export and import, and compiles to `CompiledWorkflowNode.persistence`. Nodes without it compile exactly as before.
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

- Nested iterations must feed their required inputs (#97):
  - Compilation reports `iteration-input-unconnected` for an inner `control.iterate` whose `state` or invariant inputs have no body edge or boundary.
  - The shared `compiled-v2-nested-iteration.json` fixture now wires the inner loop through the outer body's boundaries, so runners can execute it.
- JSON string/number/boolean/null value editors render natively inside the node (#44), through graph-editor's composition seams: the body slot when expanded and the minimized header slot when minimized (owner decision 2026-10-18). The portal and offset positioning code is gone. Editing still never drags the node. graph-editor is pinned to `323bbba`.
- The save badge no longer flips from "Save error" back to "Saved" when a save that was already in flight finishes after a rejected import (#87). The import error stays on the badge until it is dismissed or replaced, and dismissing it shows the last save outcome again.
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
