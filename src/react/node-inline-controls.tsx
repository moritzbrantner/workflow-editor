import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Input, Textarea, Toggle, cn } from "@moritzbrantner/ui";

import {
  formatWorkflowEditorObjectConstructorExpression,
  validateWorkflowEditorObjectConstructorExpression,
  type WorkflowEditorNode,
} from "../core";
import { isRecord } from "./workbench-model";

const workflowNodeTextControlClassName =
  "border-zinc-300 bg-white/95 text-[11px] font-medium text-zinc-950 shadow-sm [--ui-input-height:1.5rem] [--ui-input-padding-x:0.5rem] [--ui-input-radius:0.25rem] focus-visible:ring-zinc-950/35 disabled:opacity-70";
const workflowJsonPrimitiveTextControlClassName = cn(
  workflowNodeTextControlClassName,
  "h-6 min-h-0 py-0 leading-none",
);
const workflowNodeTextareaControlClassName =
  "resize-none rounded border-zinc-300 bg-white/95 px-2 py-1.5 font-mono text-[11px] leading-4 text-zinc-950 shadow-sm focus-visible:ring-zinc-950/35 disabled:bg-white/95 disabled:opacity-70";
const workflowNodeToggleGroupControlClassName =
  "h-6 w-full overflow-hidden rounded border border-zinc-300 bg-white/95 p-0 shadow-sm";
const workflowNodeToggleItemClassName =
  "h-full min-w-0 flex-1 rounded-none border-0 px-2 text-[11px] font-semibold uppercase text-zinc-700 shadow-none data-[state=on]:bg-zinc-950 data-[state=on]:text-white";

export function WorkflowNodeRenameControl<TNodeData extends Record<string, unknown>>({
  node,
  onCancel,
  onCommit,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onCancel: () => void;
  onCommit: (nodeId: string, label: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closedRef = useRef(false);
  const [draft, setDraft] = useState(node.label);

  useEffect(() => {
    setDraft(node.label);
    closedRef.current = false;
  }, [node.id, node.label]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, []);

  const commitDraft = () => {
    if (closedRef.current) {
      return;
    }

    closedRef.current = true;
    const nextLabel = draft.trim();

    if (!nextLabel || nextLabel === node.label) {
      onCancel();
      return;
    }

    onCommit(node.id, nextLabel);
  };

  const cancelDraft = () => {
    if (closedRef.current) {
      return;
    }

    closedRef.current = true;
    onCancel();
  };

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelDraft();
    }
  };

  return (
    <div
      data-slot="workflow-node-rename-control"
      onPointerDownCapture={stopInteractionPropagation}
      onMouseDownCapture={stopInteractionPropagation}
      onClick={stopInteractionPropagation}
      onDoubleClick={stopInteractionPropagation}
    >
      <Input
        ref={inputRef}
        aria-label={`${node.label} node name`}
        className={cn(workflowNodeTextControlClassName, "h-7 w-full text-sm")}
        value={draft}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

export function WorkflowJsonPrimitiveNodeValueControl<TNodeData extends Record<string, unknown>>({
  node,
  onFocusNode,
  onValueChange,
  readOnly,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onFocusNode: (nodeId: string) => void;
  onValueChange: (nodeId: string, value: string | number | boolean | null) => void;
  readOnly: boolean;
}) {
  const value = readWorkflowEditorJsonPrimitiveNodeValue(node);
  const label = `${node.label} JSON value`;
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const [numberDraft, setNumberDraft] = useState(String(numberValue));

  useEffect(() => {
    setNumberDraft(String(numberValue));
  }, [node.id, numberValue]);

  const handleInteractionStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onFocusNode(node.id);
  };
  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  switch (node.kind) {
    case "json.string":
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          <Input
            aria-label={label}
            className={workflowJsonPrimitiveTextControlClassName}
            disabled={readOnly}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onValueChange(node.id, event.currentTarget.value)}
          />
        </div>
      );
    case "json.number":
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          <Input
            aria-label={label}
            className={workflowJsonPrimitiveTextControlClassName}
            disabled={readOnly}
            inputMode="decimal"
            type="number"
            value={numberDraft}
            onBlur={() => setNumberDraft(String(numberValue))}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              const parsedValue = Number(nextValue);
              setNumberDraft(nextValue);

              if (nextValue.trim() !== "" && Number.isFinite(parsedValue)) {
                onValueChange(node.id, parsedValue);
              }
            }}
          />
        </div>
      );
    case "json.boolean": {
      const booleanValue = value === true;
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          role="group"
          aria-label={label}
          className={cn("inline-flex", workflowNodeToggleGroupControlClassName)}
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          {[false, true].map((option) => (
            <Toggle
              key={String(option)}
              aria-label={`Set ${node.label} to ${option ? "true" : "false"}`}
              className={workflowNodeToggleItemClassName}
              disabled={readOnly}
              pressed={booleanValue === option}
              onPressedChange={() => onValueChange(node.id, option)}
            >
              {option ? "true" : "false"}
            </Toggle>
          ))}
        </div>
      );
    }
    case "json.null":
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          <Input
            aria-label={label}
            className={workflowJsonPrimitiveTextControlClassName}
            disabled
            value="null"
            readOnly
          />
        </div>
      );
    default:
      return null;
  }
}

