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
  Resolved 2026-10-14 by 1.5.  
  Should version one carry complete binary values or references to them (A), support incremental streamed chunks with backpressure (B), or expose both buffered and streamed port modes (C)? The engine currently restricts persisted run inputs/results to JSON-safe values, so annotations alone cannot implement end-to-end binary execution.

- **1.5 Support both buffered and streamed binary ports.**  
  Status: adopted 2026-10-14. Answers 1.4 (option C).  
  Nodes can declare **buffered** binary inputs/outputs for a complete payload (or a reference to it), and **streamed** binary inputs/outputs for incremental chunks. The port contracts visibly distinguish these modes alongside their TypeScript types and binary-format annotations (1.1, 1.3). Connections must respect both type compatibility and payload mode; converting between modes is explicit, not silent eager buffering or implicit stream consumption. Streaming execution supports bounded flow/backpressure rather than unbounded accumulation. The editor exposes and compiles these contracts; `workflow-runner` owns per-run chunk propagation and flow control, while `workflow-engine` owns dispatch/run-state and persistence boundaries. Engine run records must not start storing raw binary or live streams inside the existing JSON-safe state model. The user should be able to author and inspect either mode without needing an execution engine embedded in the editor.

- **1.6** [question] **How should one streamed output feed multiple consumers?**  
  Resolved 2026-10-14 by 1.7.  
  When a streaming output is connected to two or more downstream nodes, should users explicitly insert a fan-out/tee node that exposes the extra streams (A), or should ordinary multiple connections automatically broadcast the chunks with bounded backpressure for slow consumers (B)? Either way, do not silently turn an unbounded stream into a buffered value. This affects streamed DAG branching and the runner's flow-control contract.

- **1.7 Automatically fan out one output to multiple consumers.**  
  Status: adopted 2026-10-14. Answers 1.6 (option B).  
  One node output may connect directly to multiple compatible input ports on downstream nodes, like using the same variable or value in several expressions. **No explicit Tee/fan-out node is required.** A buffered value is produced once and made available to each connected downstream consumer; adding a connection does not independently re-execute the producing node. For streamed binary outputs, the runner automatically broadcasts the incremental chunks to each active downstream consumer with bounded backpressure and without silently discarding chunks, implicitly converting the stream to a whole buffered payload, or requiring a separate duplication node. Stream sharing must work with ordinary DAG branches and cancellations without unlimited memory growth. This is **one-output-to-many-input fan-out**, not a decision that unrelated outputs may automatically converge onto the _same input port_; that behavior remains governed by that input's explicitly declared cardinality and type. The editor owns connection authoring and serialized contracts; the runner owns actual value propagation, stream distribution, and resource lifecycle.

- **1.8** [question] **How should multiple sources connect to one input port?**  
  Answered 2026-10-14 by Decision 1.9 (option A); retained for historical traceability.  
  When two node outputs are connected to a single downstream input, should the receiving node explicitly declare whether its input accepts one value or a collection of values (A, matching the current cardinality contract), or should adding a second connection automatically turn an ordinary input into a multi-value collection (B)? This is distinct from approved automatic one-output-to-many-consumer fan-out (1.7). The answer determines whether an input's TypeScript type remains fixed by its node definition or changes based on how many edges are connected.

- **1.9 Require explicit input cardinality and preserve declared types.**  
  Status: owner-approved 2026-10-14. Answers 1.8 (option A).  
  A Node's input Port declares whether it accepts one incoming Connection or multiple incoming Connections, and the TypeScript Port Type remains defined by that Node rather than changing with the number of connected sources. Ordinary single-value inputs accept at most one incoming Connection; adding a second must be rejected with an actionable cardinality diagnostic, not automatically transform the input into an array or collection. A deliberate multi-source input explicitly declares its multi-connection cardinality and its intended collection-valued type; compatible sources may connect within those declared bounds. Connecting or disconnecting sources must not silently rewrite the input's declared type. Preserve the existing default single-input behavior and the separately defined expandable JSON constructor behavior; use the existing Workflow Editor cardinality contract rather than a competing system. Automatic **output fan-out** remains approved by 1.7 and is separate from **input fan-in**. Editor validation, composing, serialization, and compilation preserve declared cardinality and type information; the editor does not own runtime collection assembly, stream scheduling, or delivery. This is approved intent, not a claim that all editing paths and consumer acceptance tests have passed.

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
  Answered 2026-10-14 by Decision 2.9 (option B, with an explicit detach-to-copy action); retained for historical traceability.  
  Is composition a local wrapper in one workflow (A), a published reusable node across workflows (B), or both, with an explicit choice when composing (C)? This affects catalog identity, versioning, and updates to existing instances.

