# Contributing

## Setup

Use the latest stable Bun.

```sh
bun install --frozen-lockfile
```

Local development may resolve sibling package source through Vite/Vitest aliases. Owner packages
without a registry release, such as `@moritzbrantner/graph-editor`, are commit-pinned git
dependencies (`git+https://github.com/moritzbrantner/<repo>.git#<sha>`) listed in
`trustedDependencies`; other dependencies use installable semver ranges.

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
bun run verify:git-install
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

## Changelog and Releases

The package is not published to npm; consumers pin a commit from `main` as a git dependency, and
the `prepare` script builds `dist` during that install. Record user-visible package changes in
`CHANGELOG.md` under `Unreleased`.

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

Restricted local containers may provide a compatible Chromium executable with
`WORKFLOW_EDITOR_CHROMIUM_EXECUTABLE_PATH`. If the container cannot create Chromium's
process sockets, set `WORKFLOW_EDITOR_CHROMIUM_SINGLE_PROCESS=1`. CI continues to use
the Playwright-managed browser and normal multi-process launch.
