# Workflow Editor Decision Atlas

This is the repository-owned, feature-oriented source of **owner-approved product intent** for Workflow Editor. Decisions describe what the product should do, not a claim that current code implements or verifies it. This Atlas begins with the owner's free-flow steering on 2026-10-14; existing `README.md`, `CONTEXT.md`, ADRs, and `docs/roadmap.md` remain useful descriptions of current APIs, architecture, and implementation sequencing. In particular, the current hand-written TypeScript-like type resolver is **not** evidence that the intended native-TypeScript direction below has shipped.

## Editing rules

- **Decision** and **Question** are the only semantic leaf kinds; headings group product capabilities.
- Keep IDs stable. Append new entries; never silently renumber, overwrite, or remove historical decisions.
- Retain an answered Question and append a new Decision marked `Answers <ID>`. Record revisions with a new `Supersedes <ID>` Decision.
- An unresolved Question is not automatically an implementation blocker. GitHub issues track bounded work, not a second authority for product intent.
- Implementation belongs in Workflow Editor for editing, graph validation, and compilation; execution/transport mechanics belong to the separate workflow engine and runner. Generic graph interaction belongs to graph-editor.

## 1. Typed ports and data

- **1.1 Use the real TypeScript type system for workflow typing.**  
  Status: adopted 2026-10-14.  
  Input and output ports have TypeScript types. TypeScript's own type checker is authoritative for type compatibility; do not maintain a second, independently approximated assignability/type language. Types and reusable declarations should be usable in browser-based authoring and supported hosts. Static compatibility does not itself validate actual runtime values, because TypeScript types are erased at runtime.

- **1.2 Expose type propagation and possible outputs before execution.**  
  Status: adopted 2026-10-14.  
  Connecting nodes and choosing conditional branches should let users inspect which types can flow into inputs, out of individual ports, and out of the finished workflow. Incompatible connections receive actionable diagnostics rather than silently changing types. Show possible branch output types; do not claim to know runtime branch choices or computed values in advance.

- **1.3 Support JSON-compatible and annotated binary values.**  
  Status: adopted 2026-10-14.  
  Workflow ports can describe structured JSON-compatible values and binary data, including audio such as WAV. Users can see the declared TypeScript type and meaningful binary format/medium annotations. Binary values should not have to be converted into JSON arrays of bytes solely to pass between nodes. The editor describes these contracts; engine/runner data transport is a separate responsibility. Streaming semantics remain open in 1.4.

- **1.4** [question] **How should binary values move between executing nodes?**  
  Opened 2026-10-14.  
  Should version one carry complete binary values or references to them (A), support incremental streamed chunks with backpressure (B), or expose both buffered and streamed port modes (C)? The engine currently restricts persisted run inputs/results to JSON-safe values, so annotations alone cannot implement end-to-end binary execution.

## 2. Workflow graph and composition

- **2.1 Use directed acyclic graphs for the initial execution-ready workflow model.**  
  Status: adopted 2026-10-14.  
  Workflows use directed connections without cycles, supporting predictable ordering, static analysis, and final output-type inspection. Provide basic control-flow nodes, including conditional branches and joins. Structural acyclicity does not guarantee that an arbitrary asynchronous node terminates; recursion through referenced documents remains an open policy question (2.5).

- **2.2 Group, ungroup, collapse, and expand nodes directly on the canvas.**  
  Status: adopted 2026-10-14.  
  Users can organize nodes into groups, undo those groupings, and minimize or expand ordinary nodes without losing their connections or making the workflow difficult to navigate. These are normal editing actions, not special execution operators.

- **2.3 Turn a selection of nodes into a composed node.**  
  Status: adopted 2026-10-14.  
  Selected nodes can become one node whose externally visible inputs and outputs correspond to the selected subgraph's boundary. Users can recover the constituent nodes by decomposing the composition. Whether compositions should also become reusable catalog templates is not yet specified (2.4).

- **2.4** [question] **Should a composed group become a reusable node template?**  
  Opened 2026-10-14.  
  Is composition a local wrapper in one workflow (A), a published reusable node across workflows (B), or both, with an explicit choice when composing (C)? This affects catalog identity, versioning, and updates to existing instances.

- **2.5** [question] **Does the initial acyclic rule also prohibit recursive workflow references?**  
  Opened 2026-10-14.  
  Should all referenced workflows form one acyclic call graph (A), should each document alone be acyclic while references may recur (B), or should recursive references be allowed only with explicit bounded recursion (C)? Existing reference navigation can be recursive even though ordinary graph edges are acyclic.

## 3. Type-visible editing

- **3.1 Make port types recognizable by consistent, configurable colors.**  
  Status: adopted 2026-10-14.  
  Each displayed type has a consistent color across the workflow, and users can set or override its color. Matching colors help with visual scanning of inputs and outputs, while visible type labels and actual compatibility diagnostics remain authoritative: assignable TypeScript types are not necessarily identical, and color alone must not determine connection validity.
