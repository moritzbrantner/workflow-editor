import { describe, expect, it } from "vitest";

import {
  createWorkflowEditorIterationNode,
  findWorkflowEditorIterationBodyNode,
  getWorkflowEditorIterationBodyDocument,
  setWorkflowEditorIterationBodyDocument,
  updateWorkflowEditorIterationBoundaries,
  validateWorkflowEditorIterationNode,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
} from "./core";

const num = { kind: "typescript", source: "number" } as const;
const step: WorkflowEditorNode = {
  id: "step",
  label: "Step",
  kind: "math.step",
  x: 0,
  y: 0,
  inputs: [{ id: "in", label: "In", type: num }],
  outputs: [{ id: "out", label: "Out", type: num }],
};

function iteration(id: string, body: WorkflowEditorNode[] = []) {
  return createWorkflowEditorIterationNode({
    id,
    label: id,
    x: 0,
    y: 0,
    stateType: num,
    maxIterations: 3,
    body: { nodes: body, edges: [], inputBoundaries: [], outputBoundaries: [] },
  });
}

function documentWith(...nodes: WorkflowEditorNode[]): WorkflowEditorDocument {
  return { nodes, edges: [], typeDeclarations: "type N = number;" };
}

describe("iteration body views (#94)", () => {
  it("projects a body to a document and writes edits back into the parent", () => {
    const document = documentWith(iteration("loop"));
    const body = getWorkflowEditorIterationBodyDocument(document, ["loop"])!;
    expect(body).toEqual({ nodes: [], edges: [], typeDeclarations: "type N = number;" });

    const edited = setWorkflowEditorIterationBodyDocument(document, ["loop"], {
      ...body,
      nodes: [step],
    });
    expect(findWorkflowEditorIterationBodyNode(edited, ["loop"])?.composition?.nodes).toEqual([
      step,
    ]);
    expect(document.nodes[0]!.composition?.nodes).toEqual([]);
  });

  it("resolves nested bodies and rejects paths through non-iteration nodes", () => {
    const document = documentWith(iteration("outer", [iteration("inner", [step])]));
    expect(getWorkflowEditorIterationBodyDocument(document, ["outer", "inner"])?.nodes).toEqual([
      step,
    ]);
    expect(findWorkflowEditorIterationBodyNode(document, ["outer", "missing"])).toBeUndefined();
    expect(findWorkflowEditorIterationBodyNode(documentWith(step), ["step"])).toBeUndefined();

    const edited = setWorkflowEditorIterationBodyDocument(document, ["outer", "inner"], {
      nodes: [],
      edges: [],
    });
    expect(
      findWorkflowEditorIterationBodyNode(edited, ["outer", "inner"])?.composition?.nodes,
    ).toEqual([]);
  });

  it("edits boundaries until the iteration validates, and prunes boundaries of removed nodes", () => {
    let document = documentWith(iteration("loop", [step]));
    document = updateWorkflowEditorIterationBoundaries(document, ["loop"], {
      inputBoundaries: [{ wrapperPortId: "state", nodeId: "step", portId: "in" }],
      outputBoundaries: [{ wrapperPortId: "next", nodeId: "step", portId: "out" }],
    });
    expect(validateWorkflowEditorIterationNode(document.nodes[0]!)).toEqual([]);

    document = setWorkflowEditorIterationBodyDocument(document, ["loop"], {
      nodes: [],
      edges: [],
    });
    expect(document.nodes[0]!.composition).toMatchObject({
      inputBoundaries: [],
      outputBoundaries: [],
    });
    expect(validateWorkflowEditorIterationNode(document.nodes[0]!).map((d) => d.code)).toContain(
      "iteration-body-missing",
    );
  });

  it("writes type declarations edited in the body view to the parent document", () => {
    const document = documentWith(iteration("loop"));
    const edited = setWorkflowEditorIterationBodyDocument(document, ["loop"], {
      nodes: [],
      edges: [],
      typeDeclarations: "type M = string;",
    });
    expect(edited.typeDeclarations).toBe("type M = string;");
  });
});
