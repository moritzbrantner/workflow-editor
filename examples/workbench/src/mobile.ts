const mobileViewport = window.matchMedia("(max-width: 640px)");

type MobileSheet = "none" | "nodes" | "actions" | "info";

let reconcileQueued = false;

function queueReconcile() {
  if (reconcileQueued) {
    return;
  }

  reconcileQueued = true;
  window.requestAnimationFrame(() => {
    reconcileQueued = false;
    reconcileMobileWorkbench();
  });
}

// The inspector is the workbench's shared editor pane: on a phone it is an overlay drawer that
// the dock opens and closes through the pane's own show/hide controls.
function findInspectorPane(layout: HTMLElement) {
  return layout.querySelector<HTMLElement>('[data-workflow-pane="inspector"]');
}

function inspectorPaneOpen(layout: HTMLElement) {
  return findInspectorPane(layout)?.dataset.state === "open";
}

function setInspectorPaneOpen(layout: HTMLElement, open: boolean) {
  const pane = findInspectorPane(layout);
  if (!pane || inspectorPaneOpen(layout) === open) {
    return;
  }
  const label = pane.getAttribute("aria-label") ?? "Inspector";
  layout
    .querySelector<HTMLButtonElement>(
      `button[aria-controls="${pane.id}"][aria-label="${open ? "Show" : "Hide"} ${label}"]`,
    )
    ?.click();
}

function expandPalette(layout: HTMLElement) {
  const button = layout.querySelector<HTMLButtonElement>(
    'button[aria-label="Expand node palette"]',
  );

  if (button && !button.disabled) {
    button.click();
  }
}

function setSheet(layout: HTMLElement, sheet: Exclude<MobileSheet, "none">) {
  const current = (layout.dataset.mobileSheet ?? "none") as MobileSheet;
  const next: MobileSheet = current === sheet ? "none" : sheet;

  layout.dataset.mobileSheet = next;
  if (next === "nodes") {
    expandPalette(layout);
  }
  setInspectorPaneOpen(layout, next === "info");
  // The drawer renders on the next commit; the observer reconciles the dock with it afterwards.
  syncDock(layout, false);
}

function createDockButton(label: string, sheet: Exclude<MobileSheet, "none">) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.mobileWorkbenchTool = sheet;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    const layout = button.closest<HTMLElement>('[data-mobile-workbench="true"]');
    if (layout) {
      setSheet(layout, sheet);
    }
  });
  return button;
}

function installDock(layout: HTMLElement) {
  if (layout.querySelector("[data-mobile-workbench-dock]")) {
    return;
  }

  const dock = document.createElement("nav");
  dock.dataset.mobileWorkbenchDock = "";
  dock.setAttribute("aria-label", "Workflow tools");
  dock.append(
    createDockButton("Nodes", "nodes"),
    createDockButton("Actions", "actions"),
    createDockButton("Info", "info"),
  );
  layout.append(dock);
}

function syncDock(layout: HTMLElement, followDrawer = true) {
  // The drawer also opens from its rail and closes on Escape, scrim or focus leaving it.
  const current = (layout.dataset.mobileSheet ?? "none") as MobileSheet;
  const drawerOpen = inspectorPaneOpen(layout);
  const sheet: MobileSheet = !followDrawer
    ? current
    : drawerOpen
      ? "info"
      : current === "info"
        ? "none"
        : current;
  layout.dataset.mobileSheet = sheet;
  const buttons = layout.querySelectorAll<HTMLButtonElement>("[data-mobile-workbench-tool]");

  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.mobileWorkbenchTool === sheet));
  }

  const infoButton = layout.querySelector<HTMLButtonElement>('[data-mobile-workbench-tool="info"]');
  if (infoButton) {
    infoButton.disabled = !findInspectorPane(layout);
  }
}

const sheetSurfaceSelector =
  "[data-mobile-workbench-dock], [data-slot='workflow-palette-overlay'], [data-workflow-pane='inspector'], [data-slot='workbench-toolbar']";

// Listen on window in the capture phase: the editor canvas stops pointer events in React
// capture handlers at the root container, before a listener on the layout would run.
function dismissSheetOnCanvasPointerDown(event: PointerEvent) {
  if (!(event.target instanceof Element) || event.target.closest(sheetSurfaceSelector)) {
    return;
  }

  const layout = event.target.closest<HTMLElement>('[data-mobile-workbench="true"]');
  if (!layout || (layout.dataset.mobileSheet ?? "none") === "none") {
    return;
  }

  layout.dataset.mobileSheet = "none";
  setInspectorPaneOpen(layout, false);
  syncDock(layout, false);
}

function installMobileWorkbench(layout: HTMLElement) {
  layout.dataset.mobileWorkbench = "true";
  layout.dataset.mobileSheet ??= "none";
  installDock(layout);
  syncDock(layout);
}

function uninstallMobileWorkbench(layout: HTMLElement) {
  layout.querySelector("[data-mobile-workbench-dock]")?.remove();
  delete layout.dataset.mobileWorkbench;
  delete layout.dataset.mobileSheet;
}

function reconcileMobileWorkbench() {
  const layouts = document.querySelectorAll<HTMLElement>('[data-slot="workbench-layout"]');

  if (!mobileViewport.matches) {
    for (const layout of layouts) {
      if (layout.dataset.mobileWorkbench === "true") {
        uninstallMobileWorkbench(layout);
      }
    }
    return;
  }

  for (const layout of layouts) {
    installMobileWorkbench(layout);
  }
}

const observer = new MutationObserver(queueReconcile);
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["aria-label", "aria-expanded", "disabled"],
  childList: true,
  subtree: true,
});

window.addEventListener("pointerdown", dismissSheetOnCanvasPointerDown, true);
mobileViewport.addEventListener("change", queueReconcile);
reconcileMobileWorkbench();
