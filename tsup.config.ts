import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { defineConfig } from "tsup";

const require = createRequire(import.meta.url);
export default defineConfig({
  noExternal: [/typescript\/lib\/.*\?raw$/],
  esbuildPlugins: [
    {
      name: "typescript-library-text",
      setup(build) {
        build.onResolve({ filter: /\?raw$/ }, (args) => ({
          path: require.resolve(args.path.slice(0, -4)),
          namespace: "library-text",
        }));
        build.onLoad({ filter: /.*/, namespace: "library-text" }, async (args) => ({
          contents: await readFile(args.path, "utf8"),
          loader: "text",
        }));
      },
    },
  ],
});
