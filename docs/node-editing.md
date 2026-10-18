# Node face and inspector responsibilities

Decision Atlas 5.6 (owner choice A): frequent settings are edited directly on the node, and
advanced or precision settings live in the inspector. Both entry points use the same document
mutations, validation and undo history. A field has one primary editor; the inspector does not
repeat a frequent node control without a reason.

| Field                                                       | On the node (frequent)                                           | In the inspector (advanced/precision)                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Label                                                       | Inline rename (double-click or node menu **Rename**)             | **Label** field, which is also keyboard-reachable           |
| JSON source value (`json.string`/`number`/`boolean`/`null`) | Value control in the body or the minimized header                | —                                                           |
| Dynamic ports (object/array/decomposition)                  | Port names, expression editor and add/remove actions on the node | —                                                           |
| Iteration bound, state type, stop                           | Summary in the package label                                     | Bound, state type and result contract fields                |
| Position                                                    | Drag, or Shift+Arrow / Alt+Shift+Arrow                           | Exact **X** / **Y**                                         |
| Description, category, kind, status                         | — (not on the node face)                                         | Description, category, read-only kind, status               |
| Nested workflow                                             | Node menu **Open workflow**                                      | Workflow document, recursion depth, interface and port sync |
| Delete                                                      | Node menu and the Delete shortcut                                | —                                                           |
| Persistence, schema-driven data fields, port payloads       | —                                                                | Their inspector sections                                    |

The node face shows only what changes the next action: the label, an authored eyebrow or package
label, runtime status from an execution overlay (idle nodes draw no status dot), ports and the
node's own editors. Description, category and kind are kept on the document node and shown in the
inspector. `toUiWorkflowBuilderNodes` leaves them off the canvas node, and
`fromUiWorkflowBuilderNodes` restores them from the document node.
