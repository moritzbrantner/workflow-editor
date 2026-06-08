# Contributing

## Setup

Use Bun `1.3.14`.

```sh
bun install --frozen-lockfile
```

Local development may resolve sibling package source through Vite/Vitest aliases, but published
package dependencies must use npm semver ranges.

## Common Commands

```sh
bun run dev
bun run format:check
bun run lint
bun run check-types
bun run check-types:tests
bun run test
bun run coverage:check
bun run test:playwright
bun run storybook:build
bun run example:build
bun run build
bun run api:check
bun run types:public
bun run smoke:package
bun run smoke:packed-consumer
bun run pack:check
```

Run the full local gate with:

```sh
bun run verify
```

Tests and benchmarks default to one worker to keep memory use predictable. Override with:

```sh
WORKFLOW_EDITOR_WORKERS=2 bun run test
WORKFLOW_EDITOR_TEST_WORKERS=2 bun run test
WORKFLOW_EDITOR_PLAYWRIGHT_WORKERS=2 bun run test:playwright
```

## Changesets

Add a changeset for user-visible package changes:

```sh
bun run changeset
```

Use `patch` for fixes, docs that affect package consumers, metadata, and internal refactors. Use
`minor` for additive public API or new user-facing behavior.

## Generated Files

Do not commit generated build or test output:

- `dist/`
- `coverage/`
- `playwright-report/`
- `test-results/`
- `storybook-static/`
- `*.tgz`

The API report in `etc/workflow-editor.api.md` is intentionally committed and must be updated when
public declarations change.
