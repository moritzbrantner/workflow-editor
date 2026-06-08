import { expectAssignable, expectError, expectType } from "tsd";
import type { ComponentProps } from "react";

import {
  WorkflowEditor,
  WorkflowEditorDocumentValidationError,
  WorkflowWorkbench,
  applyWorkflowGraphOperation,
  createWorkflowEditorEntry,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  createWorkflowGraphRuntime,
  decodeWorkflowEditorSharePayload,
  encodeWorkflowEditorSharePayload,
  isWorkflowEditorPortTypeAssignable,
  layoutWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
  parseWorkflowEditorDocumentFile,
  type WorkflowEditorDocument,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
  type WorkflowGraphOperation,
  type WorkflowGraphRuntimeState,
} from "@moritzbrantner/workflow-editor";
import type { GraphEditorDocument } from "@moritzbrantner/graph-editor/core";
import {
  connectWorkflowEditorNodes,
  validateWorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
  type WorkflowEditorTypeDefinition,
} from "@moritzbrantner/workflow-editor/core";
import {
  WorkflowWorkbenchCanvas,
  useWorkflowWorkbenchController,
  type WorkflowWorkbenchProps,
} from "@moritzbrantner/workflow-editor/react";
import {
  WorkflowEditorDocumentMenu,
  useWorkflowEditorController,
  type WorkflowEditorProps,
} from "@moritzbrantner/workflow-editor/editor";
import {
  commitWorkflowEditorHistory,
  type WorkflowEditorHistoryState,
} from "@moritzbrantner/workflow-editor/history";
import {
  layoutWorkflowEditorDocument as layoutWorkflowEditorDocumentFromSubpath,
  type WorkflowEditorLayoutResult,
} from "@moritzbrantner/workflow-editor/layout";
import {
  buildWorkflowEditorDocumentFile,
  buildWorkflowEditorDocumentFileFromEntry,
  type WorkflowEditorLibrary,
} from "@moritzbrantner/workflow-editor/persistence";
import { workflowEditorShareUrl } from "@moritzbrantner/workflow-editor/share";

type NodeData = { endpoint: string };
type EdgeData = { retry: boolean };

const document = normalizeWorkflowEditorDocument<NodeData, EdgeData>({
  nodes: [
    {
      id: "source",
      label: "Source",
      kind: "source",
      x: 0,
      y: 0,
      data: { endpoint: "/api/source" },
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "target",
      label: "Target",
      kind: "target",
      x: 320,
      y: 0,
      data: { endpoint: "/api/target" },
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    },
  ],
  edges: [],
});

expectType<WorkflowEditorDocument<NodeData, EdgeData>>(document);
expectAssignable<GraphEditorDocument<NodeData, EdgeData, WorkflowEditorPortType>>(document);
expectType<WorkflowEditorNode<NodeData>>(document.nodes[0]!);
expectAssignable<WorkflowEditorEdge<EdgeData>>({
  id: "edge",
  sourceNodeId: "source",
  sourcePortId: "out",
  targetNodeId: "target",
  targetPortId: "in",
  data: { retry: true },
});
expectError<WorkflowEditorNode>({
  id: "bad-port",
  label: "Bad port",
  x: 0,
  y: 0,
  inputs: [{ id: "in", label: "In" }],
});

const connected = connectWorkflowEditorNodes(document, {
  sourceNodeId: "source",
  sourcePortId: "out",
  targetNodeId: "target",
  targetPortId: "in",
});
expectType<WorkflowEditorDocument<NodeData, EdgeData>>(connected);

const template: WorkflowEditorNodeTemplate<NodeData> = {
  id: "template",
  label: "Template",
  kind: "template",
  data: { endpoint: "/api/template" },
};
expectType<WorkflowEditorNodeTemplate<NodeData>>(template);

