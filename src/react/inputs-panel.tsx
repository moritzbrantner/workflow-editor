import { useState } from "react";

import { Button, Input } from "@moritzbrantner/ui";

import {
  getWorkflowEditorInputDeclarations,
  resolveWorkflowEditorInputValues,
  validateWorkflowEditorInputValues,
  workflowEditorPortTypeSource,
  type WorkflowEditorDocument,
  type WorkflowEditorInputProfile,
  type WorkflowEditorTypeDefinition,
} from "../core";

/** Host wiring for named input profiles (#115); profiles live on the library entry. */
export type WorkflowWorkbenchInputProfiles = {
  profiles: readonly WorkflowEditorInputProfile[];
  onChange: (profiles: WorkflowEditorInputProfile[]) => void;
  /** A connected host's Run/Test seam; it receives validated values with defaults filled in. */
  onRun?: (
    values: Record<string, unknown>,
    profile: WorkflowEditorInputProfile | undefined,
  ) => void;
};

function draftOf(value: unknown) {
  return value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

/** Text drafts become strings for string inputs and JSON for everything else. */
function parseDraft(draft: string, typeSource: string): unknown {
  if (draft.trim() === "") return undefined;
  if (typeSource === "string") return draft;
  try {
    return JSON.parse(draft) as unknown;
  } catch {
    return draft;
  }
}

let profileCounter = 0;

/**
 * The generated input form and named profiles, shown in document settings next to triggers.
 * Profile values never enter the document or its compiled workflow.
 */
export function WorkflowInputsPanel({
  document,
  typeDefinitions,
  readOnly,
  inputProfiles,
}: {
  document: WorkflowEditorDocument<unknown, unknown>;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  readOnly: boolean;
  inputProfiles?: WorkflowWorkbenchInputProfiles;
}) {
  const declarations = getWorkflowEditorInputDeclarations(document);
  const profiles = inputProfiles?.profiles ?? [];
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const selected = profiles.find((profile) => profile.id === profileId);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      declarations.map((input) => [input.id, draftOf(selected?.values[input.id])]),
    ),
  );
  const [name, setName] = useState(selected?.name ?? "");

  if (declarations.length === 0) {
    return (
      <section aria-label="Inputs" className="grid gap-1 border-t p-4 text-sm">
        <h3 className="text-sm font-semibold">Inputs</h3>
        <p className="text-xs text-muted-foreground">
          Add output ports to a Start node to declare typed workflow inputs.
        </p>
      </section>
    );
  }

  const values = Object.fromEntries(
    declarations.flatMap((input) => {
      const value = parseDraft(drafts[input.id] ?? "", workflowEditorPortTypeSource(input.type));
      return value === undefined ? [] : [[input.id, value]];
    }),
  );
  const diagnostics = validateWorkflowEditorInputValues(document, values, { typeDefinitions });
  const choose = (id: string) => {
    const profile = profiles.find((candidate) => candidate.id === id);
    setProfileId(id);
    setName(profile?.name ?? "");
    setDrafts(
      Object.fromEntries(
        declarations.map((input) => [input.id, draftOf(profile?.values[input.id])]),
      ),
    );
  };
  const save = () => {
    if (!inputProfiles) return;
    const id = selected?.id ?? `profile-${Date.now().toString(36)}-${(profileCounter += 1)}`;
    const profile = { id, name: name.trim() || "Untitled profile", values };
    inputProfiles.onChange(
      selected
        ? profiles.map((candidate) => (candidate.id === id ? profile : candidate))
        : [...profiles, profile],
    );
    setProfileId(id);
  };

  return (
    <section aria-label="Inputs" className="grid gap-2 border-t p-4 text-sm">
      <h3 className="text-sm font-semibold">Inputs</h3>
      {inputProfiles ? (
        <select
          aria-label="Input profile"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={profileId}
          onChange={(event) => choose(event.target.value)}
        >
          <option value="">New profile</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      ) : null}
      {declarations.map((input) => {
        const message = diagnostics.find((diagnostic) => diagnostic.inputId === input.id)?.message;
        return (
          <label key={`${input.nodeId}:${input.id}`} className="grid gap-1 text-xs">
            <span>
              {input.label}
              {input.required ? " *" : ""}{" "}
              <code className="text-muted-foreground">
                {workflowEditorPortTypeSource(input.type)}
              </code>
            </span>
            <Input
              aria-label={`Input ${input.label}`}
              placeholder={
                input.defaultValue === undefined ? "" : `Default: ${draftOf(input.defaultValue)}`
              }
              value={drafts[input.id] ?? ""}
              disabled={readOnly}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setDrafts((current) => ({ ...current, [input.id]: value }));
              }}
            />
            {message ? (
              <span role="alert" className="text-destructive">
                {message}
              </span>
            ) : null}
          </label>
        );
      })}
      {inputProfiles ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Profile name"
            className="h-8 w-40"
            value={name}
            placeholder="Profile name"
            disabled={readOnly}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={save}>
            Save profile
          </Button>
          {selected ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={readOnly}
              onClick={() => {
                inputProfiles.onChange(profiles.filter((profile) => profile.id !== selected.id));
                choose("");
              }}
            >
              Delete profile
            </Button>
          ) : null}
        </div>
      ) : null}
      {inputProfiles?.onRun ? (
        <Button
          type="button"
          size="sm"
          disabled={diagnostics.length > 0}
          onClick={() =>
            inputProfiles.onRun?.(resolveWorkflowEditorInputValues(document, values), selected)
          }
        >
          Run with these inputs
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          No workflow host is connected, so runs are unavailable; profiles are saved with the
          library.
        </p>
      )}
    </section>
  );
}
