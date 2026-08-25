# Source development

Workflow Editor keeps the published graph-editor semver range as its release contract, but coordinated development should consume graph-editor from source.

Default layout:

```text
workspace/
  editor-core/
  graph-editor/
  workflow-editor/
```

Set `GRAPH_EDITOR_SOURCE=/absolute/path/to/graph-editor` when needed.

```sh
bun run source:prepare
bun run source:status
bun run verify:source
```

`source:prepare` installs frozen dependencies, asks the graph-editor checkout to prepare its own source dependencies when that capability is present, builds graph-editor, then links the checkout into `node_modules/@moritzbrantner/graph-editor`. This makes the chain progressive: workflow-editor can consume graph-editor source, and graph-editor can in turn consume editor-core source, without publishing either package first.

The active graph-editor Git SHA is recorded under `node_modules/.editor-source-deps/`. No local path is written into `package.json` or the lockfile.

Use `bun run source:watch` while actively changing graph-editor. If graph-editor is itself in source mode, its own `source:watch` can be run separately for editor-core.

Return to the published dependency contract with:

```sh
bun run source:restore
bun run verify
```

The default `verify` path restores the frozen registry dependency before running release/package-consumer checks. Source mode fails rather than silently falling back when the graph-editor checkout is missing.
