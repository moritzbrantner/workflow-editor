# Workflow port cardinality

Port cardinality describes how many connections may enter or leave a port ([Decision Atlas 1.10](DECISION-ATLAS.md) and 6.2). It is the optional `cardinality?: { min?, max? }` field of the core `WorkflowEditorPort`.

- Without `cardinality`, ordinary inputs accept one connection and outputs are unbounded (automatic fan-out, Decision 1.7). Expandable JSON array/object constructors keep growing a new input per connection.
- A declared cardinality without `max` is unbounded.
- An input that accepts more than one connection must declare an array type `T[]`. Each source is checked against the element type `T` with the TypeScript checker; connecting sources never rewrites the declared type. A non-array type with `max > 1` is the `invalid-port-cardinality` document error.

`validateWorkflowEditorConnection` enforces limits with the reasons `target-cardinality` and `source-cardinality` and an actionable message (`replacingEdgeId` ignores an edge being rewired). `connectWorkflowEditorNodes` applies the same check.

Document validation reports each edge beyond a port's `max`, in document order, as `port-cardinality-max`. Its severity follows the validation policy's `allowExcessConnections` (warning under `draft`/`import`, error under `strict`/`execution`), and `repairWorkflowEditorDocument` removes the excess edges. Ports below their `min` are reported only by the compiler (`port-cardinality`), which also preserves declared cardinality in compiled ports.

The built-in `control.merge` template has one multi-source input `items: any[]` (`min: 1`); its `out` output is inferred as an array of the union of the connected source types.
