import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileWorkflowEditorDocument,
  createCompiledWorkflowSourceMap,
  expandWorkflowEditorCompositions,
  serializeCompiledWorkflow,
  type CompiledWorkflow,
} from "./compiler";
import type { WorkflowEditorDocument, WorkflowEditorNode } from "./core";

const number = { kind: "typescript", source: "number" } as const;
const unary = (id: string, kind: string, x = 0): WorkflowEditorNode => ({
  id,
  label: id,
  kind,
  x,
  y: 0,
  inputs: [{ id: "in", label: "in", type: number }],
  outputs: [{ id: "out", label: "out", type: number }],
});
const link = (id: string, from: [string, string], to: [string, string]) => ({
  id,
  sourceNodeId: from[0],
  sourcePortId: from[1],
  targetNodeId: to[0],
  targetPortId: to[1],
});

/** in → double → inc → out, wrapped as one composed node. */
function composed(id = "pair", inner?: WorkflowEditorNode): WorkflowEditorNode {
  const first = inner ?? unary("double", "math.double");
  return {
    ...unary(id, "composed", 300),
    composition: {
      nodes: [first, unary("inc", "math.increment", 200)],
      edges: [link("step", [first.id, "out"], ["inc", "in"])],
      inputBoundaries: [{ wrapperPortId: "in", nodeId: first.id, portId: "in" }],
      outputBoundaries: [{ wrapperPortId: "out", nodeId: "inc", portId: "out" }],
    },
  };
}

function documentWith(node: WorkflowEditorNode): WorkflowEditorDocument {
  return {
    nodes: [
      {
        id: "start",
        label: "Start",
        kind: "control.start",
        x: 0,
        y: 0,
        outputs: [{ id: "n", label: "n", type: number }],
      },
      node,
      {
        id: "end",
        label: "End",
        kind: "control.end",
        x: 600,
        y: 0,
        inputs: [{ id: "result", label: "result", type: number }],
      },
    ],
    edges: [
      link("feed", ["start", "n"], [node.id, "in"]),
      link("drain", [node.id, "out"], ["end", "result"]),
    ],
  };
}

function codes(run: () => unknown) {
  try {
    run();
    return [];
  } catch (error) {
    return (error as { diagnostics: Array<{ code: string; path: string }> }).diagnostics.map(
      (diagnostic) => [diagnostic.code, diagnostic.path],
    );
  }
}

