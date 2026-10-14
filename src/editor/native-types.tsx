import { resolveWorkflowEditorDocumentTypes } from "../core";
import { useState } from "react";
import { Button, Textarea, Input } from "@moritzbrantner/ui";
import type {
  WorkflowEditorDocument,
  WorkflowEditorNode,
  WorkflowEditorPort,
  WorkflowEditorTypeDefinition,
} from "../core-types";
import { workflowEditorPortTypeSource } from "../core-type-source";
import { createWorkflowEditorTypeResolver } from "../core-type-resolver";

export function NativeWorkflowTypes<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  definitions,
  selectedNodeId,
  readOnly,
  onChange,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  definitions: readonly WorkflowEditorTypeDefinition[];
  selectedNodeId?: string;
  readOnly: boolean;
  onChange: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
}) {
  const [draft, setDraft] = useState(document.typeDeclarations ?? "");
  const [error, setError] = useState("");
  const selected = document.nodes.find((node) => node.id === selectedNodeId);
  const resolver = createWorkflowEditorTypeResolver(definitions, document.typeDeclarations);
  const update = (next: WorkflowEditorDocument<TNodeData, TEdgeData>) =>
    onChange(resolveWorkflowEditorDocumentTypes(next, { typeDefinitions: definitions }));
  resolver.prepareChecks(
    document.nodes.flatMap((node) => (node.outputs ?? []).map((port) => ({ source: port.type }))),
  );
  const save = () => {
    const errors = createWorkflowEditorTypeResolver(definitions, draft).findResolutionErrors({
      kind: "any",
    });
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setError("");
    update({ ...document, typeDeclarations: draft });
  };
  return (
    <section className="grid gap-3" aria-label="Workflow TypeScript">
      <label className="grid gap-1">
        <span>TypeScript declarations</span>
        <Textarea
          aria-label="TypeScript declarations"
          className="min-h-28 font-mono text-xs"
          disabled={readOnly}
          value={draft}
          placeholder="type Customer = { id: string; name?: string };"
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={save}>
        Apply declarations
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {selected ? (
        <div className="grid gap-2">
          <h3 className="font-semibold">{selected.label} port types</h3>
          {(["inputs", "outputs"] as const).flatMap((direction) =>
            (selected[direction] ?? []).map((port) => (
              <NativePortType
                key={`${selected.id}:${direction}:${port.id}:${workflowEditorPortTypeSource(port.type)}`}
                port={port}
                direction={direction}
                node={selected}
                document={document}
                definitions={definitions}
                readOnly={readOnly}
                onChange={update}
              />
            )),
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select a node to edit its port types.</p>
      )}
      <details open>
        <summary>Possible outputs</summary>
        <ul className="grid gap-1 text-xs">
          {document.nodes.flatMap((node) =>
            (node.outputs ?? []).map((port) => (
              <li key={`${node.id}:${port.id}`}>
                <span>
                  {node.label} · {port.label}:{" "}
                </span>
                <code className="break-words">{workflowEditorPortTypeSource(port.type)}</code>
                {resolver.findResolutionErrors(port.type).map((message) => (
                  <p key={message} className="text-destructive">
                    {message}
                  </p>
                ))}
              </li>
            )),
          )}
        </ul>
      </details>
    </section>
  );
}

function NativePortType<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  port,
  direction,
  node,
  document,
  definitions,
  readOnly,
  onChange,
}: {
  port: WorkflowEditorPort;
  direction: "inputs" | "outputs";
  node: WorkflowEditorNode<TNodeData>;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  definitions: readonly WorkflowEditorTypeDefinition[];
  readOnly: boolean;
  onChange: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
}) {
  const [draft, setDraft] = useState(workflowEditorPortTypeSource(port.type));
  const [error, setError] = useState("");
  const inferred = Boolean(port.metadata?.workflowTypeInference);
  const commit = () => {
    const type = { kind: "typescript", source: draft } as const;
    const errors = createWorkflowEditorTypeResolver(
      definitions,
      document.typeDeclarations,
    ).findResolutionErrors(type);
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    setError("");
    onChange({
      ...document,
      nodes: document.nodes.map((candidate) =>
        candidate.id === node.id
          ? {
              ...candidate,
              [direction]: candidate[direction]?.map((existing) =>
                existing.id === port.id ? { ...existing, type } : existing,
              ),
            }
          : candidate,
      ),
    });
  };
  return (
    <div className="grid gap-1">
      <label className="grid gap-1">
        <span>
          {direction === "inputs" ? "Input" : "Output"} {port.label}
          {inferred ? " (propagated)" : ""}
        </span>
        <Input
          aria-label={`${direction === "inputs" ? "Input" : "Output"} ${port.label} TypeScript type`}
          className="font-mono text-xs"
          value={draft}
          disabled={readOnly || inferred}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft(workflowEditorPortTypeSource(port.type));
              setError("");
            }
          }}
        />
      </label>
      {!inferred ? (
        <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={commit}>
          Apply {port.label} type
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
