import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));
const workerCount = parseWorkerCount(process.env.WORKFLOW_EDITOR_TEST_WORKERS, 1);

export default defineConfig({
  resolve: {
    alias: {
      "@moritzbrantner/workflow-editor": path.resolve(rootDir, "src/index.ts"),
      "@moritzbrantner/workflow-editor/core": path.resolve(rootDir, "src/core.ts"),
      "@moritzbrantner/workflow-editor/editor": path.resolve(rootDir, "src/editor.tsx"),
      "@moritzbrantner/workflow-editor/history": path.resolve(rootDir, "src/history.ts"),
      "@moritzbrantner/workflow-editor/layout": path.resolve(rootDir, "src/layout.ts"),
      "@moritzbrantner/workflow-editor/persistence": path.resolve(rootDir, "src/persistence.ts"),
      "@moritzbrantner/workflow-editor/react": path.resolve(rootDir, "src/react.tsx"),
      "@moritzbrantner/workflow-editor/share": path.resolve(rootDir, "src/share.ts"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "dist/**",
        "coverage/**",
        "examples/**",
        "tests/playwright/**",
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
