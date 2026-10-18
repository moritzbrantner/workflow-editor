import type {
  CompiledWorkflow,
  CompiledWorkflowEdge,
  CompiledWorkflowIterationNode,
  CompiledWorkflowNode,
} from "./compiler";

/** Where a compiled entity came from in the authoring document. */
export type WorkflowEditorCompiledSource = {
  /** Path in the authoring document, using the same notation as compile diagnostics. */
  path: string;
  /** The authoring node or edge ID. */
  id: string;
  /** Address of the enclosing iteration node, when the entity sits in an iteration body. */
  parent?: string;
};

/**
 * Links every compiled node and edge back to the authoring document. Keys are compiled addresses:
 * the node/edge ID at the top level, and `<iteration address>/<id>` inside an iteration body.
 */
export type WorkflowEditorCompiledSourceMap = {
  nodes: Record<string, WorkflowEditorCompiledSource>;
  edges: Record<string, WorkflowEditorCompiledSource>;
};

/**
 * Metadata derived from a compiled workflow. It sits beside the compiled artifact rather than inside
 * it, so compiled version 1/2 consumers and their byte-for-byte fixtures are unaffected.
 */
export type WorkflowEditorCompiledWorkflowReport = {
  /** Canonical JSON: object keys sorted, no insignificant whitespace. */
  canonicalJson: string;
  /** `sha256:<hex>` of `canonicalJson`; identical for semantically identical documents. */
  fingerprint: string;
  /**
   * Top-level execution stages. Every node's dependencies lie in earlier stages, so nodes within a
   * stage are independent. IDs within a stage are sorted.
   */
  stages: string[][];
  sourceMap: WorkflowEditorCompiledSourceMap;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

/** Serializes a compiled workflow as canonical JSON (sorted keys, no whitespace). */
export function serializeCompiledWorkflow(workflow: CompiledWorkflow): string {
  return JSON.stringify(canonicalize(workflow));
}

/** Returns `sha256:<hex>` of the canonical JSON of a compiled workflow. */
export function fingerprintCompiledWorkflow(workflow: CompiledWorkflow): string {
  return `sha256:${sha256Hex(serializeCompiledWorkflow(workflow))}`;
}

/** Groups compiled nodes into dependency stages (longest-path layering of the DAG). */
export function getCompiledWorkflowStages(
  workflow: Pick<CompiledWorkflow, "order" | "edges">,
): string[][] {
  const stageByNode = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    const sources = incoming.get(edge.targetNodeId) ?? [];
    sources.push(edge.sourceNodeId);
    incoming.set(edge.targetNodeId, sources);
  }

  const stages: string[][] = [];
  for (const nodeId of workflow.order) {
    const stage = Math.max(
      -1,
      ...(incoming.get(nodeId) ?? []).map((source) => stageByNode.get(source) ?? -1),
    );
    const index = stage + 1;
    stageByNode.set(nodeId, index);
    (stages[index] ??= []).push(nodeId);
  }

  return stages.map((stage) => [...stage].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
}

function isIterationNode(node: CompiledWorkflowNode): node is CompiledWorkflowIterationNode {
  return "iteration" in node;
}

function addScope(
  sourceMap: WorkflowEditorCompiledSourceMap,
  scope: { nodes: CompiledWorkflowNode[]; edges: CompiledWorkflowEdge[] },
  pathPrefix: string,
  parent?: string,
) {
  const address = (id: string) => (parent ? `${parent}/${id}` : id);
  for (const node of scope.nodes) {
    sourceMap.nodes[address(node.id)] = {
      path: `${pathPrefix}nodes.${node.id}`,
      id: node.id,
      ...(parent ? { parent } : {}),
    };
    if (isIterationNode(node)) {
      addScope(
        sourceMap,
        node.iteration.body,
        `${pathPrefix}nodes.${node.id}.composition.`,
        address(node.id),
      );
    }
  }
  for (const edge of scope.edges) {
    sourceMap.edges[address(edge.id)] = {
      path: `${pathPrefix}edges.${edge.id}`,
      id: edge.id,
      ...(parent ? { parent } : {}),
    };
  }
}

/** Builds the source map linking compiled nodes and edges to authoring document paths. */
export function createCompiledWorkflowSourceMap(
  workflow: CompiledWorkflow,
): WorkflowEditorCompiledSourceMap {
  const sourceMap: WorkflowEditorCompiledSourceMap = { nodes: {}, edges: {} };
  addScope(
    sourceMap,
    workflow as { nodes: CompiledWorkflowNode[]; edges: CompiledWorkflowEdge[] },
    "",
  );
  return sourceMap;
}

/** Derives canonical JSON, fingerprint, stages and source map for a compiled workflow. */
export function createCompiledWorkflowReport(
  workflow: CompiledWorkflow,
): WorkflowEditorCompiledWorkflowReport {
  const canonicalJson = serializeCompiledWorkflow(workflow);
  return {
    canonicalJson,
    fingerprint: `sha256:${sha256Hex(canonicalJson)}`,
    stages: getCompiledWorkflowStages(workflow),
    sourceMap: createCompiledWorkflowSourceMap(workflow),
  };
}

const sha256K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Synchronous SHA-256 so fingerprints stay pure and available in every runtime. */
function sha256Hex(text: string): string {
  const message = new TextEncoder().encode(text);
  const bitLength = message.length * 8;
  const padded = new Uint8Array(Math.ceil((message.length + 9) / 64) * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (value: number, bits: number) => (value >>> bits) | (value << (32 - bits));

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash as unknown as number[];
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + s1 + choice + sha256K[i]! + w[i]!) >>> 0;
      const s0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0]! + a!) >>> 0;
    hash[1] = (hash[1]! + b!) >>> 0;
    hash[2] = (hash[2]! + c!) >>> 0;
    hash[3] = (hash[3]! + d!) >>> 0;
    hash[4] = (hash[4]! + e!) >>> 0;
    hash[5] = (hash[5]! + f!) >>> 0;
    hash[6] = (hash[6]! + g!) >>> 0;
    hash[7] = (hash[7]! + h!) >>> 0;
  }

  return Array.from(hash, (word) => word.toString(16).padStart(8, "0")).join("");
}
