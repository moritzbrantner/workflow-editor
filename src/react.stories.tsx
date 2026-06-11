import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  normalizeWorkflowEditorDocument,
  type WorkflowEditorSelectionState,
} from "@moritzbrantner/workflow-editor/core";
import {
  WorkflowWorkbench,
  WorkflowWorkbenchCanvas,
  WorkflowWorkbenchInspector,
  WorkflowWorkbenchPalette,
  useWorkflowWorkbenchController,
  type WorkflowWorkbenchProps,
} from "@moritzbrantner/workflow-editor/react";

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

export const WithInlinePanels: Story = {
  render: () => {
    function InlinePanelsStory() {
      const [document, setDocument] = useState(() =>
        normalizeWorkflowEditorDocument(storyWorkflowDocument),
      );
      const [selection, setSelection] = useState<WorkflowEditorSelectionState>({
        ...initialSelection,
      });
      const controller = useWorkflowWorkbenchController({
        document,
        nodeTemplates: storyWorkflowNodeTemplates,
        selectedNodeIds: selection.nodeIds,
        selectedEdgeIds: selection.edgeIds,
        typeDefinitions: storyWorkflowTypeDefinitions,
        onDocumentChange: setDocument,
        onSelectionStateChange: setSelection,
      });

      return (
        <div className="grid h-screen min-h-[680px] grid-cols-[18rem_minmax(0,1fr)_22rem] gap-3 bg-zinc-50 p-3">
          <WorkflowWorkbenchPalette controller={controller} />
          <WorkflowWorkbenchCanvas controller={controller} />
          <WorkflowWorkbenchInspector controller={controller} />
        </div>
      );
    }

    return <InlinePanelsStory />;
  },
};

export const HiddenChrome: Story = {
  render: () => {
    function HiddenChromeStory() {
      const [document, setDocument] = useState(() =>
        normalizeWorkflowEditorDocument(storyWorkflowDocument),
      );

      return (
        <div className="h-screen min-h-[680px] bg-zinc-50">
          <WorkflowWorkbench
            document={document}
            nodeTemplates={storyWorkflowNodeTemplates}
            typeDefinitions={storyWorkflowTypeDefinitions}
            chrome={{
              toolbar: "hidden",
              palette: "hidden",
              inspector: "hidden",
            }}
            onDocumentChange={setDocument}
          />
        </div>
      );
    }

    return <HiddenChromeStory />;
  },
};
