import { describe, expect, it } from "vitest";

import { diffWorkflowEditorDocuments, type WorkflowEditorDocument } from "./core";

const base: WorkflowEditorDocument = {
  typeDeclarations: "type A = string;",
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [
    {
      id: "a",
      label: "A",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
      data: { request: { url: "https://a", token: "s3cr3t" } },
    },
    {
      id: "b",
      label: "B",
      x: 200,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
      workflowRef: { documentId: "child" },
    },
    {
      id: "c",
      label: "C",
      x: 400,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
      composition: {
        nodes: [{ id: "inner", label: "Inner", x: 0, y: 0 }],
        edges: [],
        inputBoundaries: [],
        outputBoundaries: [],
      },
    },
  ],
  edges: [
    { id: "e", sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" },
  ],
  groups: [{ id: "g", label: "G", nodeIds: ["a", "b"] }],
};

function edit(change: (document: WorkflowEditorDocument) => void) {
  const next = structuredClone(base);
  change(next);
  return next;
}

describe("diffWorkflowEditorDocuments", () => {
  it("reports nothing for identical documents and never mutates inputs", () => {
    const snapshot = structuredClone(base);
    expect(diffWorkflowEditorDocuments(base, structuredClone(base)).entries).toEqual([]);
    expect(base).toEqual(snapshot);
  });

  it("matches by id and reports rewiring, deletion, type, nested reference and composition changes", () => {
    const after = edit((document) => {
      document.edges[0]!.targetNodeId = "c";
      document.nodes[1]!.workflowRef = { documentId: "other" };
      document.nodes[0]!.outputs![0]!.type = { kind: "number" };
      document.nodes[2]!.composition!.nodes[0]!.label = "Inner 2";
      document.nodes.push({ id: "d", label: "D", x: 0, y: 200 });
      document.groups = [];
      document.typeDeclarations = "type A = number;";
    });
    const diff = diffWorkflowEditorDocuments(base, after);
    expect(diff.entries.map((entry) => [entry.entity, entry.change, entry.id])).toEqual([
      ["port", "changed", "a.outputs.out"],
      ["node", "changed", "b"],
      ["node", "changed", "c"],
      ["node", "added", "d"],
      ["edge", "changed", "e"],
      ["group", "removed", "g"],
      ["document", "changed", "document"],
    ]);
    const fields = (id: string) => diff.entries.find((entry) => entry.id === id)?.fields;
    expect(fields("a.outputs.out")).toEqual([
      { path: "type.kind", before: "string", after: "number" },
    ]);
    expect(fields("b")).toEqual([
      { path: "workflowRef.documentId", before: "child", after: "other" },
    ]);
    expect(fields("c")).toEqual([
      { path: "composition.nodes[id=inner].label", before: "Inner", after: "Inner 2" },
    ]);
    expect(fields("e")).toEqual([{ path: "targetNodeId", before: "b", after: "c" }]);
    expect(diff.summary).toEqual({ added: 1, removed: 1, changed: 5, moved: 0 });
    expect(diff.changedNodeIds.sort()).toEqual(["a", "b", "c", "d"]);
    expect(diff.changedEdgeIds).toEqual(["e"]);
  });

  it("includes, summarizes or ignores layout-only changes", () => {
    const after = edit((document) => {
      document.nodes[0]!.x = 50;
      document.viewport = { x: 10, y: 0, zoom: 1 };
    });
    expect(
      diffWorkflowEditorDocuments(base, after).entries.map((entry) => [entry.change, entry.id]),
    ).toEqual([
      ["moved", "a"],
      ["moved", "viewport"],
    ]);
    expect(diffWorkflowEditorDocuments(base, after, { positions: "summarize" })).toMatchObject({
      entries: [],
      summary: { moved: 1 },
    });
    expect(diffWorkflowEditorDocuments(base, after, { positions: "ignore" })).toMatchObject({
      entries: [],
      summary: { moved: 0 },
    });
  });

  it("redacts secret-like fields by default and follows a host redaction policy", () => {
    const after = edit((document) => {
      (document.nodes[0]!.data as { request: { token: string; url: string } }).request = {
        token: "n3w",
        url: "https://b",
      };
    });
    expect(diffWorkflowEditorDocuments(base, after).entries[0]?.fields).toEqual([
      { path: "data.request.token", before: "[redacted]", after: "[redacted]", redacted: true },
      { path: "data.request.url", before: "https://a", after: "https://b" },
    ]);
    expect(
      diffWorkflowEditorDocuments(base, after, { redact: (path) => path.endsWith("url") })
        .entries[0]?.fields,
    ).toEqual([
      { path: "data.request.token", before: "s3cr3t", after: "n3w" },
      { path: "data.request.url", before: "[redacted]", after: "[redacted]", redacted: true },
    ]);
  });
});
