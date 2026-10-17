// Independent acceptance (issue #60) — authored before implementation by a separate
// acceptance agent/context. Authority: docs/DECISION-ATLAS.md 3.1 (consistent, configurable
// port type colors) and 1.1 (TypeScript's checker alone decides compatibility).
//
// Minimal contract fixed by this acceptance file (routine names; product intent from 3.1/#60):
//
// C1 Mapping location. The type-color mapping is user/host-managed editor configuration (#60
//    "user/host-managed type-color mapping"), not Workflow Document data:
//    `WorkflowEditorBuiltInSettings.portTypeColors: Readonly<Record<string, string>>`,
//    default `{}` in `defaultWorkflowEditorBuiltInSettings`, preserved by
//    `resolveWorkflowEditorSettings`, edited through the existing catalog settings actions.
// C2 Type identity ("each displayed type"). The key is the port's displayed TypeScript type
//    text, i.e. the text the Types panel shows for the port (trimmed). Legacy records that
//    display the same text (`{ kind: "string" }` and `{ kind: "typescript", source: "string" }`)
//    are the same displayed type. Assignability does NOT make types "the same" (3.1). Cases
//    where readings could differ (alias vs. inline structure, `Array<T>` vs `T[]`) are
//    deliberately not asserted here.
// C3 Resolver. `resolveWorkflowEditorPortTypeColor(type, portTypeColors?)` is exported from
//    the package root and returns the configured color for that displayed type, otherwise a
//    deterministic fallback color (same displayed type -> same color, independent of call
//    order or which port/node asks).
// C4 Presentation. `toUiWorkflowBuilderNodes(nodes, edges, { portTypeColors })` and
//    `toUiWorkflowBuilderEdges(edges, nodes, { portTypeColors })` apply the mapping to every
//    port of that type and to each edge (edge color = its source port's type color).
// C5 Precedence/migration. A configured type color wins over a legacy per-port `port.color`
//    so the shared type identity is never obscured; presenting does not delete or rewrite the
//    stored `port.color` (non-destructive). Behavior of `port.color` on unconfigured types is
//    left to the implementation and not asserted.
// C6 Colors never affect validity: identical colors (configured or legacy) do not make an
//    unassignable TypeScript connection valid.
import { cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import * as root from "@moritzbrantner/workflow-editor";
import {
  WorkflowEditor,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  defaultWorkflowEditorBuiltInSettings,
  isWorkflowEditorPortTypeAssignable,
  normalizeWorkflowEditorDocument,
  resolveWorkflowEditorSettings,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
  type WorkflowEditorPortType,
} from "@moritzbrantner/workflow-editor";
import {
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
} from "@moritzbrantner/workflow-editor/react";

type PortTypeColors = Readonly<Record<string, string>>;
type ColorOptions = { portTypeColors?: PortTypeColors };

// Loosely typed handles so this file type-checks before the contract exists; failures are
// reported at runtime against the baseline.
const resolveColor = (type: WorkflowEditorPortType, colors?: PortTypeColors): string => {
  const resolver = (root as Record<string, unknown>).resolveWorkflowEditorPortTypeColor;
  expect(resolver, "resolveWorkflowEditorPortTypeColor is exported (C3)").toBeTypeOf("function");
  return (resolver as (type: WorkflowEditorPortType, colors?: PortTypeColors) => string)(
    type,
    colors,
  );
};
const uiNodes = toUiWorkflowBuilderNodes as unknown as (
  nodes: WorkflowEditorNode[],
  edges?: readonly WorkflowEditorEdge[],
  options?: ColorOptions,
) => ReturnType<typeof toUiWorkflowBuilderNodes>;
const uiEdges = toUiWorkflowBuilderEdges as unknown as (
  edges: WorkflowEditorEdge[],
  nodes?: WorkflowEditorNode[],
  options?: ColorOptions,
) => ReturnType<typeof toUiWorkflowBuilderEdges>;

const ts = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });
const hexColor = /^#[0-9a-f]{6}$/i;
const red = "#e11d48";
const blue = "#2563eb";

const declarations = "type Customer = { id: string; name?: string };";

