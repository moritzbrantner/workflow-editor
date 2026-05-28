import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@moritzbrantner/workflow-editor/core",
        replacement: path.resolve(rootDir, "src/core.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/react",
        replacement: path.resolve(rootDir, "src/react.tsx"),
      },
      {
        find: "@moritzbrantner/workflow-editor",
        replacement: path.resolve(rootDir, "src/index.ts"),
      },
    ],
  },
});
