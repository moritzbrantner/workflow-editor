import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  compileWorkflowEditorDocument,
  createCompiledWorkflowReport,
  createCompiledWorkflowSourceMap,
  fingerprintCompiledWorkflow,
  getCompiledWorkflowStages,
  serializeCompiledWorkflow,
  type CompiledWorkflow,
} from "./compiler";
import type { WorkflowEditorDocument } from "./core-types";

const port = (id: string) => ({ id, label: id, type: { kind: "string" as const } });

const diamond: WorkflowEditorDocument = {
  nodes: [
    { id: "a", label: "A", kind: "task", x: 0, y: 0, outputs: [port("out")] },
    { id: "b", label: "B", kind: "task", x: 0, y: 0, inputs: [port("in")], outputs: [port("out")] },
    { id: "c", label: "C", kind: "task", x: 0, y: 0, inputs: [port("in")], outputs: [port("out")] },
    {
      id: "d",
      label: "D",
      kind: "task",
      x: 0,
      y: 0,
      inputs: [port("left"), port("right")],
      data: { mode: "join", options: { strict: true, retries: 2 } },
    },
  ],
  edges: [
    { id: "ab", sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" },
    { id: "ac", sourceNodeId: "a", sourcePortId: "out", targetNodeId: "c", targetPortId: "in" },
    { id: "bd", sourceNodeId: "b", sourcePortId: "out", targetNodeId: "d", targetPortId: "left" },
    { id: "cd", sourceNodeId: "c", sourcePortId: "out", targetNodeId: "d", targetPortId: "right" },
  ],
};

describe("compiled workflow report", () => {
  it("serializes semantically identical documents byte-identically", () => {
    const reordered: WorkflowEditorDocument = {
      viewport: { x: 40, y: 10, zoom: 2 },
      edges: [...diamond.edges].reverse(),
      nodes: [...diamond.nodes].reverse().map((node, index) => ({
        ...node,
        x: index * 100,
        data: node.data ? { options: { retries: 2, strict: true }, mode: "join" } : undefined,
      })),
    };

    const first = createCompiledWorkflowReport(compileWorkflowEditorDocument(diamond));
    const second = createCompiledWorkflowReport(compileWorkflowEditorDocument(reordered));

    expect(second.canonicalJson).toBe(first.canonicalJson);
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(first.fingerprint).toBe(
      `sha256:${createHash("sha256").update(first.canonicalJson).digest("hex")}`,
    );
    expect(first.canonicalJson).not.toMatch(/\s/);
  });

  it("changes the fingerprint when executable content changes", () => {
    const changed = {
      ...diamond,
      nodes: diamond.nodes.map((node) =>
        node.id === "d" ? { ...node, data: { mode: "first" } } : node,
      ),
    };

    expect(fingerprintCompiledWorkflow(compileWorkflowEditorDocument(changed))).not.toBe(
      fingerprintCompiledWorkflow(compileWorkflowEditorDocument(diamond)),
    );
  });

  it("hashes non-ASCII content consistently with SHA-256", () => {
    const workflow = compileWorkflowEditorDocument({
      nodes: [{ id: "ü", label: "Größe 📦", kind: "task", x: 0, y: 0 }],
      edges: [],
    });
    const json = serializeCompiledWorkflow(workflow);

    expect(fingerprintCompiledWorkflow(workflow)).toBe(
      `sha256:${createHash("sha256").update(json).digest("hex")}`,
    );
  });

  it("groups nodes into deterministic dependency stages", () => {
    expect(getCompiledWorkflowStages(compileWorkflowEditorDocument(diamond))).toEqual([
      ["a"],
      ["b", "c"],
      ["d"],
    ]);
  });

  it("maps compiled nodes and edges, including iteration bodies, to document paths", () => {
    const fixture = JSON.parse(
      readFileSync(resolve(process.cwd(), "fixtures/compiled-v2-bounded-iteration.json"), "utf8"),
    ) as CompiledWorkflow;
    const sourceMap = createCompiledWorkflowSourceMap(fixture);

    expect(sourceMap.nodes.refine).toEqual({ path: "nodes.refine", id: "refine" });
    expect(sourceMap.nodes["refine/newton-step"]).toEqual({
      path: "nodes.refine.composition.nodes.newton-step",
      id: "newton-step",
      parent: "refine",
    });
    expect(sourceMap.edges["refine/step-next"]).toEqual({
      path: "nodes.refine.composition.edges.step-next",
      id: "step-next",
      parent: "refine",
    });
    expect(sourceMap.edges["guess-state"]?.path).toBe("edges.guess-state");
    expect(Object.keys(sourceMap.nodes)).toHaveLength(6);
  });

  it("leaves the compiled artifact unchanged", () => {
    const workflow = compileWorkflowEditorDocument(diamond);
    const before = JSON.stringify(workflow);
    createCompiledWorkflowReport(workflow);

    expect(JSON.stringify(workflow)).toBe(before);
    expect(Object.keys(workflow)).not.toContain("fingerprint");
  });
});