function colorDocument(legacyColor?: string): WorkflowEditorDocument {
  return normalizeWorkflowEditorDocument({
    typeDeclarations: declarations,
    nodes: [
      {
        id: "customer-a",
        label: "Customer A",
        x: 0,
        y: 0,
        outputs: [
          {
            id: "value",
            label: "Value",
            type: ts("Customer"),
            ...(legacyColor ? { color: legacyColor } : {}),
          },
        ],
      },
      {
        id: "customer-b",
        label: "Customer B",
        x: 0,
        y: 200,
        minimized: true,
        outputs: [{ id: "value", label: "Value", type: ts("Customer") }],
      },
      {
        id: "sink-a",
        label: "Customer sink A",
        x: 320,
        y: 0,
        inputs: [{ id: "value", label: "Value", type: ts("Customer") }],
      },
      {
        id: "sink-b",
        label: "Customer sink B",
        x: 320,
        y: 200,
        minimized: true,
        inputs: [{ id: "value", label: "Value", type: ts("Customer") }],
      },
      {
        id: "number-source",
        label: "Number source",
        x: 0,
        y: 400,
        outputs: [
          {
            id: "value",
            label: "Value",
            type: ts("number"),
            ...(legacyColor ? { color: legacyColor } : {}),
          },
        ],
      },
      {
        id: "number-sink",
        label: "Number sink",
        x: 320,
        y: 400,
        inputs: [
          {
            id: "value",
            label: "Value",
            type: ts("number"),
            ...(legacyColor ? { color: legacyColor } : {}),
          },
        ],
      },
      {
        id: "number-spare",
        label: "Number spare",
        x: 320,
        y: 600,
        inputs: [
          {
            id: "value",
            label: "Value",
            type: ts("number"),
            ...(legacyColor ? { color: legacyColor } : {}),
          },
        ],
      },
    ],
    edges: [
      {
        id: "a",
        sourceNodeId: "customer-a",
        sourcePortId: "value",
        targetNodeId: "sink-a",
        targetPortId: "value",
      },
      {
        id: "b",
        sourceNodeId: "customer-b",
        sourcePortId: "value",
        targetNodeId: "sink-b",
        targetPortId: "value",
      },
      {
        id: "n",
        sourceNodeId: "number-source",
        sourcePortId: "value",
        targetNodeId: "number-sink",
        targetPortId: "value",
      },
    ],
  }).document;
}

function presentedPortColors(document: WorkflowEditorDocument, colors?: PortTypeColors) {
  const result = new Map<string, string | undefined>();
  for (const node of uiNodes(document.nodes, document.edges, { portTypeColors: colors })) {
    for (const [direction, ports] of [
      ["in", node.inputs ?? []],
      ["out", node.outputs ?? []],
    ] as const) {
      for (const port of ports) {
        result.set(`${node.id}:${direction}:${port.id}`, (port as { color?: string }).color);
      }
    }
  }
  return result;
}

function presentedEdgeColors(document: WorkflowEditorDocument, colors?: PortTypeColors) {
  return new Map(
    uiEdges(document.edges, document.nodes, { portTypeColors: colors }).map((edge) => [
      edge.id,
      (edge as { color?: string }).color,
    ]),
  );
}

