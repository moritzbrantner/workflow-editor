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
        find: "react/jsx-dev-runtime",
        replacement: path.resolve(rootDir, "node_modules/react/jsx-dev-runtime.js"),
      },
      {
        find: "react/jsx-runtime",
        replacement: path.resolve(rootDir, "node_modules/react/jsx-runtime.js"),
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
        find: "react",
        replacement: path.resolve(rootDir, "node_modules/react/index.js"),
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
