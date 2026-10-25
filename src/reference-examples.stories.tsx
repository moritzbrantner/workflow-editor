import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  createWorkflowExecutionSnapshotFromRunnerEvents,
  defaultWorkflowEditorNodeTemplates,
  type WorkflowEditorSelectionState,
} from "@moritzbrantner/workflow-editor/core";
import { WorkflowWorkbench } from "@moritzbrantner/workflow-editor/react";

import {
  backendOrchestrationDocument,
  backendOrchestrationRecordedRun,
} from "../examples/workbench/src/reference-examples";

// External execution overlay on a reference application (#22, #20): a recorded Workflow Runner
// event stream for the Order Fulfillment example, folded into an overlay snapshot. Pages shows no
// run state because it executes nothing (Decision Atlas 5.7, 5.8); a connected host would feed the
// same snapshot from live events.

function RecordedRunStory({ eventCount }: { eventCount?: number }) {
  const [document, setDocument] = useState(backendOrchestrationDocument);
  const [selection, setSelection] = useState<WorkflowEditorSelectionState>({
    nodeIds: ["charge"],
    edgeIds: [],
    primary: { type: "node", id: "charge" },
  });
  const events = backendOrchestrationRecordedRun.slice(0, eventCount);
  const execution = createWorkflowExecutionSnapshotFromRunnerEvents(events, {
    mode: eventCount === undefined ? "historical" : "live",
  });

  return (
    <div className="h-screen min-h-[680px] bg-zinc-50">
      <WorkflowWorkbench
        document={document}
        nodeTemplates={defaultWorkflowEditorNodeTemplates}
        selectedNodeIds={selection.nodeIds}
        selectedEdgeIds={selection.edgeIds}
        onDocumentChange={setDocument}
        onSelectionStateChange={setSelection}
        execution={execution}
      />
    </div>
  );
}

const meta = {
  title: "Reference examples/Order Fulfillment run",
  component: RecordedRunStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecordedRunStory>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Mid-run: the charge is retrying after a gateway timeout while the other tasks finished. */
export const Retrying: Story = { args: { eventCount: 9 } };

/** The finished run: the charge succeeded on attempt 2 and the cancel path was skipped. */
export const Completed: Story = { args: {} };
