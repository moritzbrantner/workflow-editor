# Reference examples

The GitHub Pages workbench (`examples/workbench`) ships two reference examples (Decision Atlas
5.1). They are defined in `examples/workbench/src/reference-examples.ts`. Both are deterministic
and need no backend, credentials or network. Pages compiles them but never executes them.

A first-time visitor with no saved or selected document opens into the **Sales Data Pipeline**
(Decisions 5.2 and 5.4). A saved library or the last selected document always takes precedence.
The other examples and **New** (a blank document) are in the document menu.

## Sales Data Pipeline (`data-pipeline`)

Sales CSV → Normalize amounts → Validate records → Route by validity → Load warehouse or
Quarantine batch.

| Pattern                                                                      | API                                                                                                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document-owned TypeScript types (`SalesCsvRow[]`, `SalesRecord[]`) on ports  | `typeDeclarations`, `{ kind: "typescript", source }` ports                                                                                                      |
| Typed branch: the `control.if` outputs take their type from the routed value | default `control.if` template, `workflowTypeInference`                                                                                                          |
| Connection validation                                                        | `validateWorkflowEditorConnection`. The invalid example connects raw `Sales CSV Rows` straight to `Load warehouse Records` and is rejected with `type-mismatch` |
| Compilation into the runtime-neutral contract                                | `compileWorkflowEditorDocument` (the **Compile workflow** action)                                                                                               |

## Product Image Generation (`media-pipeline`)

Product photo + Style prompt → Build request → Generate variant (ComfyUI) → Resize for web →
Publish artifact.

| Pattern                                                      | API                                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| One opaque, versioned external AI/media operation (ADR 0003) | `asset.operation` node with a pinned `assetOperation` reference (`image.comfyui.generate@1`). ComfyUI owns the model graph and inference |
| Typed media references instead of raw bytes                  | `MediaAsset` / `GenerationRequest` declarations                                                                                          |
| Connection validation                                        | The invalid example connects the text `Style prompt Value` to `Resize for web Image` and is rejected with `type-mismatch`                |
| Compilation                                                  | as above; the external operation stays opaque in the compiled contract                                                                   |

## Tests

- `src/reference-examples.unit.test.ts`: both examples are deterministic, type-correct and
  compile; each intentionally invalid connection is rejected.
- `src/reference-examples.e2e.spec.ts`: on Pages, first open lands in the data pipeline. Each
  example then loads, shows its invalid connection as disabled in the port menu, takes an
  inspector edit, compiles ("not executed"), exports JSON and keeps the edit after reload.

Execution overlays are demonstrated in Storybook (`ExecutionRunning`, `ExecutionFailed`, …). Pages
has no runner, so it shows no run state; sample and connected runs belong to #107.
