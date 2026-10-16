# Workflow Editor technical decisions

Technical implementation decisions complement the owner-approved product intent in
[Decision Atlas](DECISION-ATLAS.md). They do not authorize new product behavior.

## TECH-001 — Registry-authoritative resolution of linked Node Templates

- **Status:** approved 2026-10-16, owner choice A; technical steering question TECH-001.
- **Context:** [Issue #65](https://github.com/moritzbrantner/workflow-editor/issues/65) implements
  linked, versioned Node Template instances across Workflow Documents. Product Decisions 2.9 and
  2.11 require compatible edits to propagate, incompatible published revisions to remain available,
  explicit upgrade, and detach.
- **Decision:** The existing host-managed Editor Catalog / Node Template registry is the single
  authority for shared definition identities and immutable published revisions. A linked Node stores
  a stable template identity and its revision-resolution reference, not an independently
  authoritative embedded copy. Editor preview, graph validation, compiler and document restore
  resolve the effective published definition through the same registry contract. A compatible newer
  revision can become effective for linked instances, while incompatible changes retain the last
  compatible immutable revision until explicit upgrade. Missing definitions or revisions produce
  explicit, actionable diagnostics; do not silently materialize stale copies or rebind by display
  name.
- **Persistence and portability:** Save/export the reference and sufficient revision identity to
  reproduce the linked semantics. Import/restore must verify required definitions/revisions against
  the available registry and report missing dependencies. Full self-contained offline snapshots are
  *not* the default linked-node authority. Explicit **Detach / Unlink** materializes the currently
  resolved definition as an independent local Composed Node; it ceases following registry updates.
- **Ownership:** Workflow Editor owns linked authoring, registry integration, type validation and
  compilation; graph-editor owns generic graph interactions, and an external runner owns execution.
  Reuse the existing registry (#16), compiler (#19), and composition surfaces (#43). Do not add a
  second registry, document-level synchronization engine, or alternate TypeScript type checker.
- **Evidence required by #65:** two Workflow Documents referencing one published template, a
  compatible update propagating, an incompatible revision retaining old consumers, explicit upgrade,
  detach, save/reopen and import/export including missing-template behavior. No implementation or
  acceptance is claimed by recording this decision.

## TECH-002 — Structured iteration node with bounded body

- **Status:** approved 2026-10-16, owner choice A; technical steering question TECH-002.
- **Context:** [Issue #64](https://github.com/moritzbrantner/workflow-editor/issues/64) implements
  product Decisions 2.6 and 2.8: finite, explicitly bounded iteration and recursive references,
  optional convergence, and distinguishable non-converged partial results. Ordinary connections
  remain a DAG under Decision 2.1.
- **Decision:** Represent a repeated calculation as an explicit **structured iteration Node** that
  owns a typed iteration-state boundary, a nested workflow body, a finite maximum iteration count,
  and an optional convergence/stopping condition. The compiler validates the boundary types and
  finite bound and emits a versioned structured control-flow construct; it must not encode
  repetition as free-form cyclic graph connections. Existing ordinary Nodes and Connections remain
  acyclic, including inside the iteration body.
- **Reference recursion:** Preserve the separately approved bounded recursive Workflow Reference
  capability; recursive references require explicit finite depth limits and compiler validation. Do
  not reinterpret recursion as permission for arbitrary feedback edges, or require a new second
  graph engine. The runner enforces iteration/depth/time/cancellation limits, executes the body, and
  owns convergence status and partial-result provenance. Workflow Editor owns only typed authoring,
  static validation, serialization, and compilation.
- **Compatibility and reuse:** Evolve the shared compiled contract with #19 and coordinate runner
  consumption without breaking compiled-v1 DAG fixtures. Reuse current nested composition, Workflow
  Reference, TypeScript checker and graph-editor gestures instead of duplicating them. The compiled
  result contract distinguishes a converged value from a best-available candidate at an exhausted
  limit when one exists; never label absent or failed output as a partial candidate.
- **Acceptance:** #64 proves a bounded ten-iteration example through editing, save/export/import and
  compile; rejects unbounded or ill-typed repetition and ordinary free-form cycles; checks versioned
  compiled output and runner-facing compatibility. Recording TECH-002 does not establish
  implementation or execution acceptance.

## TECH-003 — Orthogonal payload mode and TypeScript payload typing

- **Status:** approved 2026-10-16, owner choice A; technical steering question TECH-003.
- **Context:** [Issue #61](https://github.com/moritzbrantner/workflow-editor/issues/61) implements
  Decision Atlas 1.1, 1.3, 1.5 and 1.7: native TypeScript Port Types, annotated binary payloads,
  both buffered and streamed delivery, and automatic output fan-out.
- **Decision:** Keep **payload delivery mode** as explicit port contract metadata, orthogonal to the
  native TypeScript **payload type**. The TypeScript checker determines payload assignability.
  Separately validate that source and target delivery modes agree (buffered versus streamed), along
  with relevant media annotations and declared cardinality. Do not encode delivery mode through
  synthetic TypeScript wrapper types or duplicate TypeScript assignability rules. An incompatible
  buffered/streamed edge requires an explicit conversion Node; no implicit buffering or draining.
- **Compilation and persistence:** Carry type identity, payload mode and binary/media metadata as
  distinct, deterministic fields through the existing document, composition-boundary, import/export
  and versioned compiled-contract paths. Preserve old documents and compiled-v1 DAG consumers;
  coordinate any necessary contract evolution through #19. Connection diagnostics explain whether
  the problem is type incompatibility, delivery mode or cardinality rather than silently changing
  contracts.
- **Authority and acceptance:** Workflow Editor owns authoring, native type validation, static mode
  compatibility and compilation. graph-editor owns generic port presentation and gestures.
  workflow-runner #12 owns actual buffered/streamed transfer, broadcast and bounded backpressure;
  workflow-engine owns dispatch and persisted run state. Issue #61 must independently verify
  buffered and streamed fan-out, invalid cross-mode connections, roundtrips and compiler/runner
  fixture agreement. Recording this choice does not imply runtime implementation or Pages
  acceptance.
