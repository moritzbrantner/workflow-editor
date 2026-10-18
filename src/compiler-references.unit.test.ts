import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  compileWorkflowEditorDocument,
  compiledWorkflowReferenceVersion,
  type CompiledWorkflowV3,
} from "./compiler";
import type { WorkflowEditorDocument, WorkflowEditorNode } from "./core";
import {
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  createWorkflowEditorLibraryReferenceResolver,
} from "./persistence";

const number = { kind: "typescript", source: "number" } as const;

const start = (ports: string[]): WorkflowEditorNode => ({
  id: "start",
  label: "Start",
  kind: "control.start",
  x: 0,
  y: 0,
  outputs: ports.map((id) => ({ id, label: id, type: number })),
});
const end = (ports: string[]): WorkflowEditorNode => ({
  id: "end",
  label: "End",
  kind: "control.end",
  x: 600,
  y: 0,
  inputs: ports.map((id) => ({ id, label: id, type: number })),
});
const call = (id: string, documentId: string, maxDepth?: number): WorkflowEditorNode => ({
  id,
  label: `Call ${documentId}`,
  kind: "workflow.call",
  x: 300,
  y: 0,
  inputs: [{ id: "n", label: "n", type: number }],
  outputs: [{ id: "result", label: "result", type: number }],
  workflowRef: { documentId, ...(maxDepth === undefined ? {} : { maxDepth }) },
});
const link = (
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
) => ({
  id: `${sourceNodeId}.${sourcePortId}-${targetNodeId}.${targetPortId}`,
  sourceNodeId,
  sourcePortId,
  targetNodeId,
  targetPortId,
});

/** n → call(child) → result, where the child doubles n. */
function callerDocument(target: string, maxDepth?: number): WorkflowEditorDocument {
  return {
    nodes: [start(["n"]), call("call", target, maxDepth), end(["result"])],
    edges: [link("start", "n", "call", "n"), link("call", "result", "end", "result")],
  };
}

function leafDocument(): WorkflowEditorDocument {
  return {
    nodes: [
      start(["n"]),
      {
        id: "double",
        label: "Double",
        kind: "math.double",
        x: 300,
        y: 0,
        inputs: [{ id: "in", label: "in", type: number }],
        outputs: [{ id: "out", label: "out", type: number }],
      },
      end(["result"]),
    ],
    edges: [link("start", "n", "double", "in"), link("double", "out", "end", "result")],
  };
}

function library(documents: Record<string, WorkflowEditorDocument>) {
  return createWorkflowEditorLibrary({
    documents: Object.entries(documents).map(([id, document]) =>
      createWorkflowEditorEntry({ id, name: id, createdAt: "2026-10-18T00:00:00.000Z", document }),
    ),
  });
}

function compile(root: WorkflowEditorDocument, documents: Record<string, WorkflowEditorDocument>) {
  return compileWorkflowEditorDocument(root, {
    resolveWorkflowReference: createWorkflowEditorLibraryReferenceResolver(library(documents)),
  }) as CompiledWorkflowV3;
}

function diagnosticCodes(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return (error as { diagnostics: Array<{ code: string; path: string }> }).diagnostics.map(
      (diagnostic) => [diagnostic.code, diagnostic.path],
    );
  }
  return [];
}

describe("compiled Workflow References (TECH-005, v3)", () => {
  it("freezes the referenced definition with its start/end interface", () => {
    const compiled = compile(callerDocument("child"), { child: leafDocument() });
    expect(compiled.version).toBe(compiledWorkflowReferenceVersion);
    expect(compiled.nodes.find((node) => node.id === "call")).toMatchObject({
      workflowRef: { workflow: "child@1" },
    });
    expect(Object.keys(compiled.workflows)).toEqual(["child@1"]);
    expect(compiled.workflows["child@1"]).toMatchObject({
      id: "child",
      version: 1,
      order: ["start", "double", "end"],
      interface: {
        inputs: [{ id: "n", nodeId: "start", portId: "n", type: number }],
        outputs: [{ id: "result", nodeId: "end", portId: "result", type: number }],
      },
    });
    expect(compile(callerDocument("child"), { child: leafDocument() })).toEqual(compiled);
  });

  it("includes a diamond closure once", () => {
    const root: WorkflowEditorDocument = {
      nodes: [start(["n"]), call("b", "B"), { ...call("c", "C"), y: 200 }, end(["result"])],
      edges: [
        link("start", "n", "b", "n"),
        link("start", "n", "c", "n"),
        link("b", "result", "end", "result"),
      ],
    };
    const compiled = compile(root, {
      B: callerDocument("D"),
      C: callerDocument("D"),
      D: leafDocument(),
    });
    expect(Object.keys(compiled.workflows)).toEqual(["B@1", "C@1", "D@1"]);
  });

  it("keeps bounded recursion finite and rejects unbounded recursion", () => {
    const bounded = compile(callerDocument("self", 4), { self: callerDocument("self", 4) });
    expect(Object.keys(bounded.workflows)).toEqual(["self@1"]);
    expect(bounded.workflows["self@1"]!.nodes.find((node) => node.id === "call")).toMatchObject({
      workflowRef: { workflow: "self@1", maxDepth: 4 },
    });
    expect(
      diagnosticCodes(() => compile(callerDocument("self"), { self: callerDocument("self") })),
    ).toEqual([["unbounded-recursive-reference", "workflows.self@1.nodes.call.workflowRef"]]);
    // A two-document cycle is bounded by a bound on either reference.
    expect(() =>
      compile(callerDocument("a"), { a: callerDocument("b", 2), b: callerDocument("a") }),
    ).not.toThrow();
  });

  it("reports missing references and interface mismatches with source paths", () => {
    expect(diagnosticCodes(() => compile(callerDocument("gone"), {}))).toEqual([
      ["missing-workflow-reference", "nodes.call.workflowRef"],
    ]);
    const wrongInterface: WorkflowEditorDocument = {
      ...leafDocument(),
      nodes: leafDocument().nodes.map((node) =>
        node.id === "start"
          ? {
              ...node,
              outputs: [
                { id: "n", label: "n", type: { kind: "typescript" as const, source: "string" } },
                { id: "extra", label: "extra", type: number },
              ],
            }
          : node.id === "end"
            ? { ...node, inputs: [{ id: "total", label: "total", type: number }] }
            : node,
      ),
      edges: [],
    };
    expect(
      diagnosticCodes(() => compile(callerDocument("child"), { child: wrongInterface })),
    ).toEqual([
      ["workflow-reference-interface", "nodes.call.inputs.n"],
      ["workflow-reference-interface", "nodes.call.inputs.extra"],
      ["workflow-reference-interface", "nodes.call.outputs.result"],
    ]);
  });

  it("keeps compiling without a resolver exactly as before", () => {
    expect(diagnosticCodes(() => compileWorkflowEditorDocument(callerDocument("child")))).toEqual([
      ["nested-workflow-not-supported", "nodes.call.workflowRef"],
    ]);
    expect(compile(leafDocument(), {}).version).toBe(1);
  });

  it("matches the shared v3 fixture", () => {
    const compiled = compile(callerDocument("countdown", 5), {
      countdown: callerDocument("countdown", 5),
    });
    expect(compiled).toEqual(
      JSON.parse(
        readFileSync(
          resolve(process.cwd(), "fixtures/compiled-v3-workflow-references.json"),
          "utf8",
        ),
      ),
    );
  });
});

export { callerDocument, library };
