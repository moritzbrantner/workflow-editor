# Agent Instructions

## Editor UX authority

- Interactive workbenches apply the current shared `ui` conventions from `moritzbrantner/coding-agent-conventions`, especially `UI-008`, `UI-012`, and `UI-013`.
- Reuse `graph-editor` for generic graph gestures and selection state. Workflow-editor owns workflow-specific node/port semantics and commands, not a second marquee, pan, drag, or connection interaction.
- Keep the workflow canvas as the primary workspace. Prefer direct node/edge manipulation and contextual editing; inspectors and forms provide precision or secondary configuration rather than duplicating canvas operations.
- When an interaction defect originates in graph-editor, repair the owning graph primitive instead of layering workflow-local overlays, CSS patches, or parallel gesture state over it.

## Agent skills

This repository is configured for the Matt Pocock workflow skills and the agent-loop control plane.

- Issue tracker: `docs/agents/issue-tracker.md`
- Triage labels: `docs/agents/triage-labels.md`
- Domain context: `docs/agents/domain.md`
- Planning workflow: `docs/agents/planning-workflow.md`

### Planning workflow

Substantial new work should be planned into GitHub PRD issues instead of implemented directly. See `docs/agents/planning-workflow.md`.