const stringType = { kind: "string" } satisfies WorkflowEditorPortType;
const typeDefinitions = [
  { name: "Identifier", type: stringType },
] satisfies readonly WorkflowEditorTypeDefinition[];
expectType<boolean>(isWorkflowEditorPortTypeAssignable(stringType, { kind: "unknown" }));
expectAssignable<readonly WorkflowEditorTypeDefinition[]>(typeDefinitions);
expectType<ReturnType<typeof validateWorkflowEditorDocument>>(
  validateWorkflowEditorDocument(document),
);

const layoutResult = layoutWorkflowEditorDocument(document);
expectType<WorkflowEditorLayoutResult<NodeData, EdgeData>>(layoutResult);
expectType<WorkflowEditorLayoutResult<NodeData, EdgeData>>(
  layoutWorkflowEditorDocumentFromSubpath(document),
);

const entry = createWorkflowEditorEntry({ id: "demo", name: "Demo", document });
const library = createWorkflowEditorLibrary({ documents: [entry], activeDocumentId: "demo" });
expectType<WorkflowEditorLibrary<NodeData, EdgeData>>(library);
expectType<WorkflowEditorHistoryState<NodeData, EdgeData>>(createWorkflowEditorHistory(document));
expectType<WorkflowEditorHistoryState<NodeData, EdgeData>>(
  commitWorkflowEditorHistory(createWorkflowEditorHistory(document), connected),
);
const workflowRuntime = createWorkflowGraphRuntime({ initialDocument: document });
expectType<WorkflowGraphRuntimeState<NodeData, EdgeData, WorkflowEditorPortType>>(workflowRuntime);
const workflowOperation: WorkflowGraphOperation<NodeData, EdgeData, WorkflowEditorPortType> = {
  id: "graph.replace-document",
  label: "Replace",
  apply: () => document,
};
expectType<WorkflowGraphRuntimeState<NodeData, EdgeData, WorkflowEditorPortType>>(
  applyWorkflowGraphOperation(workflowRuntime, workflowOperation),
);

const file = buildWorkflowEditorDocumentFile(document);
expectType<ReturnType<typeof buildWorkflowEditorDocumentFileFromEntry<NodeData, EdgeData>>>(
  buildWorkflowEditorDocumentFileFromEntry(entry),
);
expectType<ReturnType<typeof parseWorkflowEditorDocumentFile>>(
  parseWorkflowEditorDocumentFile(JSON.stringify(file)),
);

const sharePayload = encodeWorkflowEditorSharePayload({ document });
expectType<Promise<string>>(sharePayload);
expectType<Promise<{ document: WorkflowEditorDocument }>>(
  decodeWorkflowEditorSharePayload<{ document: WorkflowEditorDocument }>("plain.e30"),
);
expectType<string>(workflowEditorShareUrl("https://example.test/editor", "plain.e30"));

expectAssignable<ComponentProps<typeof WorkflowWorkbench<NodeData, EdgeData>>>({
  document,
  onDocumentChange(nextDocument) {
    expectType<WorkflowEditorDocument<NodeData, EdgeData>>(nextDocument);
  },
});
expectAssignable<WorkflowWorkbenchProps<NodeData, EdgeData>>({ document });
expectAssignable<ComponentProps<typeof WorkflowEditor<NodeData, EdgeData>>>({
  initialLibrary: library,
});
expectAssignable<WorkflowEditorProps<NodeData, EdgeData>>({ initialLibrary: library });

expectAssignable<Parameters<typeof WorkflowWorkbenchCanvas<NodeData, EdgeData>>[0]>({
  controller: useWorkflowWorkbenchController({ document }),
});
expectAssignable<Parameters<typeof WorkflowEditorDocumentMenu<NodeData, EdgeData>>[0]>({
  controller: useWorkflowEditorController({ initialLibrary: library }),
});

expectAssignable<Error>(new WorkflowEditorDocumentValidationError([]));
expectError(normalizeWorkflowEditorDocument({ nodes: "not nodes", edges: [] }));
