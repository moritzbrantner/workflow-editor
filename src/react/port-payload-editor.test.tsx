import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { WorkflowPortPayloadEditor } from "./port-payload-editor";

afterEach(cleanup);

describe("WorkflowPortPayloadEditor", () => {
  test("does not apply an unchanged payload whose properties are ordered differently", () => {
    const onApply = vi.fn();
    render(
      <WorkflowPortPayloadEditor
        port={{
          id: "audio",
          label: "Audio",
          type: { kind: "any" },
          payload: { mediaType: "audio/wav", mode: "streamed" },
        }}
        direction="inputs"
        onApply={onApply}
      />,
    );

    const mediaType = screen.getByLabelText("Input Audio media type");
    fireEvent.focus(mediaType);
    fireEvent.blur(mediaType);
    fireEvent.keyDown(mediaType, { key: "Enter" });

    expect(onApply).not.toHaveBeenCalled();
  });

  test("applies a changed mode immediately and clears the default contract", () => {
    const onApply = vi.fn();
    render(
      <WorkflowPortPayloadEditor
        port={{ id: "audio", label: "Audio", type: { kind: "any" }, payload: { mode: "streamed" } }}
        direction="outputs"
        onApply={onApply}
      />,
    );

    fireEvent.change(screen.getByLabelText("Output Audio delivery mode"), {
      target: { value: "buffered" },
    });

    expect(onApply).toHaveBeenCalledWith(undefined);
  });
});
