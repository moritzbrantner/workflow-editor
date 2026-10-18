import { describe, expect, it } from "vitest";

import { compileWorkflowEditorDocument } from "./compiler";
import {
  composeWorkflowEditorNodes,
  createWorkflowEditorSharedTemplateRevision,
  detachWorkflowEditorLinkedNode,
  isWorkflowEditorPaletteTemplate,
  listWorkflowEditorLinkedInstances,
  planWorkflowEditorLinkedTemplateUpgrade,
  resolveWorkflowEditorLinkedNodes,
  resolveWorkflowEditorLinkedTemplate,
  upgradeWorkflowEditorLinkedNode,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
} from "./core";
import {
  buildWorkflowEditorDocumentFile,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  parseWorkflowEditorDocumentFile,
  parseWorkflowEditorLibrary,
} from "./persistence";

const ts = (source: string) => ({ kind: "typescript" as const, source });

/** read(file) → normalize(file), composed into "Normalize File". */
function normalizeFileNode(): WorkflowEditorNode {
  const document: WorkflowEditorDocument = {
    nodes: [
      {
        id: "read",
        label: "Read file",
        kind: "file.read",
        x: 0,
        y: 0,
        inputs: [{ id: "file", label: "File", type: ts("string") }],
        outputs: [{ id: "bytes", label: "Bytes", type: ts("string") }],
      },
      {
        id: "normalize",
        label: "Normalize",
        kind: "file.normalize",
        x: 300,
        y: 0,
        inputs: [{ id: "bytes", label: "Bytes", type: ts("string") }],
        outputs: [{ id: "text", label: "Text", type: ts("string") }],
      },
    ],
    edges: [
      {
        id: "read-normalize",
        sourceNodeId: "read",
        sourcePortId: "bytes",
        targetNodeId: "normalize",
        targetPortId: "bytes",
      },
    ],
  };
  const composed = composeWorkflowEditorNodes(document, ["read", "normalize"], {
    id: "normalize-file",
    label: "Normalize File",
  });
  return composed.nodes.find((node) => node.id === "normalize-file")!;
}

/** source → linked instance → sink, using the template's current ports. */
function consumer(template: WorkflowEditorNodeTemplate, inputId: string): WorkflowEditorDocument {
  return {
    nodes: [
      {
        id: "source",
        label: "Source",
        kind: "data.source",
        x: 0,
        y: 0,
        outputs: [{ id: "out", label: "Out", type: ts("string") }],
      },
      {
        id: "instance",
        label: "Normalize File",
        kind: template.kind,
        x: 300,
        y: 0,
        inputs: template.inputs,
        outputs: template.outputs,
        composition: template.composition,
        templateRef: { ...template.shared! },
      },
      {
        id: "sink",
        label: "Sink",
        kind: "data.sink",
        x: 600,
        y: 0,
        inputs: [{ id: "in", label: "In", type: ts("string") }],
      },
    ],
    edges: [
      {
        id: "feed",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "instance",
        targetPortId: inputId,
      },
      {
        id: "drain",
        sourceNodeId: "instance",
        sourcePortId: template.outputs![0]!.id,
        targetNodeId: "sink",
        targetPortId: "in",
      },
    ],
  };
}

function withInnerLabel(node: WorkflowEditorNode, label: string): WorkflowEditorNode {
  return {
    ...node,
    composition: {
      ...node.composition!,
      nodes: node.composition!.nodes.map((inner) =>
        inner.id === "normalize" ? { ...inner, label } : inner,
      ),
    },
  };
}

function renameInput(node: WorkflowEditorNode, from: string, to: string): WorkflowEditorNode {
  return {
    ...node,
    inputs: node.inputs?.map((port) => (port.id === from ? { ...port, id: to, label: to } : port)),
    composition: {
      ...node.composition!,
      inputBoundaries: node.composition!.inputBoundaries.map((boundary) =>
        boundary.wrapperPortId === from ? { ...boundary, wrapperPortId: to } : boundary,
      ),
    },
  };
}

