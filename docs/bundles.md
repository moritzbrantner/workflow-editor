# Portable workflow bundles

A workflow bundle carries one root Workflow Document together with every Workflow Document it
references, so nested workflows move between libraries and applications intact. Single-document
import/export (`@moritzbrantner/workflow-editor/document`) is unchanged and stays available.

Bundles are editable **sources**. They are separate from the compiled execution artifact
(TECH-005): compilation resolves and freezes references itself; a bundle only keeps their
identities, versions and bounds.

## Format (version 1)

```jsonc
{
  "format": "@moritzbrantner/workflow-editor/bundle",
  "version": 1,
  "exportedAt": "2026-10-18T00:00:00.000Z",
  "rootDocumentId": "a",
  // Root first, then referenced documents in depth-first reference order; each id appears once.
  "documents": [
    {
      "id": "a",
      "name": "A",
      "version": 1,
      "updatedAt": "…",
      "description": "…",
      "tags": [],
      "document": { "nodes": [], "edges": [] },
    },
  ],
  // Provenance of every Workflow Reference in the bundled documents.
  "references": [
    {
      "sourceDocumentId": "a",
      "nodePath": ["to-b"],
      "targetDocumentId": "b",
      "targetVersion": 1,
      "maxDepth": 3,
    },
  ],
}
```

- `nodePath` lists node ids from the document root to the referencing node; references inside
  composed nodes have one id per composition level.
- `targetVersion` is the target library entry's version at export.
- `maxDepth` copies the reference's optional finite recursion bound
  (`WorkflowEditorWorkflowReference.maxDepth`, a positive integer).

`fixtures/bundle-v1-diamond.json` is the committed version 1 fixture. A future version 2 is
migrated in `parseWorkflowEditorBundle`; newer versions are rejected with
`unsupported-future-version`.

## Export

`buildWorkflowEditorBundle(library, rootDocumentId)` walks the reference closure, including
references inside composed nodes, and returns structured diagnostics instead of a bundle when:

- a reference targets a document missing from the library (`missing-reference`);
- a reference cycle has no finite bound on any of its references
  (`unbounded-recursive-reference`, with the `cycle` path);
- a reference declares an invalid bound (`invalid-reference-bound`).

A bounded recursive reference (any reference on the cycle declares `maxDepth`) is bundled with its
closure and bound. Diamond dependencies are bundled once.

## Import

1. `parseWorkflowEditorBundle(text)` validates the format, version, documents and closure. Errors
   reject the bundle; disagreements between the recorded `references` and the documents are
   warnings (`reference-mismatch`, `version-mismatch`). An invalid `maxDepth` is an error rather
   than being dropped.
2. `planWorkflowEditorBundleImport(library, bundle, strategy)` returns a preview without changing
   the library. A bundle document whose id already exists collides; the strategy decides:

   | Strategy    | Colliding document                                                                                              |
   | ----------- | --------------------------------------------------------------------------------------------------------------- |
   | `abort`     | Blocks the import (`document-collision` errors).                                                                |
   | `reuse`     | Keeps the library document; references point to it. Differing versions produce a `version-mismatch` warning.    |
   | `replace`   | Overwrites it; the previous content is kept as a saved version named "Before bundle import".                    |
   | `duplicate` | Imports a copy as `<id>-copy` (`-copy-2`, … if taken) and rewrites every reference to it in imported documents. |

3. `applyWorkflowEditorBundleImportPlan(library, bundle, plan)` returns the new library with the
   imported root active.

Planning and rewriting are deterministic: the same library, bundle and strategy produce the same
plan and ids. Export → import into a library without collisions → export reproduces the bundle.

## Editor shell

The editor's document menu has **Import bundle** and **Export bundle**. Importing shows the plan
(each workflow and what happens to it); collisions block **Confirm import** until a strategy is
chosen. Rejected exports and imports show their diagnostics in a dismissible alert. The
controller exposes `bundleImport`, `bundleError` and the bundle actions for custom chrome.
