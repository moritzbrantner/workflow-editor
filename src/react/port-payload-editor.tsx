import { useState } from "react";

import { Input } from "@moritzbrantner/ui";

import type {
  WorkflowEditorPort,
  WorkflowEditorPortPayload,
  WorkflowEditorPortPayloadMode,
} from "../core-types";

/** Edits a port's delivery contract, which TECH-003 keeps separate from its TypeScript type. */
export function WorkflowPortPayloadEditor({
  port,
  direction,
  readOnly,
  onApply,
}: {
  port: WorkflowEditorPort;
  direction: "inputs" | "outputs";
  readOnly?: boolean;
  onApply: (payload: WorkflowEditorPortPayload | undefined) => void;
}) {
  const [mode, setMode] = useState<WorkflowEditorPortPayloadMode>(port.payload?.mode ?? "buffered");
  const [mediaType, setMediaType] = useState(port.payload?.mediaType ?? "");
  const prefix = `${direction === "inputs" ? "Input" : "Output"} ${port.label}`;
  const apply = (nextMode: WorkflowEditorPortPayloadMode, nextMediaType: string) => {
    const trimmedMediaType = nextMediaType.trim();
    // A buffered port without media annotation is the default contract; keep it implicit.
    const payload: WorkflowEditorPortPayload | undefined =
      nextMode === "buffered" && !trimmedMediaType
        ? undefined
        : { mode: nextMode, ...(trimmedMediaType ? { mediaType: trimmedMediaType } : {}) };
    if (JSON.stringify(payload ?? null) !== JSON.stringify(port.payload ?? null)) {
      onApply(payload);
    }
  };

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-1 text-xs">
      <span className="col-span-2 font-medium">{prefix}</span>
      <select
        aria-label={`${prefix} delivery mode`}
        className="h-8 rounded-md border border-input bg-background px-2"
        value={mode}
        disabled={readOnly}
        onChange={(event) => {
          const nextMode = event.target.value as WorkflowEditorPortPayloadMode;
          setMode(nextMode);
          apply(nextMode, mediaType);
        }}
      >
        <option value="buffered">buffered</option>
        <option value="streamed">streamed</option>
      </select>
      <Input
        aria-label={`${prefix} media type`}
        className="h-8 font-mono text-xs"
        placeholder="e.g. audio/wav"
        value={mediaType}
        disabled={readOnly}
        onChange={(event) => setMediaType(event.target.value)}
        onBlur={() => apply(mode, mediaType)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply(mode, mediaType);
          }
          if (event.key === "Escape") {
            setMediaType(port.payload?.mediaType ?? "");
          }
        }}
      />
    </div>
  );
}

export function withWorkflowEditorPortPayload(
  ports: readonly WorkflowEditorPort[] | undefined,
  portId: string,
  payload: WorkflowEditorPortPayload | undefined,
): WorkflowEditorPort[] | undefined {
  return ports?.map((port) => {
    if (port.id !== portId) {
      return port;
    }
    const { payload: _previous, ...rest } = port;
    return payload ? { ...rest, payload } : rest;
  });
}
