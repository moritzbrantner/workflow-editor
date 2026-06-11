import { describe, expect, test } from "vitest";

import {
  composeWorkflowEditorNodes,
  connectWorkflowEditorNodes,
  hasWorkflowEditorNodeComposition,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor/core";
import {
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
  toUiWorkflowBuilderViewport,
} from "@moritzbrantner/workflow-editor/react";

const document: WorkflowEditorDocument = normalizeWorkflowEditorDocument({
  nodes: [
    {
      id: "input",
      label: "Input",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "transform",
      label: "Transform",
      x: 240,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "output",
      label: "Output",
      x: 480,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    },
  ],
  edges: [
    {
      id: "input-transform",
      sourceNodeId: "input",
      sourcePortId: "out",
      targetNodeId: "transform",
      targetPortId: "in",
    },
  ],
  viewport: { x: 1, y: 2, zoom: 1.5 },
});

describe("workflow-builder adapters", () => {
  test("roundtrips workflow nodes, edges, and viewport", () => {
    const uiNodes = toUiWorkflowBuilderNodes(document.nodes);
    const uiEdges = toUiWorkflowBuilderEdges(document.edges);

    expect(fromUiWorkflowBuilderNodes(uiNodes, document.nodes)[0]?.id).toBe("input");
    expect(fromUiWorkflowBuilderEdges(uiEdges, document.edges)[0]?.id).toBe("input-transform");
    expect(toUiWorkflowBuilderViewport(document.viewport)).toEqual({ x: 1, y: 2, zoom: 1.5 });
  });

  test("maps structured port types to stable UI labels and colors without mutating document types", () => {
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [
            { id: "string", label: "String", type: { kind: "string" } },
            { id: "number", label: "Number", type: { kind: "number" } },
            { id: "boolean", label: "Boolean", type: { kind: "boolean" } },
            { id: "object", label: "Object", type: { kind: "object" } },
            { id: "array", label: "Array", type: { kind: "array", element: { kind: "string" } } },
            { id: "ref", label: "Ref", type: { kind: "ref", name: "Lead" } },
            {
              id: "custom",
              label: "Custom",
              type: { kind: "ref", name: "Incident" },
              color: "#123456",
            },
          ],
        },
        {
          id: "target",
          label: "Target",
          x: 360,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
        },
      ],
      edges: [
        {
          id: "source-string-target-in",
          sourceNodeId: "source",
          sourcePortId: "string",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    });

    const uiNodes = toUiWorkflowBuilderNodes(typedDocument.nodes);
    const outputPorts = uiNodes[0]!.outputs!;

    expect(outputPorts.map((port) => port.color)).toEqual([
      "#0891b2",
      "#16a34a",
      "#ca8a04",
      "#4f46e5",
      "#9333ea",
      expect.any(String),
      "#123456",
    ]);
    expect(outputPorts[0]).toMatchObject({
      type: { label: "string", source: "string" },
    });
    expect(outputPorts[4]).toMatchObject({
      type: { label: "string[]", source: "array:string" },
    });
    expect(outputPorts[5]).toMatchObject({
      type: { label: "Lead", source: "ref:Lead" },
    });
    expect(toUiWorkflowBuilderEdges(typedDocument.edges, typedDocument.nodes)[0]).toMatchObject({
      color: "#0891b2",
    });

    const movedNodes = fromUiWorkflowBuilderNodes(
      uiNodes.map((node) =>
        node.id === "source" ? Object.assign({}, node, { minimized: true, x: 24 }) : node,
      ),
      typedDocument.nodes,
    );
    expect(movedNodes[0]?.outputs?.[0]?.type).toEqual({ kind: "string" });
    expect(movedNodes[0]?.outputs?.[4]?.type).toEqual({
      kind: "array",
      element: { kind: "string" },
    });
  });

  test("marks optional inputs and shows defaults only while unconnected", () => {
    const optionalDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "number" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [
            {
              id: "limit",
              label: "Limit",
              type: { kind: "number" },
              optional: true,
              defaultValue: 10,
            },
            {
              id: "mode",
              label: "Mode",
              type: { kind: "string" },
              optional: true,
            },
          ],
        },
      ],
      edges: [],
    });

    const unconnectedInputs = toUiWorkflowBuilderNodes(
      optionalDocument.nodes,
      optionalDocument.edges,
    )[1]!.inputs!;

    expect(unconnectedInputs[0]).toMatchObject({
      badge: "default 10",
      required: false,
    });
    expect(unconnectedInputs[1]).toMatchObject({
      badge: "optional",
      required: false,
    });

    const connectedDocument = connectWorkflowEditorNodes(optionalDocument, {
      sourceNodeId: "source",
      sourcePortId: "out",
      targetNodeId: "target",
      targetPortId: "limit",
    });
    const connectedInputs = toUiWorkflowBuilderNodes(
      connectedDocument.nodes,
      connectedDocument.edges,
    )[1]!.inputs!;

    expect(connectedInputs[0]?.badge).toBe("optional");
    expect(connectedInputs[1]?.badge).toBe("optional");
  });

  test("preserves workflow references and composition metadata on UI node updates", () => {
    const referenced = normalizeWorkflowEditorDocument({
      ...document,
      nodes: [
        {
          ...document.nodes[0]!,
          workflowRef: { documentId: "child-workflow" },
        },
        document.nodes[1]!,
        document.nodes[2]!,
      ],
    });
    const referencedUiNodes = toUiWorkflowBuilderNodes(referenced.nodes);
    referencedUiNodes[0] = { ...referencedUiNodes[0]!, x: 24, y: 36 };
    expect(fromUiWorkflowBuilderNodes(referencedUiNodes, referenced.nodes)[0]?.workflowRef).toEqual(
      { documentId: "child-workflow" },
    );

    const connected = connectWorkflowEditorNodes(document, {
      sourceNodeId: "transform",
      sourcePortId: "out",
      targetNodeId: "output",
      targetPortId: "in",
    });
    const composed = composeWorkflowEditorNodes(connected, ["input", "transform"], {
      id: "ingest-component",
      label: "Ingest component",
    });
    const wrapper = composed.nodes.find((node) => node.id === "ingest-component");
    const composedUiNodes = toUiWorkflowBuilderNodes(composed.nodes);
    composedUiNodes[1] = { ...composedUiNodes[1]!, x: 96, y: 120 };

    expect(wrapper && hasWorkflowEditorNodeComposition(wrapper)).toBe(true);
    expect(fromUiWorkflowBuilderNodes(composedUiNodes, composed.nodes)[1]?.composition).toEqual(
      wrapper?.composition,
    );
  });
});
