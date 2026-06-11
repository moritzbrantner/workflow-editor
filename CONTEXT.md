# Workflow Editor

Workflow Editor defines the language for editing execution-ready workflow documents as typed
directed acyclic graphs. It covers the document model, saved workflow libraries, editor catalogs,
workflow references, and workflow-specific node behavior.

## Language

**Workflow Document**:
An editable, execution-ready directed acyclic graph made of Nodes and Connections. A Workflow
Document models work that can be consumed by an external executor; this package does not execute it.
_Avoid_: Workflow when precision matters, graph payload

**Node**:
An instance placed in a Workflow Document from a Node Template or created by editing existing
document data. A Node participates in graph structure but does not imply runtime execution by this
package.
_Avoid_: Step, task

**Connection**:
A directed link from an output Port to an input Port. Connections are valid only when graph rules
and Port Type compatibility allow them.
_Avoid_: Link

**Port Type**:
A TypeScript-like compatibility contract assigned to ports. Port Types constrain valid Connections
but are not a runtime executor model or JSON Schema.
_Avoid_: Runtime type, JSON schema

**Type Definition**:
A reusable named Port Type that other Port Types can reference.
_Avoid_: Domain type, model schema

**Node Template**:
A reusable definition used to create Nodes. A Node Template is not itself a Node instance.
_Avoid_: Catalog item, node definition

**Editor Catalog**:
The host-managed set of settings fields, Type Definitions, and Node Templates available to the
editor.
_Avoid_: Template catalog when referring to all catalog contents

**Workflow Library**:
A collection of saved Library Entries with an active document selection.
_Avoid_: Document library, project

**Library Entry**:
The saved wrapper around a Workflow Document, including its name, metadata, current version, and
Saved Versions.
_Avoid_: Saved workflow

**Saved Version**:
A named snapshot of a Library Entry's Workflow Document. A Saved Version is not undo history, a
branch, or a release.
_Avoid_: Revision, release version

**Workflow Reference**:
A reference from a Node to another Workflow Document in the Workflow Library. Workflow References
may be recursive, but traversal is bounded by a depth cap.
_Avoid_: Nested workflow when precision matters, subworkflow

**Composed Node**:
A Node that embeds selected internal nodes and connections behind a single wrapper node. A Composed
Node is different from a Workflow Reference because its contents are embedded, not referenced.
_Avoid_: Component unless reusable catalog publishing exists

**Composition Boundary**:
A mapping between a Composed Node's external port and an embedded node port. The term covers both
input and output mappings.
_Avoid_: Boundary mapping in domain prose

**Object Constructor**:
A Node Template family that produces an object value from named input properties. It is not a
JavaScript class constructor.
_Avoid_: Object builder

**Array Constructor**:
A Node Template family that produces an array value from ordered inputs.
_Avoid_: Array builder, list constructor

**Object Decomposition**:
A Node Template family that exposes selected object properties as outputs.
_Avoid_: Object splitter, property extractor
