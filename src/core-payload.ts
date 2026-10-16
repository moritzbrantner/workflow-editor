import type {
  WorkflowEditorPort,
  WorkflowEditorPortPayload,
  WorkflowEditorPortPayloadMode,
} from "./core-types";

/**
 * Delivery mode and media annotations are port contract metadata, orthogonal to the TypeScript
 * payload type (TECH-003). A port without `payload` delivers a complete value, so it is buffered.
 */
export function workflowEditorPortPayloadMode(
  port: Pick<WorkflowEditorPort, "payload">,
): WorkflowEditorPortPayloadMode {
  return port.payload?.mode ?? "buffered";
}

export function isWorkflowEditorPortPayloadLike(
  value: unknown,
): value is WorkflowEditorPortPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const { mode, mediaType } = value as Record<string, unknown>;
  return (
    (mode === "buffered" || mode === "streamed") &&
    (mediaType === undefined || typeof mediaType === "string")
  );
}

export type WorkflowEditorPortPayloadMismatch = {
  reason: "payload-mode-mismatch" | "media-type-mismatch";
  message: string;
};

/** Checks delivery mode first, then declared media types; `null` means compatible. */
export function findWorkflowEditorPortPayloadMismatch(
  source: Pick<WorkflowEditorPort, "payload">,
  target: Pick<WorkflowEditorPort, "payload">,
): WorkflowEditorPortPayloadMismatch | null {
  const sourceMode = workflowEditorPortPayloadMode(source);
  const targetMode = workflowEditorPortPayloadMode(target);
  if (sourceMode !== targetMode) {
    return {
      reason: "payload-mode-mismatch",
      message: `A ${sourceMode} output cannot connect to a ${targetMode} input. Add an explicit conversion node between them.`,
    };
  }
  const sourceMedia = source.payload?.mediaType;
  const targetMedia = target.payload?.mediaType;
  if (sourceMedia && targetMedia && !mediaTypesMatch(sourceMedia, targetMedia)) {
    return {
      reason: "media-type-mismatch",
      message: `Media type ${sourceMedia} does not match the input's media type ${targetMedia}.`,
    };
  }
  return null;
}

/** Short label for port chrome, for example `streamed · audio/wav`. */
export function formatWorkflowEditorPortPayload(payload: WorkflowEditorPortPayload): string {
  return payload.mediaType ? `${payload.mode} · ${payload.mediaType}` : payload.mode;
}

function mediaTypesMatch(left: string, right: string): boolean {
  const [leftType, leftSubtype] = normalizeMediaType(left);
  const [rightType, rightSubtype] = normalizeMediaType(right);
  return (
    leftType === rightType &&
    (leftSubtype === rightSubtype || leftSubtype === "*" || rightSubtype === "*")
  );
}

function normalizeMediaType(value: string): [string, string] {
  const [type = "", subtype = ""] = value.split(";")[0]!.trim().toLowerCase().split("/");
  return [type, subtype];
}
