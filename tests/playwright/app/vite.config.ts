import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL("../../../", import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@moritzbrantner/workflow-editor": path.resolve(rootDir, "src/index.ts"),
      "@moritzbrantner/workflow-editor/core": path.resolve(rootDir, "src/core.ts"),
      "@moritzbrantner/workflow-editor/react": path.resolve(rootDir, "src/react.tsx"),
    },
  },
});
