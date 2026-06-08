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
        find: "react/jsx-runtime",
        replacement: path.resolve(rootDir, "node_modules/react/jsx-runtime.js"),
      },
      {
        find: "react/jsx-dev-runtime",
        replacement: path.resolve(rootDir, "node_modules/react/jsx-dev-runtime.js"),
      },
      {
        find: "react",
        replacement: path.resolve(rootDir, "node_modules/react/index.js"),
      },
      {
        find: "react-dom/client",
        replacement: path.resolve(rootDir, "node_modules/react-dom/client.js"),
      },
      {
        find: "react-dom",
        replacement: path.resolve(rootDir, "node_modules/react-dom/index.js"),
      },
      {
        find: "lucide-react",
        replacement: path.resolve(rootDir, "node_modules/lucide-react/dist/esm/lucide-react.mjs"),
      },
      {
        find: /^@moritzbrantner\/ui$/,
        replacement: path.resolve(rootDir, "node_modules/@moritzbrantner/ui/dist/index.js"),
      },
      {
        find: "@moritzbrantner/graph-editor/core",
        replacement: path.resolve(rootDir, "../graph-editor/src/core.ts"),
      },
      {
        find: "@moritzbrantner/graph-editor/layout",
        replacement: path.resolve(rootDir, "../graph-editor/src/layout.ts"),
      },
      {
        find: "@moritzbrantner/graph-editor/operations",
        replacement: path.resolve(rootDir, "../graph-editor/src/operations.ts"),
      },
      {
        find: "@moritzbrantner/graph-editor/react",
        replacement: path.resolve(rootDir, "../graph-editor/src/react.tsx"),
      },
      {
        find: "@moritzbrantner/graph-editor/runtime",
        replacement: path.resolve(rootDir, "../graph-editor/src/runtime.ts"),
      },
      {
        find: "@moritzbrantner/graph-editor",
        replacement: path.resolve(rootDir, "../graph-editor/src/index.ts"),
      },
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
      thresholds: {
        branches: 62,
        functions: 70,
        lines: 70,
        statements: 70,
      },
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