describe("composed node compilation modes (#19)", () => {
  it("rejects composed nodes by default, as before", () => {
    expect(codes(() => compileWorkflowEditorDocument(documentWith(composed())))).toEqual([
      ["composition-not-supported", "nodes.pair.composition"],
    ]);
  });

  it("keeps a composed node as one opaque node", () => {
    const compiled = compileWorkflowEditorDocument(documentWith(composed()), {
      compositions: "opaque",
    });
    expect(compiled.order).toEqual(["start", "pair", "end"]);
    expect(compiled.nodes.find((node) => node.id === "pair")).toEqual(
      expect.objectContaining({ id: "pair", kind: "composed" }),
    );
    expect(JSON.stringify(compiled)).not.toContain("math.double");
  });

  it("expands composed nodes into addressed subgraphs with rewired connections", () => {
    const compiled = compileWorkflowEditorDocument(documentWith(composed()), {
      compositions: "expand",
    });
    expect(compiled.version).toBe(1);
    expect(compiled.order).toEqual(["start", "pair/double", "pair/inc", "end"]);
    expect(compiled.edges).toEqual([
      link("drain", ["pair/inc", "out"], ["end", "result"]),
      link("feed", ["start", "n"], ["pair/double", "in"]),
      link("pair/step", ["pair/double", "out"], ["pair/inc", "in"]),
    ]);
    const sourceMap = createCompiledWorkflowSourceMap(compiled);
    expect(sourceMap.nodes["pair/double"]).toEqual({
      path: "nodes.pair.composition.nodes.double",
      id: "double",
    });
    expect(sourceMap.edges["pair/step"]).toEqual({
      path: "nodes.pair.composition.edges.step",
      id: "step",
    });
  });

  it("expands nested composed nodes, fans one wrapper input out to several boundaries", () => {
    const outer = composed("outer", composed("inner"));
    outer.composition!.inputBoundaries.push({ wrapperPortId: "in", nodeId: "inc", portId: "in" });
    outer.composition!.edges = [];
    const compiled = compileWorkflowEditorDocument(documentWith(outer), { compositions: "expand" });
    expect(compiled.order).toEqual(
      expect.arrayContaining(["outer/inner/double", "outer/inner/inc", "outer/inc"]),
    );
    expect(compiled.edges.filter((edge) => edge.id.startsWith("feed"))).toEqual([
      link("feed", ["start", "n"], ["outer/inner/double", "in"]),
      link("feed#1", ["start", "n"], ["outer/inc", "in"]),
    ]);
    expect(createCompiledWorkflowSourceMap(compiled).nodes["outer/inner/double"]?.path).toBe(
      "nodes.outer.composition.nodes.inner.composition.nodes.double",
    );
  });

  it("type-checks rewired connections against the inner ports", () => {
    const pair = composed();
    pair.composition!.nodes[0]!.inputs = [
      { id: "in", label: "in", type: { kind: "typescript", source: "string" } },
    ];
    expect(
      codes(() => compileWorkflowEditorDocument(documentWith(pair), { compositions: "expand" })),
    ).toEqual([["invalid-port-type", "edges.feed"]]);
  });

  it("expands composed nodes inside iteration bodies (#97)", () => {
    const loop: WorkflowEditorNode = {
      id: "loop",
      label: "Repeat",
      kind: "control.iterate",
      x: 300,
      y: 0,
      inputs: [{ id: "state", label: "State", type: number }],
      outputs: [
        {
          id: "result",
          label: "Result",
          type: {
            kind: "typescript",
            source:
              '{ value: number; status: "converged" | "limit-exhausted"; iterations: number }',
          },
        },
      ],
      data: { iteration: { maxIterations: 4 } },
      composition: {
        nodes: [composed()],
        edges: [],
        inputBoundaries: [{ wrapperPortId: "state", nodeId: "pair", portId: "in" }],
        outputBoundaries: [{ wrapperPortId: "next", nodeId: "pair", portId: "out" }],
      },
    };
    const document: WorkflowEditorDocument = {
      nodes: [
        documentWith(loop).nodes[0]!,
        loop,
        {
          ...documentWith(loop).nodes[2]!,
          inputs: [
            { id: "result", label: "result", type: { kind: "typescript", source: "unknown" } },
          ],
        },
      ],
      edges: [
        link("feed", ["start", "n"], ["loop", "state"]),
        link("drain", ["loop", "result"], ["end", "result"]),
      ],
    };

    expect(codes(() => compileWorkflowEditorDocument(document))).toEqual([
      ["composition-not-supported", "nodes.loop.composition.nodes.pair.composition"],
    ]);
    const compiled = compileWorkflowEditorDocument(document, {
      compositions: "expand",
    }) as CompiledWorkflow & {
      nodes: Array<{
        id: string;
        iteration?: { body: { order: string[]; inputs: unknown; outputs: unknown } };
      }>;
    };
    const body = compiled.nodes.find((node) => node.id === "loop")!.iteration!.body;
    expect(body.order).toEqual(["pair/double", "pair/inc"]);
    expect(body.inputs).toEqual([{ id: "state", nodeId: "pair/double", portId: "in" }]);
    expect(body.outputs).toEqual({ next: { nodeId: "pair/inc", portId: "out" } });
    expect(createCompiledWorkflowSourceMap(compiled).nodes["loop/pair/double"]?.path).toBe(
      "nodes.loop.composition.nodes.pair.composition.nodes.double",
    );
  });

  it("is deterministic and leaves the document untouched", () => {
    const document = documentWith(composed());
    const snapshot = JSON.stringify(document);
    const first = serializeCompiledWorkflow(
      compileWorkflowEditorDocument(document, { compositions: "expand" }),
    );
    expect(
      serializeCompiledWorkflow(
        compileWorkflowEditorDocument(document, { compositions: "expand" }),
      ),
    ).toBe(first);
    expect(JSON.stringify(document)).toBe(snapshot);
    expect(expandWorkflowEditorCompositions(documentWith(unary("plain", "math.double")))).toEqual(
      documentWith(unary("plain", "math.double")),
    );
  });

  it("matches the shared expanded-composition fixture", () => {
    const outer = composed("outer", composed("inner"));
    expect(compileWorkflowEditorDocument(documentWith(outer), { compositions: "expand" })).toEqual(
      JSON.parse(
        readFileSync(resolve(process.cwd(), "fixtures/compiled-v1-composed-expanded.json"), "utf8"),
      ),
    );
  });

  it("compiles a large layered workflow deterministically", () => {
    const width = 20;
    const depth = 25;
    const nodes: WorkflowEditorNode[] = [];
    const edges: ReturnType<typeof link>[] = [];
    for (let layer = 0; layer < depth; layer += 1) {
      for (let column = 0; column < width; column += 1) {
        const id = `n-${layer}-${column}`;
        nodes.push(unary(id, layer % 5 === 4 ? "math.increment" : "math.double", layer * 200));
        if (layer > 0) {
          edges.push(
            link(
              `e-${layer}-${column}`,
              [`n-${layer - 1}-${(column * 7) % width}`, "out"],
              [id, "in"],
            ),
          );
        }
      }
    }
    const document: WorkflowEditorDocument = { nodes, edges };
    const shuffled: WorkflowEditorDocument = {
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse(),
    };
    const compiled = compileWorkflowEditorDocument(document);
    expect(compiled.order).toHaveLength(width * depth);
    expect(serializeCompiledWorkflow(compileWorkflowEditorDocument(shuffled))).toBe(
      serializeCompiledWorkflow(compiled),
    );
  });
});
export { composed, documentWith };
