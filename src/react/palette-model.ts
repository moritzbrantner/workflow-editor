import type { WorkflowEditorNodeTemplate } from "../core";

export type WorkflowWorkbenchPaletteItem<TData = Record<string, unknown>> =
  WorkflowEditorNodeTemplate<TData>;

export type WorkflowWorkbenchPaletteCategoryGroup<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  templates: Array<WorkflowWorkbenchPaletteItem<TData>>;
  children: Array<WorkflowWorkbenchPaletteCategoryGroup<TData>>;
};

export function createWorkflowWorkbenchPaletteCategoryGroups<TData>(
  templates: ReadonlyArray<WorkflowWorkbenchPaletteItem<TData>>,
) {
  const groups: Array<WorkflowWorkbenchPaletteCategoryGroup<TData>> = [];

  for (const template of templates) {
    const categoryPath = getWorkflowWorkbenchPaletteCategoryPath(template);
    let level = groups;

    categoryPath.forEach((label, index) => {
      const id = categoryPath.slice(0, index + 1).join("\u001f");
      let group = level.find((candidate) => candidate.id === id);

      if (!group) {
        group = { id, label, templates: [], children: [] };
        level.push(group);
      }

      if (index === categoryPath.length - 1) {
        group.templates.push(template);
      } else {
        level = group.children;
      }
    });
  }

  return groups;
}

export function getWorkflowWorkbenchPaletteCategoryPath<TData>(
  template: WorkflowWorkbenchPaletteItem<TData>,
) {
  const categoryPath = Array.isArray(template.categoryPath)
    ? template.categoryPath.flatMap((part) => {
        if (typeof part !== "string") {
          return [];
        }

        const segment = part.trim();
        return segment ? [segment] : [];
      })
    : undefined;

  if (categoryPath && categoryPath.length > 0) {
    return categoryPath;
  }

  const category = template.category?.trim();
  if (!category) {
    return ["Uncategorized"];
  }

  const categorySegments = category
    .split(/[/>]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return categorySegments.length > 0 ? categorySegments : [category];
}

export function getWorkflowWorkbenchPaletteTemplateSearchText<TData>(
  template: WorkflowWorkbenchPaletteItem<TData>,
) {
  const searchableValues = [
    template.id,
    template.label,
    template.description,
    template.kind,
    template.category,
    ...getWorkflowWorkbenchPaletteCategoryPath(template),
  ];

  return searchableValues
    .flatMap((value) => (typeof value === "string" ? [value] : []))
    .join("\n")
    .toLowerCase();
}

export function filterWorkflowWorkbenchPaletteTemplates<TData>(
  templates: ReadonlyArray<WorkflowWorkbenchPaletteItem<TData>>,
  searchValue: string,
) {
  const query = searchValue.trim().toLowerCase();

  if (!query) {
    return templates;
  }

  return templates.filter((template) =>
    getWorkflowWorkbenchPaletteTemplateSearchText(template).includes(query),
  );
}
