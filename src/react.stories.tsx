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
import type { WorkflowExecutionSnapshot } from "@moritzbrantner/workflow-editor/core";

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
  execution,
}: {
  initialDocument?: StoryWorkflowDocument;
  initialSelectedNodeIds?: string[];
  readOnly?: boolean;
  execution?: WorkflowExecutionSnapshot;
}) {
  const [document, setDocument] = useState(
    () => normalizeWorkflowEditorDocument(initialDocument).document,
  );
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
    execution,
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
      const [document, setDocument] = useState(
        () => normalizeWorkflowEditorDocument(storyWorkflowDocument).document,
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
      const [document, setDocument] = useState(
        () => normalizeWorkflowEditorDocument(storyWorkflowDocument).document,
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

const runStartedAt = "2026-10-18T09:00:00.000Z";

/** Live run: the source finished, scoring is running, the rest is queued. */
export const ExecutionRunning: Story = {
  render: () => (
    <WorkbenchStory
      initialSelectedNodeIds={["score-lead"]}
      execution={{
        runId: "run-42",
        state: "running",
        mode: "live",
        nodes: {
          "lead-source": {
            state: "succeeded",
            attempt: 1,
            durationMs: 420,
            outputSummary: "1 lead",
          },
          "score-lead": { state: "running", attempt: 1, progress: 0.4, startedAt: runStartedAt },
          approval: { state: "queued" },
          notify: { state: "queued" },
        },
        edges: {
          "lead-source-score-lead": { state: "transferred", summary: "1 lead" },
          "score-lead-approval": { state: "idle" },
        },
      }}
    />
  ),
};

/** Failed run: scoring failed on its second attempt, so downstream nodes were skipped. */
export const ExecutionFailed: Story = {
  render: () => (
    <WorkbenchStory
      initialSelectedNodeIds={["score-lead"]}
      execution={{
        runId: "run-43",
        state: "failed",
        mode: "live",
        nodes: {
          "lead-source": { state: "succeeded", attempt: 1, durationMs: 380 },
          "score-lead": {
            state: "failed",
            attempt: 2,
            durationMs: 1210,
            errorSummary: "Scoring service returned 503",
          },
          approval: { state: "skipped" },
          notify: { state: "skipped" },
        },
        edges: {
          "lead-source-score-lead": { state: "transferred" },
          "score-lead-approval": { state: "blocked" },
        },
      }}
    />
  ),
};

/** Completed run inspected afterwards, shown as a past run. */
export const ExecutionCompleted: Story = {
  render: () => (
    <WorkbenchStory
      initialSelectedNodeIds={["notify"]}
      execution={{
        runId: "run-41",
        state: "succeeded",
        mode: "historical",
        nodes: {
          "lead-source": { state: "succeeded", attempt: 1, durationMs: 400 },
          "score-lead": {
            state: "succeeded",
            attempt: 1,
            durationMs: 950,
            outputSummary: "Score 87",
          },
          approval: {
            state: "succeeded",
            attempt: 1,
            durationMs: 60000,
            outputSummary: "Approved",
          },
          notify: { state: "succeeded", attempt: 1, durationMs: 210, outputSummary: "Sent" },
        },
        edges: {
          "lead-source-score-lead": { state: "transferred" },
          "score-lead-approval": { state: "transferred" },
        },
      }}
    />
  ),
};

/** Mixed states, including a cancelled node, a custom host state and a node without state. */
export const ExecutionMixed: Story = {
  render: () => (
    <WorkbenchStory
      initialSelectedNodeIds={["approval"]}
      execution={{
        runId: "run-44",
        state: "cancelled",
        nodes: {
          "lead-source": { state: "succeeded", attempt: 1 },
          "score-lead": { state: "cancelled", attempt: 1, errorSummary: "Cancelled by operator" },
          approval: { state: "awaiting-review" },
        },
        edges: { "lead-source-score-lead": { state: "active" } },
      }}
    />
  ),
};

const allFieldKindsTemplate = {
  id: "story-all-field-kinds",
  label: "Configured task",
  kind: "story.configured",
  inspectorFields: [
    { path: "name", label: "Name", kind: "text" as const, required: true },
    { path: "retries", label: "Retries", kind: "number" as const, min: 0, max: 5, defaultValue: 1 },
    { path: "enabled", label: "Enabled", kind: "boolean" as const, defaultValue: true },
    {
      path: "mode",
      label: "Mode",
      kind: "select" as const,
      defaultValue: "fast",
      options: [
        { label: "Fast", value: "fast" },
        { label: "Thorough", value: "thorough" },
      ],
    },
    {
      path: "regions",
      label: "Regions",
      kind: "multi-select" as const,
      options: [
        { label: "EU", value: "eu" },
        { label: "US", value: "us" },
      ],
    },
    { path: "payload", label: "Payload", kind: "json" as const },
    {
      path: "filter",
      label: "Filter",
      kind: "expression" as const,
      placeholder: "item.amount > 0",
    },
    { path: "auth.token", label: "Token", kind: "secret-ref" as const, section: "Advanced" },
    { path: "headers", label: "Headers", kind: "key-value" as const, section: "Advanced" },
    {
      path: "color",
      label: "Color",
      kind: "custom" as const,
      renderer: "swatch",
      section: "Advanced",
    },
  ],
};

/** Every built-in inspector field kind, plus a host renderer for the custom `swatch` field. */
export const SchemaInspectorFields: Story = {
  render: () => {
    function SchemaFieldsStory() {
      const [document, setDocument] = useState(
        () =>
          normalizeWorkflowEditorDocument({
            nodes: [
              {
                id: "configured",
                label: "Configured task",
                kind: "story.configured",
                x: 80,
                y: 80,
                data: { name: "Nightly sync", color: "#2563eb" },
              },
            ],
            edges: [],
          }).document,
      );
      return (
        <div className="h-screen min-h-[680px] bg-zinc-50">
          <WorkflowWorkbench
            document={document}
            nodeTemplates={[allFieldKindsTemplate]}
            selectedNodeId="configured"
            onDocumentChange={setDocument}
            inspectorFieldRenderers={{
              fields: {
                swatch: ({ value, onChange, readOnly }) => (
                  <input
                    type="color"
                    aria-label="Color"
                    disabled={readOnly}
                    value={typeof value === "string" ? value : "#000000"}
                    onChange={(event) => onChange(event.currentTarget.value)}
                  />
                ),
              },
            }}
          />
        </div>
      );
    }
    return <SchemaFieldsStory />;
  },
};
