import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  WorkflowEditor,
  createWorkflowEditorLibrary,
  type WorkflowEditorLibrary,
  type WorkflowEditorStorageAdapter,
} from "@moritzbrantner/workflow-editor";

import {
  createStoryWorkflowLibrary,
  storyWorkflowNodeTemplates,
  storyWorkflowTypeDefinitions,
} from "./workflow-editor.story-fixtures";

const meta = {
  title: "WorkflowEditor/WorkflowEditor",
  component: WorkflowEditor,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof WorkflowEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

function createMemoryWorkflowEditorStorage(
  initialLibrary: WorkflowEditorLibrary,
): WorkflowEditorStorageAdapter {
  let storedLibrary: WorkflowEditorLibrary | null = createWorkflowEditorLibrary(initialLibrary);

  return {
    async loadLibrary() {
      return storedLibrary ? createWorkflowEditorLibrary(storedLibrary) : null;
    },
    async saveLibrary(library) {
      storedLibrary = createWorkflowEditorLibrary(library);
    },
  };
}

function EditorStory({
  compactControls = false,
  readOnly = false,
}: {
  compactControls?: boolean;
  readOnly?: boolean;
}) {
  const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
  const storage = useMemo(
    () => createMemoryWorkflowEditorStorage(initialLibrary),
    [initialLibrary],
  );

  return (
    <div className="h-screen min-h-[680px] bg-zinc-50">
      <WorkflowEditor
        compactControls={compactControls}
        initialLibrary={initialLibrary}
        nodeTemplates={storyWorkflowNodeTemplates}
        readOnly={readOnly}
        storage={storage}
        typeDefinitions={storyWorkflowTypeDefinitions}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <EditorStory />,
};

export const ReadOnly: Story = {
  render: () => <EditorStory readOnly />,
};

export const CompactControls: Story = {
  render: () => <EditorStory compactControls />,
};
