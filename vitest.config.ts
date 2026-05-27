import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL("./", import.meta.url));

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
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
