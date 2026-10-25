import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Architecture ratchet (#48): workflow node content is composed through graph-editor's public
// seams (body, minimized content, port content, title, menu, width and minimized layout), never by
// patching graph-editor's internal DOM with generated CSS or positioning content over nodes.

const sourceRoot = resolve(process.cwd(), "src");
const sources = [
  join(sourceRoot, "react.tsx"),
  ...readdirSync(join(sourceRoot, "react"))
    .filter((name) => /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name))
    .map((name) => join(sourceRoot, "react", name)),
];

const forbidden: Array<[RegExp, string]> = [
  [/div\.grid:not\(\[data-slot\]\)/, "selector on graph-editor's unnamed port grid"],
  [/:nth-of-type\(/, "positional selector into graph-editor node internals"],
  [/data-slot=\\?["']workflow-node\\?["']\]\[data-minimized/, "CSS patch for minimized nodes"],
  [/data-slot='workflow-node'\]\[data-minimized/, "class patch for minimized nodes"],
  [/workflow-node-minimized-ports/, "patch of graph-editor's minimized port layer"],
  [/!important/, "!important override of graph-editor styles"],
  [/useWorkflowWorkbenchNodeElementMap/, "node element map for portal-positioned content"],
  [/get\w*Node\w*Offset\(\s*node,\s*target/, "content offset measured from a node element"],
  // #43: edge color and node stacking come from graph-editor (graph-editor#85), not generated CSS.
  [/<style\b/, "generated stylesheet patching graph-editor's canvas DOM"],
  [/\]:!/, "Tailwind important override of graph-editor styles"],
  [/data-compact=\\?["']true\\?["']\]/, "class patch for compact nodes"],
];

describe("workflow node composition ratchet (#48)", () => {
  it.each(sources.map((file) => [file.slice(sourceRoot.length + 1), file]))(
    "%s uses graph-editor seams instead of internal DOM patches",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      const violations = forbidden
        .filter(([pattern]) => pattern.test(source))
        .map(([, reason]) => reason);
      expect(violations).toEqual([]);
    },
  );
});
