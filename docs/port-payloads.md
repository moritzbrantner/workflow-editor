# Workflow port payloads

A port's `payload` declares how its value is delivered. This is separate from its TypeScript type ([TECH-003](technical-decisions.md)): TypeScript decides whether the value is assignable, and `payload` decides whether it arrives as one complete value or as incremental chunks.

```ts
type WorkflowEditorPortPayload = {
  mode: "buffered" | "streamed";
  mediaType?: string; // for example "audio/wav"; "audio/*" matches any audio subtype
};
```

A port without `payload` delivers a complete value and is treated as `buffered`. Existing documents therefore keep their behaviour.

`validateWorkflowEditorConnection` checks the TypeScript types first, then the delivery mode, then the media type. A connection is rejected when:

- **The modes differ** (`reason: "payload-mode-mismatch"`). A streamed output never silently feeds a buffered input, and a buffered output never feeds a streamed input. Add an explicit conversion node instead.
- **Both ports declare media types that don't match** (`reason: "media-type-mismatch"`). Media types match when they are equal, or when either side uses a `type/*` wildcard with the same type.

`analyzeWorkflowEditorPortTypes` reports mismatches on edges a document already has, as `incompatible-payload-mode` and `incompatible-media-type`. Normalization rejects a malformed `payload`.

An output may connect to several compatible inputs (output fan-out, Decision 1.7) in either mode, with no Tee node. The editor only describes the contract. Moving bytes, broadcasting chunks and backpressure belong to the runner.

The compiler copies a declared `payload` onto the compiled port unchanged, and rejects edges whose payloads are incompatible (`invalid-port-payload`). `fixtures/compiled-v1-binary-ports.json` is the shared conformance fixture for buffered and streamed WAV fan-out.

In the workbench, ports show their payload in the port badge (for example `streamed · audio/wav`). You edit it under **Port delivery** in the node inspector. The **Binary Audio Ports** example shows both modes fanning out.
