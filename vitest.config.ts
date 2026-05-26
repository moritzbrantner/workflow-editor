import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@moritzbrantner/workflow-editor": path.resolve(rootDir, "src/index.ts"),
      "@moritzbrantner/workflow-editor/core": path.resolve(rootDir, "src/core.ts"),
      "@moritzbrantner/workflow-editor/react": path.resolve(rootDir, "src/react.tsx"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
