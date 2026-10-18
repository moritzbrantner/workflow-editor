# Linked shared templates

Issue #65, Decision Atlas 2.9/2.11, TECH-001.

A **shared template** is a composed node published into the host's Node Template catalog. Every
published **revision** is one immutable catalog template:

```ts
{ id: "normalize-file@2", shared: { templateId: "normalize-file", revision: 2 }, composition, inputs, outputs, … }
```

`createWorkflowEditorSharedTemplateRevision(composedNode, catalog, { templateId })` builds the next
revision. The host stores it and adds it to the catalog; earlier revisions are never changed. The
palette shows only the newest revision of each shared template (`isWorkflowEditorPaletteTemplate`).

A node created from a shared revision is a **linked instance** with
`templateRef: { templateId, revision }`. The catalog is the authority for its ports and
composition:

- `resolveWorkflowEditorLinkedNodes(document, catalog)` re-resolves every linked node.
  - A newer revision with the same port contract is **compatible** and takes effect automatically.
    The contract is the same port ids, TypeScript types and optional flags; internal subgraph,
    label and data changes don't count.
  - An incompatible revision never applies by itself: the node stays on its last compatible
    revision, and `resolveWorkflowEditorLinkedTemplate` reports the newer revision as `upgrade`.
  - A missing template or revision is reported as `missing-linked-template` or
    `missing-linked-template-revision`. Nothing is rebound by name.
- `planWorkflowEditorLinkedTemplateUpgrade` lists the connections an explicit upgrade would remove
  and the ports whose type changes. `upgradeWorkflowEditorLinkedNode` applies the upgrade.
- `detachWorkflowEditorLinkedNode` keeps the currently resolved subgraph as an ordinary local
  composed node, which no longer follows the catalog.
- `listWorkflowEditorLinkedInstances(documents, templateId, catalog)` shows which documents link a
  template and at which revision.

`compileWorkflowEditorDocument(document, { nodeTemplates })` resolves linked nodes through the
catalog before compiling, and fails on missing definitions. Linked instances are composed nodes,
so they also need a `compositions` mode (`opaque` or `expand`). Library saves and document files
keep `templateRef`; importing into an editor without the template reports it as missing.
