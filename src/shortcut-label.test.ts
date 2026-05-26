import { describe, expect, test } from "vitest";

import { formatShortcutLabel } from "./shortcut-label";

describe("formatShortcutLabel", () => {
  test("formats compact shortcut labels without external keyboard helpers", () => {
    expect(formatShortcutLabel("Mod+D")).toBe("Mod+D");
    expect(formatShortcutLabel("control+arrowdown")).toBe("Ctrl+Arrowdown");
  });
});
