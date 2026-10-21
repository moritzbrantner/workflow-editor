import {
  isWorkflowEditorIterationMeasurementBoundary,
  type WorkflowEditorCompositionBoundary,
  type WorkflowEditorDocument,
  type WorkflowEditorIterationBoundaries,
  type WorkflowEditorIterationDiagnostic,
  type WorkflowEditorNode,
} from "../core";

type BodyPort = { nodeId: string; portId: string; label: string };

const portKey = (port: { nodeId: string; portId: string }) => `${port.nodeId}\u001f${port.portId}`;

function bodyPorts(
  document: WorkflowEditorDocument<unknown, unknown>,
  direction: "inputs" | "outputs",
): BodyPort[] {
  return document.nodes.flatMap((node) =>
    (node[direction] ?? []).map((port) => ({
      nodeId: node.id,
      portId: port.id,
      label: `${node.label} · ${port.label ?? port.id}`,
    })),
  );
}

/**
 * Document settings of an iteration body view (#94, Decision Atlas 5.25), shown in the inspector
 * when nothing is selected. Each change is one document edit on the parent document.
 */
export function WorkflowIterationBoundariesPanel({
  node,
  document,
  diagnostics,
  readOnly,
  onChange,
}: {
  node: WorkflowEditorNode<Record<string, unknown>>;
  document: WorkflowEditorDocument<unknown, unknown>;
  diagnostics: readonly WorkflowEditorIterationDiagnostic[];
  readOnly: boolean;
  onChange?: (boundaries: Partial<WorkflowEditorIterationBoundaries>) => void;
}) {
  const inputBoundaries = node.composition?.inputBoundaries ?? [];
  const outputBoundaries = node.composition?.outputBoundaries ?? [];
  const targets = bodyPorts(document, "inputs");
  const sources = bodyPorts(document, "outputs");
  const disabled = readOnly || !onChange;

  const toggleInput = (wrapperPortId: string, target: BodyPort, checked: boolean) => {
    const rest = inputBoundaries.filter(
      (boundary) =>
        !(
          boundary.wrapperPortId === wrapperPortId &&
          boundary.nodeId === target.nodeId &&
          boundary.portId === target.portId
        ),
    );
    onChange?.({
      inputBoundaries: checked
        ? [...rest, { wrapperPortId, nodeId: target.nodeId, portId: target.portId }]
        : rest,
    });
  };

  const setOutput = (wrapperPortId: string, key: string) => {
    const source = sources.find((port) => portKey(port) === key);
    const rest = outputBoundaries.filter((boundary) => boundary.wrapperPortId !== wrapperPortId);
    const next: WorkflowEditorCompositionBoundary[] = source
      ? [...rest, { wrapperPortId, nodeId: source.nodeId, portId: source.portId }]
      : rest;
    onChange?.({ outputBoundaries: next });
  };

  const outputSelect = (wrapperPortId: string, label: string, hint: string) => {
    const current = outputBoundaries.find((boundary) => boundary.wrapperPortId === wrapperPortId);
    return (
      <label className="grid gap-1 text-xs">
        <span className="font-medium">{label}</span>
        <select
          aria-label={label}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={current ? portKey(current) : ""}
          disabled={disabled}
          onChange={(event) => setOutput(wrapperPortId, event.target.value)}
        >
          <option value="">{hint}</option>
          {sources.map((port) => (
            <option key={portKey(port)} value={portKey(port)}>
              {port.label}
            </option>
          ))}
        </select>
      </label>
    );
  };

  const measurements = outputBoundaries.filter((boundary) =>
    isWorkflowEditorIterationMeasurementBoundary(boundary.wrapperPortId),
  );

  return (
    <section aria-label="Iteration boundaries" className="grid gap-3 p-4 text-sm">
      <div>
        <h3 className="text-sm font-semibold">Iteration boundaries</h3>
        <p className="text-xs text-muted-foreground">
          How each iteration of {node.label} receives its state and returns the next one.
        </p>
      </div>
      {(node.inputs ?? []).map((wrapperPort) => (
        <fieldset key={wrapperPort.id} className="grid gap-1 rounded-md border p-2 text-xs">
          <legend className="px-1 font-medium">{wrapperPort.label ?? wrapperPort.id} feeds</legend>
          {targets.length === 0 ? (
            <p className="text-muted-foreground">Add body nodes with inputs first.</p>
          ) : (
            targets.map((target) => (
              <label key={portKey(target)} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  aria-label={`${wrapperPort.label ?? wrapperPort.id} feeds ${target.label}`}
                  checked={inputBoundaries.some(
                    (boundary) =>
                      boundary.wrapperPortId === wrapperPort.id &&
                      boundary.nodeId === target.nodeId &&
                      boundary.portId === target.portId,
                  )}
                  disabled={disabled}
                  onChange={(event) => toggleInput(wrapperPort.id, target, event.target.checked)}
                />
                {target.label}
              </label>
            ))
          )}
        </fieldset>
      ))}
      {outputSelect("next", "Next state", "No next state")}
      {outputSelect("converged", "Converged (stop condition)", "Stop only at the limit")}
      {measurements.length ? (
        <p className="text-xs text-muted-foreground">
          Measurements:{" "}
          {measurements
            .map((boundary) => `${boundary.wrapperPortId} ← ${boundary.nodeId}.${boundary.portId}`)
            .join(", ")}
        </p>
      ) : null}
      {diagnostics.length ? (
        <ul aria-label="Iteration diagnostics" className="grid gap-1 text-xs text-destructive">
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${index}`}>
              <code>{diagnostic.code}</code> — {diagnostic.message}
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="text-xs text-muted-foreground">
          The iteration is valid.
        </p>
      )}
    </section>
  );
}