- **2.9 Publish linked reusable compositions and allow detaching a local copy.**  
  Status: owner-approved 2026-10-14. Answers 2.4 (option B, with explicit detachment).  
  Users may publish a selected, composed subgraph as a **reusable Node Template** in the existing Editor Catalog and insert **linked instances** of that shared definition into multiple Workflow Documents. Linked instances retain the shared definition's identity; changes to the published definition propagate to linked instances rather than silently creating independent copies each time it is used. A user who wants to change one instance independently can explicitly **detach / unlink** it, materializing the currently referenced definition as a local, editable composed-node copy in that Workflow Document. The detached copy keeps its compatible boundary ports/connections and no longer receives future shared-template updates; detaching it neither edits the source definition nor changes other linked instances. Ordinary grouping/local composition from Decision 2.3 remains available and is not silently published or linked. Distinguish linked reuse from an embedded copy in the canvas and inspector, preserve source identity or detached content across save/export/reopen and compilation, and reuse existing Node Template, composition and Workflow Reference foundations rather than creating a second template/graph system. The editor owns authoring, source resolution, compatibility diagnostics and compilation; the runner does not manage template publication or dynamic editor-catalog updates. Handling edits that would break linked instance ports/types remains Question 2.10. This is approved direction, not proof of an implemented linked-template experience.

- **2.10** [question] **What happens when a shared template update breaks existing linked connections?**  
  Opened 2026-10-14.  
  When an edit to a published shared template changes or removes inputs, outputs or TypeScript contracts required by existing linked instances, should the editor **reject publication until those consumers are reconciled** (A), or **allow a new revision but keep affected instances on their last compatible revision until explicitly upgraded** (B)? Both should expose the incompatibility and preserve the explicit detach-to-copy action; routine compatible edits continue to reach linked instances under Decision 2.9. Do not silently break a consuming workflow or claim an incompatible revision was accepted.

- **2.5** [question] **Does the initial acyclic rule also prohibit recursive workflow references?**  
  Answered 2026-10-14 by Decision 2.6 (option C); retained for historical traceability.  
  Should all referenced workflows form one acyclic call graph (A), should each document alone be acyclic while references may recur (B), or should recursive references be allowed only with explicit bounded recursion (C)? Existing reference navigation can be recursive even though ordinary graph edges are acyclic.

- **2.6 Allow bounded recursive workflows and iterative approximation.**  
  Status: owner-approved 2026-10-14. Answers 2.5 (option C).  
  Workflow Documents may intentionally **re-enter a referenced workflow or repeat a calculation** to improve an approximation, with optional early exit when a declared stopping/convergence condition is met. **Every recursive or iterative path must have a finite, explicit bound** (such as maximum iterations or invocation depth), validated before execution and enforced by the runner even when its stopping condition never becomes true; execution also remains subject to cancellation and finite time limits so a non-returning operation cannot evade the overall bound. An unbounded reference cycle or repeat is not an executable workflow. An enforced stop does **not** prove the algorithm converged or met its desired accuracy; results and diagnostics must distinguish normal convergence from a limit being reached. Preserve Decision 2.1's acyclic **ordinary node connections within each workflow body**; repeated execution and feedback are explicitly scoped control-flow/recursive-reference constructs, not unrestricted arbitrary cyclic graph edges. Preserve typed input/output contracts at iteration boundaries. The editor authors and validates bounded loops/references and compiles their contracts; the runner owns actual iteration, guard enforcement, timeouts and cancellation; the engine retains registration/dispatch/run-state ownership. Evolve the shared compiled contract explicitly and maintain old-version conformance rather than silently interpreting new recursion using compiled-v1 DAG semantics. The behavior of an available best-so-far approximation when a limit is reached remains open (Question 2.7).

- **2.7** [question] **What result should a bounded iterative workflow expose when its limit is reached before convergence?**  
  Answered 2026-10-14 by Decision 2.8 (option A); retained for historical traceability.  
  If a calculation has produced a candidate approximation but has not met its stopping criterion by the enforced limit, should it return that candidate as a clearly marked **partial/non-converged** output (A), or stop with an explicit **limit-exhausted** failure without a normal output (B)? Both must terminate within configured bounds; neither may claim the requested precision was reached. This choice does not affect successful early convergence or cancellation before any candidate exists.

- **2.8 Return a clearly marked best-available approximation at the iteration limit.**  
  Status: owner-approved 2026-10-14. Answers 2.7 (option A).  
  When an explicitly bounded recursive or iterative workflow reaches its invocation/iteration limit without satisfying the declared stopping or convergence condition, **return the best available valid candidate if one exists**, clearly marked **partial / non-converged** rather than reported as ordinary converged success. Preserve the stopping reason (limit exhausted), actual iteration count, configured bound, and only convergence/quality measurements the workflow genuinely computed. The workflow's own candidate-selection or evaluation contract determines which candidate is best; do not invent a quality metric or silently equate the most recent candidate with the best. Downstream consumers must be able to distinguish and intentionally handle the non-converged result through the typed output/status contract, without being told the requested accuracy was achieved. If no candidate exists, report the absence of a usable result rather than manufacturing one; cancellation, timeout and executor failure retain distinct outcomes and are not automatically converted into partial success. The editor authors, displays and compiles the result/status contract; the runner enforces bounds and returns the labeled candidate with execution provenance; the engine retains run-state and JSON-safe persistence authority. Keep existing compiled-v1 DAG behavior unchanged and version any new contract deliberately. This records intended behavior, not completed implementation.

## 3. Type-visible editing

- **3.1 Make port types recognizable by consistent, configurable colors.**  
  Status: adopted 2026-10-14.  
  Each displayed type has a consistent color across the workflow, and users can set or override its color. Matching colors help with visual scanning of inputs and outputs, while visible type labels and actual compatibility diagnostics remain authoritative: assignable TypeScript types are not necessarily identical, and color alone must not determine connection validity.
