# Execution overlay

Hosts can show a workflow run over the canvas without changing the authored document. Pass a controlled `execution` snapshot to `WorkflowWorkbench` or `WorkflowEditor`:

```ts
const execution: WorkflowExecutionSnapshot = {
  runId: "run-42",
  mode: "live", // or "historical" for a finished run
  nodes: {
    fetch: { state: "succeeded", durationMs: 820, outputSummary: "120 rows" },
    transform: { state: "running", progress: 0.4, attempt: 2, nodeRunId: "nr-7" },
  },
  edges: { "fetch-transform": { state: "transferred" } },
};

<WorkflowEditor execution={execution} renderExecutionDetails={({ node }) => <RetryButton node={node} />} />;
```

- **Snapshot fields.**
  - A run has `runId`, an optional run `state` and a `mode` (`live` or `historical`).
  - Each node entry has a `state`, plus optional `nodeRunId`, `attemptId`, `attempt`, `progress` (0–1), `startedAt`/`endedAt`, `durationMs`, `outputSummary` and `errorSummary`.
  - Node states are `queued`, `running`, `succeeded`, `failed`, `skipped`, `cancelled` and `unknown`. Any other string is shown as a custom state.
  - Edge states are `idle`, `active`, `transferred` and `blocked`. They are independent of edge metadata.
- **Precedence.** While a snapshot is shown, a node's runtime state replaces its design-time `status`, `tone` and header label. Nodes without an entry keep their design-time presentation. Passing `null` clears the overlay.
- **Isolation.** The overlay is layered over the derived canvas nodes only. Updating a node's state never rebuilds or re-normalizes the document. Edits made while the overlay is shown, such as moving a node, keep the design-time `status`, `tone` and `eyebrow`. The snapshot never enters history, saved versions, serialization or dirty tracking.
- **Customization.** `formatExecutionLabel(snapshot, node)` replaces the status text shown on a node. `renderExecutionDetails({ execution, node, snapshot })` adds host content, such as inspect, retry or cancel actions, to the selected node's run details in the inspector.

The editor does not transport, poll or execute runs. Hosts and runners supply the snapshots (ADR 0002, Decision Atlas 5.7).

## From runner events

A connected host can turn Workflow Runner lifecycle events (runner #26, engine #24) into the
overlay snapshot:

```ts
import { applyWorkflowRunnerEventToSnapshot } from "@moritzbrantner/workflow-editor/core";

let execution: WorkflowExecutionSnapshot | undefined;
runner.onEvent((event) => {
  execution = applyWorkflowRunnerEventToSnapshot(execution, event);
  render(<WorkflowEditor execution={execution} />);
});
```

`createWorkflowExecutionSnapshotFromRunnerEvents(events, { mode: "historical" })` folds a stored
event list for a past run. Snapshots record states, attempts, retries, timestamps, durations,
failures and waiting tasks. Node outputs are summarized by port name only, so output values (and
anything secret in them) never enter the snapshot.
