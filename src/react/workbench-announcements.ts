import type {
  WorkflowEditorConnectionInvalidReason,
  WorkflowEditorConnectionValidity,
  WorkflowEditorDocument,
} from "../core-types";

type AnnouncedDocument = Pick<WorkflowEditorDocument, "nodes" | "edges" | "groups">;

const rejectionFallbacks: Record<WorkflowEditorConnectionInvalidReason, string> = {
  cycle: "it would create a cycle",
  duplicate: "the connection already exists",
  "input-occupied": "the input already has a connection",
  "kind-mismatch": "ports must connect an output to an input",
  "media-type-mismatch": "the media types are incompatible",
  "missing-node": "a node no longer exists",
  "missing-port": "a port no longer exists",
  "payload-mode-mismatch": "the payload modes are incompatible",
  "self-connection": "a node cannot connect to itself",
  "source-cardinality": "the output accepts no more connections",
  "target-cardinality": "the input accepts no more connections",
  "type-mismatch": "the port types are incompatible",
};

function count(amount: number, singular: string, plural = `${singular}s`) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function nodeNames(document: AnnouncedDocument, ids: readonly string[]) {
  if (ids.length !== 1) {
    return count(ids.length, "node");
  }

  const node = document.nodes.find((candidate) => candidate.id === ids[0]);
  return `node ${node?.label ?? ids[0]}`;
}

function portLabel(document: AnnouncedDocument, nodeId: string, portId: string, output: boolean) {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  const port = (output ? node?.outputs : node?.inputs)?.find(
    (candidate) => candidate.id === portId,
  );
  return `${node?.label ?? nodeId} ${port?.label ?? portId}`;
}

/**
 * Describes a committed workflow document change for an ARIA live region.
 *
 * Returns `null` for changes that are not user edits worth announcing (viewport-only changes, or
 * switching to an unrelated document).
 */
export function describeWorkflowWorkbenchDocumentChange(
  previous: AnnouncedDocument,
  next: AnnouncedDocument,
): string | null {
  if (previous === next) {
    return null;
  }

  const previousNodeIds = new Set(previous.nodes.map((node) => node.id));
  const nextNodeIds = new Set(next.nodes.map((node) => node.id));
  const addedNodes = next.nodes.filter((node) => !previousNodeIds.has(node.id)).map((n) => n.id);
  const removedNodes = previous.nodes.filter((node) => !nextNodeIds.has(node.id)).map((n) => n.id);

  if (
    previous.nodes.length > 0 &&
    next.nodes.length > 0 &&
    removedNodes.length === previous.nodes.length &&
    addedNodes.length === next.nodes.length
  ) {
    // A different document was opened; that is navigation, not an edit.
    return null;
  }

  const previousEdgeIds = new Set(previous.edges.map((edge) => edge.id));
  const nextEdgeIds = new Set(next.edges.map((edge) => edge.id));
  const addedEdges = next.edges.filter((edge) => !previousEdgeIds.has(edge.id));
  const removedEdges = previous.edges.filter((edge) => !nextEdgeIds.has(edge.id));
  const previousGroupIds = new Set((previous.groups ?? []).map((group) => group.id));
  const nextGroupIds = new Set((next.groups ?? []).map((group) => group.id));
  const addedGroups = (next.groups ?? []).filter((group) => !previousGroupIds.has(group.id));
  const removedGroups = (previous.groups ?? []).filter((group) => !nextGroupIds.has(group.id));
  const parts: string[] = [];

  if (addedNodes.length > 0) {
    parts.push(`Added ${nodeNames(next, addedNodes)}`);
  }
  if (removedNodes.length > 0) {
    parts.push(`Removed ${nodeNames(previous, removedNodes)}`);
  }
  if (addedEdges.length === 1 && addedNodes.length === 0) {
    const edge = addedEdges[0]!;
    parts.push(
      `Connected ${portLabel(next, edge.sourceNodeId, edge.sourcePortId, true)} to ${portLabel(
        next,
        edge.targetNodeId,
        edge.targetPortId,
        false,
      )}`,
    );
  } else if (addedEdges.length > 0) {
    parts.push(`Added ${count(addedEdges.length, "connection")}`);
  }
  if (removedEdges.length > 0) {
    parts.push(`Removed ${count(removedEdges.length, "connection")}`);
  }
  if (addedGroups.length > 0) {
    parts.push(
      addedGroups.length === 1
        ? `Grouped ${count(addedGroups[0]!.nodeIds.length, "node")} as ${addedGroups[0]!.label}`
        : `Added ${count(addedGroups.length, "group")}`,
    );
  }
  if (removedGroups.length > 0) {
    parts.push(
      removedGroups.length === 1
        ? `Ungrouped ${removedGroups[0]!.label}`
        : `Removed ${count(removedGroups.length, "group")}`,
    );
  }

  if (parts.length === 0) {
    const previousById = new Map(previous.nodes.map((node) => [node.id, node]));
    const moved: string[] = [];
    const changed: string[] = [];

    for (const node of next.nodes) {
      const before = previousById.get(node.id);
      if (!before || before === node) {
        continue;
      }
      if (before.x !== node.x || before.y !== node.y) {
        moved.push(node.id);
      } else if (JSON.stringify(before) !== JSON.stringify(node)) {
        changed.push(node.id);
      }
    }

    if (moved.length > 0) {
      parts.push(`Moved ${nodeNames(next, moved)}`);
    }
    if (changed.length > 0) {
      parts.push(`Updated ${nodeNames(next, changed)}`);
    }
  }

  return parts.length > 0 ? `${parts.join(". ")}.` : null;
}

/** Describes a rejected connection attempt for an ARIA live region. */
export function describeWorkflowWorkbenchConnectionRejection(
  validity: WorkflowEditorConnectionValidity,
): string {
  const reason =
    validity.message?.trim() ||
    (validity.reason ? rejectionFallbacks[validity.reason] : undefined) ||
    "the ports are incompatible";
  return `Connection rejected: ${reason.replace(/\.$/, "")}.`;
}
