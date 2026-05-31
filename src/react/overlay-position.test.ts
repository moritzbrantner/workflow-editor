import { describe, expect, test } from "vitest";

import { clampWorkflowOverlayPosition, getWorkflowPalettePinnedStyle } from "./overlay-position";

function elementWithRect(rect: Partial<DOMRect>): HTMLElement {
  return {
    getBoundingClientRect: () =>
      ({
        bottom: 0,
        height: 0,
        left: 0,
        right: 0,
        top: 0,
        width: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
        ...rect,
      }) as DOMRect,
  } as HTMLElement;
}

describe("workflow workbench overlay position", () => {
  test("clamps overlays inside the container", () => {
    const container = elementWithRect({ width: 300, height: 200 });
    const overlay = elementWithRect({ width: 120, height: 80 });

    expect(clampWorkflowOverlayPosition({ x: -10, y: 500 }, container, overlay)).toEqual({
      x: 12,
      y: 108,
    });
  });

  test("preserves position without dimensions", () => {
    expect(clampWorkflowOverlayPosition({ x: 40, y: 50 }, null, null)).toEqual({ x: 40, y: 50 });
  });

  test("maps pinned placements to styles", () => {
    expect(getWorkflowPalettePinnedStyle("top-left")).toEqual({ left: "0.75rem", top: "0.75rem" });
    expect(getWorkflowPalettePinnedStyle("bottom-right")).toEqual({
      bottom: "0.75rem",
      right: "0.75rem",
    });
  });
});
