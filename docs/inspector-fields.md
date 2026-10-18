# Schema-driven inspector fields

A node template can declare `inspectorFields`. The inspector shows these fields for every node
whose `kind` matches the template, and writes edited values into the node's `data` at each
field's `path`. Host data at other paths is never touched. No form framework or schema vendor is
required, and the definitions are plain serializable objects.

```ts
const template: WorkflowEditorNodeTemplate = {
  id: "api-request",
  label: "API request",
  kind: "integration.api.request",
  inspectorFields: [
    { path: "url", label: "URL", kind: "text", required: true, pattern: "^https://" },
    {
      path: "method",
      label: "Method",
      kind: "select",
      defaultValue: "GET",
      options: [
        { label: "GET", value: "GET" },
        { label: "POST", value: "POST" },
      ],
    },
    {
      path: "body",
      label: "Body",
      kind: "json",
      visibleWhen: { path: "method", equals: ["POST"] },
    },
    { path: "headers", label: "Headers", kind: "key-value", section: "Advanced" },
    { path: "auth.token", label: "Token", kind: "secret-ref", section: "Advanced" },
  ],
};
```

## Definition

| Property                                                     | Meaning                                                                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `path`                                                       | Dot path into `data` (identifier segments; `__proto__`, `prototype` and `constructor` are rejected). Also the field's identity. |
| `label`, `description`, `placeholder`, `section`             | Presentation. Fields without a `section` appear under "Settings".                                                               |
| `kind`                                                       | `text`, `number`, `boolean`, `select`, `multi-select`, `json`, `expression`, `secret-ref`, `key-value` or `custom`              |
| `defaultValue`                                               | Shown when `data` has no value at `path`; written only once the user applies an edit.                                           |
| `required`, `readOnly`                                       | Required fields are marked `*`.                                                                                                 |
| `visibleWhen`                                                | `{ path, equals }`: the field is shown only while another value matches.                                                        |
| `min`, `max`, `minLength`, `maxLength`, `pattern`, `options` | Validation hints. Violations are shown next to the field and never silently coerced.                                            |
| `renderer`                                                   | Host renderer key, required for `custom` fields.                                                                                |

Invalid definitions make the template invalid in the template registry, with
`invalid-inspector-field` diagnostics such as `$[0].inspectorFields[2].kind`.

## Values

- `secret-ref` stores `{ secretRef: "<identifier>" }`. The editor never stores raw secrets, and
  a plain string fails validation.
- `key-value` stores `Array<{ key, value }>`, which must have unique, non-empty keys.
- `json` and `custom` drafts are edited as JSON. Invalid JSON is reported and not applied.

## Editing

- One **Apply** writes all changed fields in a single document change, so it is one undo/redo step
  and marks the document dirty.
- With several nodes selected, a **Shared settings (N nodes)** panel lists only the fields that
  every node declares with the same path, kind and label. Differing values show as "Mixed" and are
  left as they are unless edited.
- Hosts override renderers through `inspectorFieldRenderers`:
  `{ kinds?: { [kind]: renderer }, fields?: { [rendererKeyOrPath]: renderer } }`. A field override
  wins over a kind override. Renderers receive `{ field, value, onChange, readOnly, node? }`.

## Headless helpers

`readWorkflowEditorFieldPath`, `writeWorkflowEditorFieldPath`, `readWorkflowEditorFieldValue`,
`isWorkflowEditorInspectorFieldVisible`, `validateWorkflowEditorFieldValue`,
`validateWorkflowEditorInspectorFieldDefinitions`, `getWorkflowEditorSharedInspectorFields` and
`isWorkflowEditorSecretReference` work without React.

The Pages workbench uses fields on **Score lead** (model, threshold) and **API request**. The
Storybook story `SchemaInspectorFields` shows every kind and a custom renderer.
