# Source development

Workflow Editor keeps the published graph-editor semver range as its release contract, but coordinated development should consume graph-editor from source.

Default layout:

```text
workspace/
  editor-core/
  graph-editor/
  workflow-editor/
```

Set `GRAPH_EDITOR_SOURCE=/absolute/path/to/graph-editor` when needed. Graph Editor can independently use `EDITOR_CORE_SOURCE` for its own upstream checkout.

```sh
bun run source:prepare
bun run source:status
bun run source:smoke
bun run verify:source
```

`source:prepare` installs frozen dependencies, asks the graph-editor checkout to prepare its own source dependencies when that capability is present, builds graph-editor, then materializes that build into `node_modules/@moritzbrantner/graph-editor`. This makes the chain progressive: Workflow Editor can consume Graph Editor source, and Graph Editor can in turn consume Editor Core source, without publishing either package first.

The active graph-editor Git SHA is recorded under `node_modules/.editor-source-deps/`. No local path is written into `package.json` or the lockfile. `source:smoke` proves the selected graph source is active and importable; `verify:source` additionally runs Workflow Editor against that revision and may expose API migrations that still need to be made.

Return to the published dependency contract with:

```sh
bun run source:restore
bun run verify
```

The default `verify` path restores the frozen registry dependency before running release/package-consumer checks. Source mode fails rather than silently falling back when the graph-editor checkout is missing.
