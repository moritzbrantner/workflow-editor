import type { CSSProperties, ReactNode } from "react";

import { cn } from "@moritzbrantner/ui";

export function WorkflowWorkbenchOverlayPanel({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      data-slot="workflow-overlay-panel"
      className={cn(
        "absolute z-[20000] flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}
