import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));
const workerCount = parseWorkerCount(
  process.env.WORKFLOW_EDITOR_TEST_WORKERS ?? process.env.WORKFLOW_EDITOR_WORKERS,
  1,
);

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@moritzbrantner/workflow-editor/core",
        replacement: path.resolve(rootDir, "src/core.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/editor",
        replacement: path.resolve(rootDir, "src/editor.tsx"),
      },
      {
        find: "@moritzbrantner/workflow-editor/history",
        replacement: path.resolve(rootDir, "src/history.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/layout",
        replacement: path.resolve(rootDir, "src/layout.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/persistence",
        replacement: path.resolve(rootDir, "src/persistence.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/react",
        replacement: path.resolve(rootDir, "src/react.tsx"),
      },
      {
        find: "@moritzbrantner/workflow-editor/share",
        replacement: path.resolve(rootDir, "src/share.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor",
        replacement: path.resolve(rootDir, "src/index.ts"),
      },
    ],
  },
  test: {
    benchmark: {
      include: [
        "src/**/*.bench.{ts,tsx}",
        "src/**/*.benchmark.{ts,tsx}",
        "benchmarks/**/*.{ts,tsx}",
      ],
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "src/.storybook/**",
        "src/**/*.e2e.*",
        "src/react.e2e-app/**",
        "storybook-static/**",
        "dist/**",
        "coverage/**",
        "examples/**",
      ],
    },
    environment: "jsdom",
    fileParallelism: false,
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    maxConcurrency: 1,
    maxWorkers: workerCount,
  },
});

function parseWorkerCount(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