describe("linked shared templates (#65)", () => {
  const source = normalizeFileNode();
  const inputId = source.inputs![0]!.id;
  const r1 = createWorkflowEditorSharedTemplateRevision(source, [], {
    templateId: "normalize-file",
  });

  it("publishes immutable, identified revisions into the catalog", () => {
    expect(r1).toMatchObject({
      id: "normalize-file@1",
      label: "Normalize File",
      shared: { templateId: "normalize-file", revision: 1 },
    });
    const r2 = createWorkflowEditorSharedTemplateRevision(withInnerLabel(source, "Clean"), [r1], {
      templateId: "normalize-file",
    });
    expect(r2.id).toBe("normalize-file@2");
    // Publishing never mutates the earlier revision.
    expect(r1.composition!.nodes.find((node) => node.id === "normalize")?.label).toBe("Normalize");
    expect(isWorkflowEditorPaletteTemplate(r1, [r1, r2])).toBe(false);
    expect(isWorkflowEditorPaletteTemplate(r2, [r1, r2])).toBe(true);
  });

  it("propagates compatible revisions, pins incompatible ones, and upgrades explicitly", () => {
    const documentA = consumer(r1, inputId);
    const documentB = consumer(r1, inputId);
    const r2 = createWorkflowEditorSharedTemplateRevision(withInnerLabel(source, "Clean"), [r1], {
      templateId: "normalize-file",
    });
    const r3 = createWorkflowEditorSharedTemplateRevision(
      renameInput(withInnerLabel(source, "Clean"), inputId, "document"),
      [r1, r2],
      { templateId: "normalize-file" },
    );
    const catalog = [r1, r2, r3];

    // Compatible r2 applies to both; incompatible r3 is offered as an explicit upgrade.
    for (const document of [documentA, documentB]) {
      const resolved = resolveWorkflowEditorLinkedNodes(document, catalog);
      expect(resolved.diagnostics).toEqual([]);
      const instance = resolved.document.nodes.find((node) => node.id === "instance")!;
      expect(instance.templateRef).toEqual({ templateId: "normalize-file", revision: 2 });
      expect(instance.composition!.nodes.find((node) => node.id === "normalize")?.label).toBe(
        "Clean",
      );
      expect(resolved.document.edges.map((edge) => edge.id)).toEqual(["feed", "drain"]);
    }
    expect(
      resolveWorkflowEditorLinkedTemplate({ templateId: "normalize-file", revision: 1 }, catalog)
        ?.upgrade?.revision,
    ).toBe(3);

    // Explicit upgrade of A explains the connection that the renamed input drops.
    const a = resolveWorkflowEditorLinkedNodes(documentA, catalog).document;
    expect(planWorkflowEditorLinkedTemplateUpgrade(a, "instance", 3, catalog)).toEqual({
      revision: 3,
      removedEdgeIds: ["feed"],
      changedPortIds: [],
    });
    const upgradedA = upgradeWorkflowEditorLinkedNode(a, "instance", 3, catalog);
    expect(upgradedA.nodes.find((node) => node.id === "instance")?.templateRef?.revision).toBe(3);
    expect(upgradedA.edges.map((edge) => edge.id)).toEqual(["drain"]);

    // Detach B from r2: a local copy that no longer follows the catalog.
    const b = resolveWorkflowEditorLinkedNodes(documentB, catalog).document;
    const detachedB = detachWorkflowEditorLinkedNode(b, "instance");
    const local = detachedB.nodes.find((node) => node.id === "instance")!;
    expect(local.templateRef).toBeUndefined();
    expect(local.composition!.nodes.find((node) => node.id === "normalize")?.label).toBe("Clean");

    // A compatible r4 (on r3's contract) reaches A only.
    const r4 = createWorkflowEditorSharedTemplateRevision(
      renameInput(withInnerLabel(source, "Tidy"), inputId, "document"),
      catalog,
      { templateId: "normalize-file" },
    );
    const next = [...catalog, r4];
    const laterA = resolveWorkflowEditorLinkedNodes(upgradedA, next).document;
    expect(laterA.nodes.find((node) => node.id === "instance")?.templateRef?.revision).toBe(4);
    expect(resolveWorkflowEditorLinkedNodes(detachedB, next).document).toBe(detachedB);

    expect(
      listWorkflowEditorLinkedInstances(
        [
          { id: "a", name: "Workflow A", document: laterA },
          { id: "b", name: "Workflow B", document: b },
        ],
        "normalize-file",
        next,
      ).map(({ documentId, revision }) => [documentId, revision]),
    ).toEqual([
      ["a", 4],
      ["b", 2],
    ]);
  });

  it("reports missing templates and revisions instead of rebinding by name", () => {
    const document = consumer(r1, inputId);
    expect(resolveWorkflowEditorLinkedNodes(document, []).diagnostics).toEqual([
      expect.objectContaining({
        code: "missing-linked-template",
        path: "nodes.instance.templateRef",
      }),
    ]);
    const other = {
      ...r1,
      id: "normalize-file@7",
      shared: { templateId: "normalize-file", revision: 7 },
    };
    expect(resolveWorkflowEditorLinkedNodes(document, [other]).diagnostics).toEqual([
      expect.objectContaining({ code: "missing-linked-template-revision" }),
    ]);
  });

  it("compiles through the catalog and fails on a missing definition", () => {
    const r2 = createWorkflowEditorSharedTemplateRevision(withInnerLabel(source, "Clean"), [r1], {
      templateId: "normalize-file",
    });
    const compiled = compileWorkflowEditorDocument(consumer(r1, inputId), {
      nodeTemplates: [r1, r2],
      compositions: "expand",
    });
    expect(compiled.nodes.find((node) => node.id === "instance/normalize")?.label).toBe("Clean");
    expect(() =>
      compileWorkflowEditorDocument(consumer(r1, inputId), {
        nodeTemplates: [],
        compositions: "expand",
      }),
    ).toThrow(/not in the catalog/);
  });

  it("keeps the template reference through library and file round-trips", () => {
    const document = consumer(r1, inputId);
    const library = createWorkflowEditorLibrary({
      documents: [createWorkflowEditorEntry({ id: "a", name: "A", document })],
    });
    const restored = parseWorkflowEditorLibrary(JSON.stringify(library));
    expect(restored.status).toBe("loaded");
    const restoredLibrary = (restored as { library: typeof library }).library;
    expect(
      restoredLibrary.documents[0]!.document.nodes.find((node) => node.id === "instance")
        ?.templateRef,
    ).toEqual({ templateId: "normalize-file", revision: 1 });
    const file = parseWorkflowEditorDocumentFile(
      JSON.stringify(buildWorkflowEditorDocumentFile(document)),
    );
    expect(file.document.nodes.find((node) => node.id === "instance")?.templateRef).toEqual({
      templateId: "normalize-file",
      revision: 1,
    });
  });
});
