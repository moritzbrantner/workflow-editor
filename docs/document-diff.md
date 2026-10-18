# Document diff and version comparison

## Headless diff

`diffWorkflowEditorDocuments(before, after, options)` compares two Workflow Documents without
mutating them. Nodes, edges, groups and ports are matched by id. Nested values report stable
paths, and arrays of id'd items (for example composition nodes) use `[id=…]` segments.

```ts
const diff = diffWorkflowEditorDocuments(savedVersion.document, draft, {
  positions: "summarize", // "include" (default) | "summarize" | "ignore"
  redact: (path) => isWorkflowEditorSecretLikePath(path), // the default policy
});
diff.entries; // [{ entity, change, id, nodeId?, path, label?, fields: [{ path, before, after, redacted? }] }]
diff.summary; // { added, removed, changed, moved }
diff.changedNodeIds;
diff.changedEdgeIds;
diff.changedGroupIds;
```

- **Entities:** `node`, `port` (`<nodeId>.<inputs|outputs>.<portId>`), `edge` (endpoint changes
  are rewiring), `group`, `document` (type declarations and other document metadata) and
  `viewport`.
- **Changes:** `added`, `removed`, `changed`, and `moved` for position-only changes. With
  `summarize`, moves are only counted. With `ignore`, they are dropped, together with viewport
  changes.
- **Redaction:** fields whose path looks like a secret (`secret`, `token`, `password`, `apiKey`,
  `credential`, `privateKey`) report `[redacted]` unless the host passes its own `redact`.
- **Performance:** `src/core-diff.bench.ts` diffs two 2,000-node documents with 200 edited nodes
  in about 12 ms locally.

## Editor

- **Compare** (next to **Restore version**) opens a comparison of the selected saved version with
  the current draft. Either side can be the draft or any saved version.
- The panel shows a summary, a list of differences with before → after values, and a
  layout-change option.
- Selecting an entry selects that node or edge on the canvas when it exists in the draft.
  **Highlight changes on canvas** selects every changed entity.
- **Restore version** and **Restore compared version** ask for confirmation. The restore is
  then committed as one undoable edit, so **Undo** returns to the replaced draft. Previously,
  restoring reset the undo history.
- The controller exposes `comparison`, `pendingRestore` and the comparison actions for custom
  chrome. `WorkflowEditorVersionControls` renders the confirmation and the comparison itself.
