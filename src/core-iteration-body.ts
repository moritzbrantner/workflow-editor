import {
  isWorkflowEditorIterationNode,
  syncWorkflowEditorIterationResultPort,
} from "./core-iteration";
import type {
  WorkflowEditorCompositionBoundary,
  WorkflowEditorDocument,
  WorkflowEditorNode,
  WorkflowEditorNodeComposition,
} from "./core-types";

/**
 * Editing an iteration body in its own view (#94, Decision Atlas 5.25). A body is addressed by the
 * chain of iteration node ids from the owning document's top level (`["outer", "inner"]` is the
 * body of `inner`, which lives in the body of `outer`). The body is stored inside the parent
 * document; these helpers project it to an ordinary document and write edits back.
 */
export type WorkflowEditorIterationBodyPath = readonly string[];

export type WorkflowEditorIterationBoundaries = Pick<
  WorkflowEditorNodeComposition,
  "inputBoundaries" | "outputBoundaries"
>;

const emptyBody = <TNodeData>(): WorkflowEditorNodeComposition<TNodeData> => ({
  nodes: [],
  edges: [],
  inputBoundaries: [],
  outputBoundaries: [],
});

/** The iteration node a body path ends at, or `undefined` when the path no longer resolves. */
export function findWorkflowEditorIterationBodyNode<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  path: WorkflowEditorIterationBodyPath,
): WorkflowEditorNode<TNodeData> | undefined {
  let nodes: ReadonlyArray<WorkflowEditorNode<TNodeData>> = document.nodes;
  let found: WorkflowEditorNode<TNodeData> | undefined;
  for (const nodeId of path) {
    found = nodes.find((node) => node.id === nodeId);
    if (!found || !isWorkflowEditorIterationNode(found)) return undefined;
    nodes = found.composition?.nodes ?? [];
  }
  return found;
}

/**
 * The body as an editable document: its nodes and edges, with the parent's type declarations so
 * port types resolve. Groups, triggers and other document-level settings stay with the parent.
 */
export function getWorkflowEditorIterationBodyDocument<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  path: WorkflowEditorIterationBodyPath,
): WorkflowEditorDocument<TNodeData, TEdgeData> | undefined {
  const node = findWorkflowEditorIterationBodyNode(document, path);
  if (!node) return undefined;
  const body = node.composition ?? emptyBody<TNodeData>();
  return {
    nodes: body.nodes,
    edges: body.edges as WorkflowEditorDocument<TNodeData, TEdgeData>["edges"],
    ...(document.typeDeclarations !== undefined
      ? { typeDeclarations: document.typeDeclarations }
      : {}),
  };
}

/**
 * Writes an edited body document back into its iteration node. Boundaries that point at removed
 * body nodes are dropped; the generated `result` port follows the remaining measurements. Type
 * declarations edited in the body view belong to the parent document and are written there.
 */
export function setWorkflowEditorIterationBodyDocument<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  path: WorkflowEditorIterationBodyPath,
  body: Pick<WorkflowEditorDocument<TNodeData, TEdgeData>, "nodes" | "edges" | "typeDeclarations">,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const withTypes =
    "typeDeclarations" in body && body.typeDeclarations !== document.typeDeclarations
      ? { ...document, typeDeclarations: body.typeDeclarations }
      : document;
  return updateWorkflowEditorIterationBody(withTypes, path, (composition) => {
    const nodeIds = new Set(body.nodes.map((node) => node.id));
    const keep = (boundary: WorkflowEditorCompositionBoundary) => nodeIds.has(boundary.nodeId);
    return {
      nodes: body.nodes,
      edges: body.edges as WorkflowEditorNodeComposition<TNodeData>["edges"],
      inputBoundaries: composition.inputBoundaries.filter(keep),
      outputBoundaries: composition.outputBoundaries.filter(keep),
    };
  });
}

/** Replaces the body's input and/or output boundaries. */
export function updateWorkflowEditorIterationBoundaries<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  path: WorkflowEditorIterationBodyPath,
  boundaries: Partial<WorkflowEditorIterationBoundaries>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return updateWorkflowEditorIterationBody(document, path, (composition) => ({
    ...composition,
    ...(boundaries.inputBoundaries ? { inputBoundaries: boundaries.inputBoundaries } : {}),
    ...(boundaries.outputBoundaries ? { outputBoundaries: boundaries.outputBoundaries } : {}),
  }));
}

function updateWorkflowEditorIterationBody<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  path: WorkflowEditorIterationBodyPath,
  update: (
    composition: WorkflowEditorNodeComposition<TNodeData>,
  ) => WorkflowEditorNodeComposition<TNodeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  if (path.length === 0 || !findWorkflowEditorIterationBodyNode(document, path)) return document;
  const updateNodes = (
    nodes: Array<WorkflowEditorNode<TNodeData>>,
    depth: number,
  ): Array<WorkflowEditorNode<TNodeData>> =>
    nodes.map((node) => {
      if (node.id !== path[depth]) return node;
      const composition = node.composition ?? emptyBody<TNodeData>();
      const nextComposition =
        depth === path.length - 1
          ? update(composition)
          : { ...composition, nodes: updateNodes(composition.nodes, depth + 1) };
      return syncWorkflowEditorIterationResultPort({ ...node, composition: nextComposition });
    });
  return { ...document, nodes: updateNodes(document.nodes, 0) };
}
