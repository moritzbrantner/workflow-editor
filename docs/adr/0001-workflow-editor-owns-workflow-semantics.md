# Workflow Editor owns workflow semantics

`@moritzbrantner/workflow-editor` reuses generic graph primitives, runtime operations, layout,
commands, and canvas behavior from `@moritzbrantner/graph-editor`, but keeps workflow-specific
semantics in this package. Workflow-specific DAG validation, typed ports, composed nodes, workflow
references, persistence, editor catalogs, and workflow chrome remain here so the package boundary
preserves semantic ownership instead of delegating wholesale to `GraphWorkbench`.
