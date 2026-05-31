import { describe, expect, test } from "vitest";

import {
  createWorkflowWorkbenchPaletteCategoryGroups,
  filterWorkflowWorkbenchPaletteTemplates,
} from "./palette-model";

describe("workflow workbench palette model", () => {
  test("groups templates by category path, category, and fallback", () => {
    const groups = createWorkflowWorkbenchPaletteCategoryGroups([
      { id: "branch", label: "Branch", categoryPath: ["Control", "Flow"] },
      { id: "http", label: "HTTP", category: "Integration/API" },
      { id: "loose", label: "Loose" },
    ]);

    expect(groups.map((group) => group.label)).toEqual(["Control", "Integration", "Uncategorized"]);
    expect(groups[0]?.children[0]?.label).toBe("Flow");
    expect(groups[0]?.children[0]?.templates[0]?.id).toBe("branch");
    expect(groups[1]?.children[0]?.label).toBe("API");
    expect(groups[1]?.children[0]?.templates[0]?.id).toBe("http");
    expect(groups[2]?.templates[0]?.id).toBe("loose");
  });

  test("filters templates by searchable metadata", () => {
    const templates = [
      {
        id: "send-email",
        label: "Send email",
        description: "Notify a customer",
        kind: "messaging.email",
        category: "Messaging",
      },
      { id: "if", label: "Branch", kind: "control.if", categoryPath: ["Control", "Flow"] },
    ];

    expect(
      filterWorkflowWorkbenchPaletteTemplates(templates, "customer").map((item) => item.id),
    ).toEqual(["send-email"]);
    expect(
      filterWorkflowWorkbenchPaletteTemplates(templates, "flow").map((item) => item.id),
    ).toEqual(["if"]);
    expect(filterWorkflowWorkbenchPaletteTemplates(templates, "").map((item) => item.id)).toEqual([
      "send-email",
      "if",
    ]);
  });
});