export function WorkflowObjectConstructorExpressionControl<
  TNodeData extends Record<string, unknown>,
>({
  node,
  onDraftChange,
  onFocusNode,
  onValueChange,
  readOnly,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onDraftChange: (nodeId: string, value: string) => void;
  onFocusNode: (nodeId: string) => void;
  onValueChange: (nodeId: string, value: string) => void;
  readOnly: boolean;
}) {
  const expression = formatWorkflowEditorObjectConstructorExpression(node);
  const [draft, setDraft] = useState(expression);
  const [focused, setFocused] = useState(false);
  const validationMessage = validateWorkflowEditorObjectConstructorExpression(draft)[0]?.message;
  const validationMessageId = `${node.id}-object-expression-validation`;

  useEffect(() => {
    if (!focused && !validationMessage) {
      setDraft(expression);
      onDraftChange(node.id, expression);
    }
  }, [focused, node.id, expression, onDraftChange, validationMessage]);

  const handleInteractionStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onFocusNode(node.id);
  };
  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };
  const commitDraft = () => {
    if (!validationMessage && draft !== expression) {
      onValueChange(node.id, draft);
    }
  };
  const updateDraft = (value: string) => {
    setDraft(value);
    onDraftChange(node.id, value);

    if (!validateWorkflowEditorObjectConstructorExpression(value)[0]) {
      onValueChange(node.id, value);
    }
  };

  return (
    <div
      data-slot="workflow-object-constructor-node-control"
      className="flex h-full flex-col gap-1"
      onPointerDownCapture={handleInteractionStart}
      onMouseDownCapture={stopInteractionPropagation}
      onClick={stopInteractionPropagation}
    >
      <Textarea
        aria-label={`${node.label} object expression`}
        aria-describedby={validationMessage ? validationMessageId : undefined}
        aria-invalid={validationMessage ? true : undefined}
        className={cn(workflowNodeTextareaControlClassName, "min-h-0 w-full flex-1")}
        disabled={readOnly}
        spellCheck={false}
        value={draft}
        onBlur={() => {
          setFocused(false);
          commitDraft();
        }}
        onChange={(event) => updateDraft(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
      />
      {validationMessage ? (
        <div
          id={validationMessageId}
          className="min-h-4 truncate text-[11px] leading-4 text-red-600"
          role="alert"
        >
          {validationMessage}
        </div>
      ) : null}
    </div>
  );
}

export function isWorkflowEditorJsonPrimitiveNode<TData>(
  node: WorkflowEditorNode<TData>,
): node is WorkflowEditorNode<TData> & {
  kind: "json.string" | "json.number" | "json.boolean" | "json.null";
} {
  return (
    node.kind === "json.string" ||
    node.kind === "json.number" ||
    node.kind === "json.boolean" ||
    node.kind === "json.null"
  );
}

function readWorkflowEditorJsonPrimitiveNodeValue<TData>(
  node: WorkflowEditorNode<TData>,
): string | number | boolean | null {
  const value = isRecord(node.data) ? node.data.value : undefined;

  switch (node.kind) {
    case "json.string":
      return typeof value === "string" ? value : "";
    case "json.number":
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    case "json.boolean":
      return value === true;
    case "json.null":
      return null;
    default:
      return null;
  }
}
