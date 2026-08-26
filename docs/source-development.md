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
bun run source:smoke
bun run verify:source
```

`source:prepare` installs frozen dependencies, builds the selected graph-editor checkout, then materializes that build into `node_modules/@moritzbrantner/graph-editor`. By default Graph Editor keeps using its own registry dependency on editor-core, so choosing graph source does not force every transitive dependency into source mode.

To opt into the next source edge as well, set `EDITOR_CORE_SOURCE=/absolute/path/to/editor-core`. When that variable is present and the graph-editor checkout exposes `source:prepare`, Workflow Editor asks Graph Editor to prepare that upstream source before building it. This makes the chain progressive rather than all-or-nothing: workflow→graph source works independently, while workflow→graph→editor-core source can be enabled when that combination is compatible.

The active graph-editor Git SHA is recorded under `node_modules/.editor-source-deps/`. No local path is written into `package.json` or the lockfile. `source:smoke` proves the selected graph source is active and its headless core entrypoint is importable; `verify:source` additionally runs Workflow Editor against that revision and may expose API migrations that still need to be made.

Return to the published dependency contract with:

```sh
bun run source:restore
bun run verify
```

The default `verify` path restores the frozen registry dependency before running release/package-consumer checks. Source mode fails rather than silently falling back when the graph-editor checkout is missing.
