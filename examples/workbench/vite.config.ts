import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const exampleDir = fileURLToPath(new URL("./", import.meta.url));
const rootDir = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  root: exampleDir,
  base: "./",
  plugins: [tailwindcss()],
  build: {
    // The demo intentionally bundles the local editor, UI kit, and example data in one app.
    chunkSizeWarningLimit: 700,
  },
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
        find: "@moritzbrantner/workflow-editor",
        replacement: path.resolve(rootDir, "src/index.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/core",
        replacement: path.resolve(rootDir, "src/core.ts"),
      },
      {
        find: "@moritzbrantner/workflow-editor/react",
        replacement: path.resolve(rootDir, "src/react.tsx"),
      },
    ],
  },
});