const customerPorts = [
  "customer-a:out:value",
  "customer-b:out:value",
  "sink-a:in:value",
  "sink-b:in:value",
];
const numberPorts = ["number-source:out:value", "number-sink:in:value", "number-spare:in:value"];

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("issue #60 acceptance: configurable, consistent port type colors", () => {
  test("C1: the mapping is a built-in editor setting with an empty default that resolution preserves", () => {
    expect(
      (defaultWorkflowEditorBuiltInSettings as unknown as { portTypeColors?: unknown })
        .portTypeColors,
    ).toEqual({});
    const resolved = resolveWorkflowEditorSettings({
      settings: {
        editor: {
          ...defaultWorkflowEditorBuiltInSettings,
          portTypeColors: { Customer: red },
        } as typeof defaultWorkflowEditorBuiltInSettings,
      },
    });
    expect((resolved.editor as unknown as { portTypeColors?: unknown }).portTypeColors).toEqual({
      Customer: red,
    });
    // Configuration is not written into the workflow document.
    const document = colorDocument();
    presentedPortColors(document, { Customer: red });
    expect(JSON.stringify(document)).not.toContain(red);
  });

  test("C3: unseen types get deterministic fallback colors that are stable per displayed type", () => {
    const types = ["Customer", "Order", "{ id: string }", "string[]", '"anonymous"'];
    for (const source of types) {
      const first = resolveColor(ts(source));
      expect(first).toMatch(hexColor);
      // Same displayed type -> same color, regardless of call order or other lookups.
      for (const other of [...types].reverse()) {
        resolveColor(ts(other));
      }
      expect(resolveColor(ts(source))).toBe(first);
      expect(resolveColor(ts(source), {})).toBe(first);
      // Configuring an unrelated type does not change this type's fallback color.
      expect(resolveColor(ts(source), { SomethingElse: blue })).toBe(first);
    }
    // Every unconfigured Customer port in a document shares one fallback color.
    const colors = presentedPortColors(colorDocument());
    const customer = new Set(customerPorts.map((key) => colors.get(key)));
    expect(customer.size).toBe(1);
    expect([...customer][0]).toMatch(hexColor);
    expect([...customer][0]).toBe(resolveColor(ts("Customer")));
  });

  test("C2: legacy records that display the same type text share one color", () => {
    expect(resolveColor({ kind: "string" })).toBe(resolveColor(ts("string")));
    expect(resolveColor({ kind: "number" })).toBe(resolveColor(ts("number")));
    expect(resolveColor({ kind: "string" }, { string: red })).toBe(red);
    expect(resolveColor(ts("string"), { string: red })).toBe(red);
    expect(resolveColor({ kind: "ref", name: "Customer" }, { Customer: red })).toBe(red);
  });

  test("C2: assignable but distinct types are colored independently", () => {
    const declarationsWithSubtype = `${declarations}\ntype VipCustomer = Customer & { tier: string };`;
    const subtypeDocument = normalizeWorkflowEditorDocument({
      typeDeclarations: declarationsWithSubtype,
      nodes: [
        {
          id: "vip",
          label: "Vip",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: ts("VipCustomer") }],
        },
        {
          id: "sink",
          label: "Sink",
          x: 300,
          y: 0,
          inputs: [{ id: "value", label: "Value", type: ts("Customer") }],
        },
      ],
      edges: [],
    }).document;
    // Precondition: TypeScript considers VipCustomer assignable to Customer.
    expect(
      validateWorkflowEditorConnection(subtypeDocument, {
        sourceNodeId: "vip",
        sourcePortId: "value",
        targetNodeId: "sink",
        targetPortId: "value",
      }).valid,
    ).toBe(true);
    const colors = { Customer: red, VipCustomer: blue };
    expect(resolveColor(ts("Customer"), colors)).toBe(red);
    expect(resolveColor(ts("VipCustomer"), colors)).toBe(blue);
    expect(resolveColor(ts("Customer"), { VipCustomer: blue })).not.toBe(blue);
  });

  test("C4: a configured type color applies to every port of that type and its edges, and nothing else", () => {
    const document = colorDocument();
    const fallbackNumber = resolveColor(ts("number"));
    const ports = presentedPortColors(document, { Customer: red });
    for (const key of customerPorts) {
      expect(ports.get(key), key).toBe(red);
    }
    for (const key of numberPorts) {
      expect(ports.get(key), key).toBe(fallbackNumber);
    }
    const edges = presentedEdgeColors(document, { Customer: red });
    expect(edges.get("a")).toBe(red);
    expect(edges.get("b")).toBe(red); // between minimized nodes
    expect(edges.get("n")).toBe(fallbackNumber);
  });

  test("C4: changing a configured color updates all matching presentations; another type keeps its own", () => {
    const document = colorDocument();
    const before = presentedPortColors(document, { Customer: red, number: blue });
    const after = presentedPortColors(document, { Customer: "#16a34a", number: blue });
    for (const key of customerPorts) {
      expect(before.get(key), key).toBe(red);
      expect(after.get(key), key).toBe("#16a34a");
    }
    for (const key of numberPorts) {
      expect(before.get(key), key).toBe(blue);
      expect(after.get(key), key).toBe(blue);
    }
    const edges = presentedEdgeColors(document, { Customer: "#16a34a", number: blue });
    expect([edges.get("a"), edges.get("b"), edges.get("n")]).toEqual(["#16a34a", "#16a34a", blue]);
  });

  test("C5: a configured type color wins over legacy port.color without rewriting the document", () => {
    const legacy = "#ff00ff";
    const document = colorDocument(legacy);
    const snapshot = JSON.stringify(document);
    const ports = presentedPortColors(document, { Customer: red, number: blue });
    for (const key of customerPorts) {
      expect(ports.get(key), key).toBe(red);
    }
    for (const key of numberPorts) {
      expect(ports.get(key), key).toBe(blue);
    }
    const edges = presentedEdgeColors(document, { Customer: red, number: blue });
    expect([edges.get("a"), edges.get("n")]).toEqual([red, blue]);
    // Presentation is non-destructive: stored per-port overrides stay in the document.
    expect(JSON.stringify(document)).toBe(snapshot);
    expect(document.nodes.find((node) => node.id === "customer-a")?.outputs?.[0]?.color).toBe(
      legacy,
    );
  });

  test("C6: identical colors never make an unassignable TypeScript connection valid", () => {
    for (const legacyColor of [undefined, red]) {
      const document = colorDocument(legacyColor);
      if (legacyColor) {
        // Precondition: source and target are presented in the identical (legacy) color.
        const presented = presentedPortColors(document);
        expect(presented.get("customer-a:out:value")).toBe(legacyColor);
        expect(presented.get("number-spare:in:value")).toBe(legacyColor);
      }
      // Validation takes no color input at all; configured colors (C1) live in editor
      // settings, so they cannot reach the TypeScript compatibility check either.
      const validity = validateWorkflowEditorConnection(document, {
        sourceNodeId: "customer-a",
        sourcePortId: "value",
        targetNodeId: "number-spare",
        targetPortId: "value",
      });
      expect(validity.valid).toBe(false);
      expect(validity.reason).toBe("type-mismatch");
      expect(validity.message ?? "").toMatch(/not assignable/i);
      expect(isWorkflowEditorPortTypeAssignable(ts("{ id: string }"), ts("number"))).toBe(false);
    }
  });

  test("C1+C4: the editor renders the configured setting on every port of the type, including minimized nodes", async () => {
    const library = createWorkflowEditorLibrary({
      activeDocumentId: "colors",
      documents: [
        createWorkflowEditorEntry({ id: "colors", name: "Colors", document: colorDocument() }),
      ],
    });
    const settings = {
      editor: {
        ...defaultWorkflowEditorBuiltInSettings,
        portTypeColors: { Customer: red, number: blue },
      } as typeof defaultWorkflowEditorBuiltInSettings,
    };
    const { container } = render(
      createElement(WorkflowEditor, {
        initialLibrary: library,
        storage: { loadLibrary: vi.fn(async () => null), saveLibrary: vi.fn(async () => {}) },
        settings,
        onSettingsChange: () => {},
      }),
    );
    const port = (nodeId: string, direction: "input" | "output") =>
      container.querySelector<HTMLElement>(
        `[data-slot="workflow-builder-node"][data-node-id="${nodeId}"] [data-slot="workflow-node-port"][data-port-direction="${direction}"][data-port-id="value"]`,
      );
    await waitFor(() => expect(port("customer-a", "output")).not.toBeNull());
    const rendered = (element: HTMLElement | null) => {
      const dot = element?.querySelector<HTMLElement>('[data-slot="workflow-node-port-dot"]');
      return [dot?.style.backgroundColor, element?.style.backgroundColor, dot?.style.color].join(
        " ",
      );
    };
    // jsdom serializes inline colors as rgb(); red = rgb(225, 29, 72), blue = rgb(37, 99, 235).
    for (const [nodeId, direction] of [
      ["customer-a", "output"],
      ["customer-b", "output"],
      ["sink-a", "input"],
      ["sink-b", "input"],
    ] as const) {
      expect(rendered(port(nodeId, direction)), nodeId).toContain("rgb(225, 29, 72)");
    }
    for (const [nodeId, direction] of [
      ["number-source", "output"],
      ["number-sink", "input"],
    ] as const) {
      expect(rendered(port(nodeId, direction)), nodeId).toContain("rgb(37, 99, 235)");
    }
  });
});
