import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";

const rootDir = fileURLToPath(new URL("../../", import.meta.url));

const config: StorybookConfig = {
  stories: ["../**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  docs: {
    autodocs: "tag",
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
    resolve: {
      ...viteConfig.resolve,
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
        ...(Array.isArray(viteConfig.resolve?.alias) ? viteConfig.resolve.alias : []),
      ],
    },
  }),
};

export default config;
