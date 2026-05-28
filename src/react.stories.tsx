import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  WorkflowWorkbench,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorSelectionState,
  type WorkflowWorkbenchProps,
} from "@moritzbrantner/workflow-editor";

import {
  emptyStoryWorkflowDocument,
  storyWorkflowDocument,
  storyWorkflowNodeTemplates,
  storyWorkflowTypeDefinitions,
  type StoryWorkflowDocument,
} from "./workflow-editor.story-fixtures";

const meta = {
  title: "WorkflowEditor/WorkflowWorkbench",
  component: WorkflowWorkbench,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof WorkflowWorkbench>;

export default meta;

type Story = StoryObj<typeof meta>;

const initialSelection: WorkflowEditorSelectionState = {
  nodeIds: [],
  edgeIds: [],
};

function WorkbenchStory({
  initialDocument = storyWorkflowDocument,
  initialSelectedNodeIds = [],
  readOnly = false,
}: {
  initialDocument?: StoryWorkflowDocument;
  initialSelectedNodeIds?: string[];
  readOnly?: boolean;
}) {
  const [document, setDocument] = useState(() => normalizeWorkflowEditorDocument(initialDocument));
  const [selection, setSelection] = useState<WorkflowEditorSelectionState>({
    ...initialSelection,
    nodeIds: initialSelectedNodeIds,
    primary: initialSelectedNodeIds[0]
      ? { type: "node", id: initialSelectedNodeIds[0] }
      : undefined,
  });
  const workbenchProps = {
    document,
    nodeTemplates: storyWorkflowNodeTemplates,
    readOnly,
    selectedNodeIds: selection.nodeIds,
    selectedEdgeIds: selection.edgeIds,
    showGraphStats: true,
    typeDefinitions: storyWorkflowTypeDefinitions,
    onDocumentChange: setDocument,
    onSelectionStateChange: setSelection,
  } satisfies WorkflowWorkbenchProps;

  return (
    <div className="h-screen min-h-[680px] bg-zinc-50">
      <WorkflowWorkbench {...workbenchProps} />
    </div>
  );
}

export const Default: Story = {
  render: () => <WorkbenchStory />,
};

export const ReadOnly: Story = {
  render: () => <WorkbenchStory readOnly />,
};

export const WithSelectedNode: Story = {
  render: () => <WorkbenchStory initialSelectedNodeIds={["score-lead"]} />,
};

export const EmptyDocument: Story = {
  render: () => <WorkbenchStory initialDocument={emptyStoryWorkflowDocument} />,
};
