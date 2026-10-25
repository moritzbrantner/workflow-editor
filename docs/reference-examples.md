# Reference examples

The GitHub Pages workbench (`examples/workbench`) ships five reference applications (#22). They
are defined in `examples/workbench/src/reference-examples.ts`. The data pipeline and the AI/media
pipeline are the two approved example families (Decision Atlas 5.1). The agent, backend
orchestration and CRM examples cover the other reference applications named in #22. All five are
deterministic and need no backend, credentials or network. Pages compiles them but never executes
them.

A first-time visitor with no saved or selected document opens into the **Sales Data Pipeline**
(Decisions 5.2 and 5.4). A saved library or the last selected document always takes precedence.
The other examples and **New** (a blank document) are in the document menu.

Every example uses typed ports and node categories, and has one intentionally invalid connection
that the editor rejects with `type-mismatch` (`validateWorkflowEditorConnection`). In the port menu
the invalid target is listed but disabled. **Compile workflow** runs `compileWorkflowEditorDocument`
and labels the contract "not executed".

## Sales Data Pipeline (`data-pipeline`)

Sales CSV → Normalize amounts → Validate records → Route by validity → Load warehouse or
Quarantine batch.

| Pattern                                                                      | API                                                               |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Document-owned TypeScript types (`SalesCsvRow[]`, `SalesRecord[]`) on ports  | `typeDeclarations`, `{ kind: "typescript", source }` ports        |
| Typed workflow inputs and input profiles (#115)                              | `control.start` outputs with `optional` / `defaultValue`          |
| Typed branch: the `control.if` outputs take their type from the routed value | default `control.if` template, `workflowTypeInference`            |
| Invalid connection                                                           | raw `Sales CSV Rows` → `Load warehouse Records`                   |
| Compilation into the runtime-neutral contract                                | `compileWorkflowEditorDocument` (the **Compile workflow** action) |

## Product Image Generation (`media-pipeline`)

Product photo + Style prompt → Build request → Generate variant (ComfyUI) → Resize for web →
Publish artifact.

| Pattern                                                      | API                                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| One opaque, versioned external AI/media operation (ADR 0003) | `asset.operation` node with a pinned `assetOperation` reference (`image.comfyui.generate@1`). ComfyUI owns the model graph and inference |
| Typed media references instead of raw bytes                  | `MediaAsset` / `GenerationRequest` declarations                                                                                          |
| Invalid connection                                           | the text `Style prompt Value` → `Resize for web Image`                                                                                   |
| Compilation                                                  | as above; the external operation stays opaque in the compiled contract                                                                   |

## Support Agent with Review (`agent-workflow`)

Support request → Plan steps → Search knowledge base (or Fallback: search docs) → Collect evidence
→ Draft reply → Review reply → Final reply. A rejected draft goes to Correct reply.

| Pattern                       | API                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Tool calls with retry         | `data.retry` on the tool node is configuration for the runner; the editor does not retry anything                        |
| Fallback on failure           | a typed `Error` output (`ToolError`) feeds the fallback tool                                                             |
| Fan-in of alternative results | `control.merge` with `cardinality: { min: 1, max: 2 }` and a `ToolResult[]` input                                        |
| Human approval and correction | `human.task.approval` and `human.task.input` (#105); compiled as `humanTask` contracts, illustrative only without a host |
| Invalid connection            | the raw `Support request Request` → `Final reply Reply` (it must be planned, drafted and reviewed first)                 |

## Order Fulfillment Orchestration (`backend-orchestration`)

Order received (HTTP) → Charge payment, Reserve inventory and Create shipping label in parallel →
Confirm order. A failed charge goes to Cancel order. Both outcomes reach Respond to shop.

| Pattern                 | API                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| HTTP and task nodes     | `http.request` / `task.run` nodes with typed inputs and outputs; the URLs are `.invalid` placeholders |
| Fan-out / fan-in        | one `Order` output feeds three tasks; `Confirm order` waits for all three typed inputs                |
| Error path              | `Charge payment` has a typed `Failure` output that feeds `Cancel order`                               |
| Execution overlay (#20) | `backendOrchestrationRecordedRun` + `createWorkflowExecutionSnapshotFromRunnerEvents` (see below)     |
| Invalid connection      | `Charge payment Failure` → `Confirm order Receipt`                                                    |

## Lead Intake Automation (`lead-intake`, CRM)

Website form → Deduplicate → Enrich lead (nested) → Score lead → Qualification rule → Route by fit
→ Create deal and Notify account owner, or Nurture sequence.

| Pattern                | API                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nested workflow        | a `workflow.reference` node to the **Enrich Lead** document, resolved by `createWorkflowEditorLibraryReferenceResolver` and compiled as contract v3 |
| Named object types     | `crmTypeDefinitions` (`Lead`, `QualifiedLead extends Lead`) passed as `typeDefinitions`                                                             |
| Conditional assignment | `control.if` with typed `Sales` (`QualifiedLead`) and `Nurture` (`Lead`) outputs                                                                    |
| Multi-source input     | `Routed leads` (`control.merge`, `cardinality: { min: 1, max: 3 }`)                                                                                 |
| Invalid connection     | `Route by fit Nurture` → `Create deal Qualified lead` (an unqualified lead cannot create a deal)                                                    |

## Execution overlay

Pages has no runner, so it shows no run state (Decisions 5.7 and 5.8). The overlay is demonstrated
in Storybook under **Reference examples/Order Fulfillment run**. A recorded Workflow Runner event
stream for the Order Fulfillment example is folded into a snapshot with
`createWorkflowExecutionSnapshotFromRunnerEvents`. The `Retrying` story stops while the charge is
retrying, and the `Completed` story shows the finished run. A connected host would feed the same
snapshot from live events (see `docs/execution-overlay.md`). Sample and connected test runs belong
to #107.

## Tests

- `src/reference-examples.unit.test.ts`: every example is deterministic, categorized,
  type-correct and compiles; each intentionally invalid connection is rejected. It also checks the
  agent's fallback and human tasks, and that the recorded run covers the backend example's nodes.
- `src/reference-examples.e2e.spec.ts`: on Pages, first open lands in the data pipeline. Each
  example then loads, shows its invalid connection as disabled in the port menu, takes an
  inspector edit, compiles ("not executed"), exports JSON and keeps the edit after reload.
