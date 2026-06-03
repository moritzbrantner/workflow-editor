# @moritzbrantner/workflow-editor

Node graph workflow document utilities and a controlled React workbench for editing workflow graphs.

[Open the example workbench](https://moritzbrantner.github.io/workflow-editor/)

## Install

```sh
bun add @moritzbrantner/workflow-editor
```

The React workbench expects `react` as a peer dependency and consumes
`@moritzbrantner/ui@^0.8.0`.

## Main APIs

- `WorkflowWorkbench` for a React node graph editor built on `@moritzbrantner/ui`.
- `WorkflowEditor` for a browser-first workflow editor shell with document library controls,
  local saving/loading, JSON import/export, explicit versions, and undo/redo.
- `defaultWorkflowEditorNodeTemplates`,
  `workflowEditorControlFlowNodeTemplates`,
  `workflowEditorJsonNodeTemplates`, and
  `workflowEditorCollectionNodeTemplates` for built-in control-flow, JSON value, and
  collection transform nodes.
- `normalizeWorkflowEditorDocument(...)`, `connectWorkflowEditorNodes(...)`, `duplicateWorkflowEditorNode(...)`, and node/edge mutation helpers.
- `copyWorkflowEditorSelection(...)`, `pasteWorkflowEditorClipboardPayload(...)`,
  `duplicateWorkflowEditorSelection(...)`, and `removeWorkflowEditorSelection(...)`
  for headless selected-subgraph clipboard operations.
- `layoutWorkflowEditorDocument(...)` for deterministic automatic graph layout powered by Dagre.
- `createWorkflowEditorComposedNode(...)`, `composeWorkflowEditorNodes(...)`,
  `restoreWorkflowEditorComposedNode(...)`, and `hasWorkflowEditorNodeComposition(...)`
  for reusable component-style nodes backed by embedded subgraphs.
- `updateWorkflowEditorNodeWorkflowReference(...)`,
  `getWorkflowEditorReferencedDocumentIds(...)`, and
  `getWorkflowEditorReferenceDiagnostics(...)` for reference-based nested workflow support.
- `validateWorkflowEditorConnection(...)`, `detectWorkflowEditorCycles(...)`, `topologicallySortWorkflowEditorNodes(...)`, and UI adapter helpers.
- `validateWorkflowEditorDocument(...)`, `assertWorkflowEditorDocument(...)`, and
  `WorkflowEditorDocumentValidationError` for strict document validation diagnostics.
- `createWorkflowEditorLibrary(...)`, `createLocalStorageWorkflowEditorStorage(...)`,
  `buildWorkflowEditorDocumentFile(...)`, and `parseWorkflowEditorDocumentFile(...)`
  for headless persistence.
- `createWorkflowEditorHistory(...)`, `commitWorkflowEditorHistory(...)`,
  `undoWorkflowEditorHistory(...)`, and `redoWorkflowEditorHistory(...)` for
  headless transaction history.
- `encodeWorkflowEditorSharePayload(...)` and `decodeWorkflowEditorSharePayload(...)`
  for dependency-free share tokens.

## Browser-first Editor

```tsx
import "@moritzbrantner/ui/styles.css";

import {
  WorkflowEditor,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor";

const initialLibrary = createWorkflowEditorLibrary({
  documents: [
    createWorkflowEditorEntry({
      id: "demo",
      name: "Demo workflow",
      document: normalizeWorkflowEditorDocument({
        nodes: [],
        edges: [],
      }),
    }),
  ],
  activeDocumentId: "demo",
});

export function App() {
  return (
    <WorkflowEditor
      storageKey="my-product.workflow-editor"
      initialLibrary={initialLibrary}
      nodeTemplates={defaultWorkflowEditorNodeTemplates}
    />
  );
}
```

## Modular Chrome

The default editor shell is still available, but the React API also exposes controller hooks and
movable chrome components for custom layouts.

```tsx
import {
  WorkflowEditorOverviewPanel,
  WorkflowEditorSettingsPanel,
  WorkflowEditorDocumentMenu,
  WorkflowWorkbenchCanvas,
  WorkflowWorkbenchInspector,
  WorkflowWorkbenchPalette,
  useWorkflowEditorController,
} from "@moritzbrantner/workflow-editor";

export function CustomWorkflowEditor(props) {
  const controller = useWorkflowEditorController(props);

  return (
    <div className="grid h-screen grid-cols-[18rem_minmax(0,1fr)_22rem] grid-rows-[auto_1fr]">
      <header className="col-span-3">
        <WorkflowEditorDocumentMenu controller={controller} />
        <WorkflowEditorSettingsPanel controller={controller} />
      </header>
      <WorkflowWorkbenchPalette controller={controller.workbench} />
      <WorkflowWorkbenchCanvas controller={controller.workbench} />
      <aside className="grid min-h-0 gap-3 overflow-y-auto">
        <WorkflowWorkbenchInspector controller={controller.workbench} />
        <WorkflowEditorOverviewPanel controller={controller} />
      </aside>
    </div>
  );
}
```

Settings and catalogs are controlled by the host app. Scalar editor props remain supported; when
both a scalar prop and `settings.editor` provide the same value, the scalar prop wins.

```tsx
const [settings, setSettings] = useState({
  editor: {
    compactControls: false,
    enableNestedWorkflows: true,
    maxNestedWorkflowDepth: 64,
    maxVersions: 10,
    readOnly: false,
    showDocumentPath: true,
    showDocumentStats: true,
    showWorkbenchStats: true,
  },
  app: { environment: "staging" },
});
const [typeDefinitions, setTypeDefinitions] = useState([]);
const [nodeTemplates, setNodeTemplates] = useState(defaultWorkflowEditorNodeTemplates);

const controller = useWorkflowEditorController({
  settings,
  settingsFields: [
    {
      key: "environment",
      label: "Environment",
      kind: "select",
      options: [
        { value: "staging", label: "Staging" },
        { value: "production", label: "Production" },
      ],
    },
  ],
  onSettingsChange: setSettings,
  typeDefinitions,
  onTypeDefinitionsChange: setTypeDefinitions,
  nodeTemplates,
  onNodeTemplatesChange: setNodeTemplates,
});
```

For smaller changes, use slots on the existing components:

```tsx
<WorkflowEditor
  {...props}
  chrome={{
    documentControls: (controller) => (
      <header>
        <WorkflowEditorDocumentMenu controller={controller} />
      </header>
    ),
    palette: "hidden",
  }}
/>
```

## Notes

- The package also exposes `@moritzbrantner/workflow-editor/core` and `@moritzbrantner/workflow-editor/react` subpaths.
- Persistence, history, share, and editor shell helpers are also available through
  `@moritzbrantner/workflow-editor/persistence`,
  `@moritzbrantner/workflow-editor/history`,
  `@moritzbrantner/workflow-editor/share`, and
  `@moritzbrantner/workflow-editor/editor`.
- The package owns workflow document state and graph validation; `@moritzbrantner/ui` supplies the generic graph surface and inspector controls.
- Node templates can set `category` or `categoryPath` to group the node palette into flat
  categories or nested category trees.
- `normalizeWorkflowEditorDocument(...)` validates strictly by default and throws
  `WorkflowEditorDocumentValidationError` when nodes, edges, ids, endpoints, or graph
  cycles are invalid. Use `validateWorkflowEditorDocument(...)` to inspect diagnostics
  without throwing.
- To accept older or partially invalid graph data and preserve the previous pruning behavior,
  use repair mode:

  ```ts
  const document = normalizeWorkflowEditorDocument(importedDocument, { mode: "repair" });
  ```

  Repair mode normalizes node coordinates and viewport values, removes dangling/self/cycle-forming
  edges, and syncs built-in object-constructor and object-decomposition nodes.

- Imported workflow JSON files are validated strictly. Malformed workflow documents fail with
  validation diagnostics instead of being silently repaired.
- Workflow ports use serializable TypeScript-like `type` objects instead of port-level
  `kind` strings. `validateWorkflowEditorConnection(...)` accepts an optional
  `typeDefinitions` registry and allows an output to connect to an input when the
  output type is assignable to the input type.
- Nested workflows are reusable document references stored on nodes as
  `workflowRef: { documentId }`. References may point to any document, including
  the current document. The editor shell supports drill-in breadcrumbs with a
  finite `maxNestedWorkflowDepth` guard; graph DAG validation remains scoped to
  edges inside each individual document.
- Composed workflow nodes embed a normalized subgraph on the node as `composition`.
  `composeWorkflowEditorNodes(...)` wraps selected nodes, exposes boundary ports
  for unconnected or externally connected inputs/outputs, and reroutes external
  edges through the wrapper. `restoreWorkflowEditorComposedNode(...)` expands the
  wrapper back into ordinary nodes and edges.
- `WorkflowWorkbench` supports multi-select, copy/paste, duplicate, delete, and
  arrange actions. Use `selectedNodeIds`, `selectedEdgeIds`, and
  `onSelectionStateChange(...)` for controlled multi-selection; the older
  `selectedNodeId`, `selectedEdgeId`, and `onSelectionChange(...)` props remain
  available for single-selection integrations.

## Development

Tests and benchmarks default to one worker to keep memory use predictable. Override the cap with
`WORKFLOW_EDITOR_WORKERS`, or use the narrower `WORKFLOW_EDITOR_TEST_WORKERS` and
`WORKFLOW_EDITOR_PLAYWRIGHT_WORKERS` variables when needed.

```sh
WORKFLOW_EDITOR_WORKERS=2 bun run test
WORKFLOW_EDITOR_WORKERS=2 bun run bench
WORKFLOW_EDITOR_PLAYWRIGHT_WORKERS=2 bun run test:playwright
```

Storybook is available for the React workbench and editor shell:

```sh
bun run storybook
bun run storybook:build
```

Unit, integration, e2e, and Storybook files are colocated in `src` next to the source surface they
cover. Root config files remain at the repository root because they configure the package-wide
tooling.

## Clipboard and Layout

```ts
import {
  copyWorkflowEditorSelection,
  layoutWorkflowEditorDocument,
  pasteWorkflowEditorClipboardPayload,
} from "@moritzbrantner/workflow-editor";

const selection = {
  nodeIds: ["source", "transform"],
  edgeIds: [],
  primary: { type: "node", id: "transform" },
};

const clipboard = copyWorkflowEditorSelection(document, selection);
const pasted = pasteWorkflowEditorClipboardPayload(document, clipboard);
const arranged = layoutWorkflowEditorDocument(pasted.document, {
  direction: "right",
});
```

Layout is also available from the focused subpath:

```ts
import { layoutWorkflowEditorDocument } from "@moritzbrantner/workflow-editor/layout";
```

## Enhancement Roadmap

- Configurable graph validation policies.
- Port cardinality rules for single-input and multi-input ports.
- Typed node template registries with validation.
- Accessibility coverage for keyboard-only graph editing.
- Demo pages for pipeline, automation, and branching workflow examples.
