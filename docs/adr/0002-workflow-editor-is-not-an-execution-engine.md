# Workflow Editor is not an execution engine

Workflow Documents are execution-ready models, but `@moritzbrantner/workflow-editor` does not
schedule or run them. We reject embedding a scheduler in this package so it can stay focused on
document modeling, validation, persistence, and editor behavior while host applications integrate
execution externally.
