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

function findPanelToggle(layout: HTMLElement, panel: "nodes" | "info") {
  const labels =
    panel === "nodes"
      ? ["Expand node palette", "Minimize node palette"]
      : ["Expand info panel", "Minimize info panel"];

  return labels
    .map((label) => layout.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`))
    .find((button): button is HTMLButtonElement => Boolean(button));
}

function expandPanel(layout: HTMLElement, panel: "nodes" | "info") {
  const expandLabel = panel === "nodes" ? "Expand node palette" : "Expand info panel";
  const button = layout.querySelector<HTMLButtonElement>(`button[aria-label="${expandLabel}"]`);

  if (button && !button.disabled) {
    button.click();
  }
}

function setSheet(layout: HTMLElement, sheet: Exclude<MobileSheet, "none">) {
  const current = (layout.dataset.mobileSheet ?? "none") as MobileSheet;
  const next: MobileSheet = current === sheet ? "none" : sheet;

  layout.dataset.mobileSheet = next;
  if (next === "nodes" || next === "info") {
    expandPanel(layout, next);
  }
  syncDock(layout);
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

function syncDock(layout: HTMLElement) {
  const sheet = (layout.dataset.mobileSheet ?? "none") as MobileSheet;
  const buttons = layout.querySelectorAll<HTMLButtonElement>("[data-mobile-workbench-tool]");

  for (const button of buttons) {
    button.setAttribute("aria-pressed", String(button.dataset.mobileWorkbenchTool === sheet));
  }

  const infoButton = layout.querySelector<HTMLButtonElement>(
    '[data-mobile-workbench-tool="info"]',
  );
  const infoToggle = findPanelToggle(layout, "info");
  if (infoButton) {
    infoButton.disabled = !infoToggle || infoToggle.disabled;
  }
}

function installCanvasDismiss(layout: HTMLElement) {
  if (layout.dataset.mobileDismissInstalled === "true") {
    return;
  }

  layout.dataset.mobileDismissInstalled = "true";
  layout.addEventListener(
    "pointerdown",
    (event) => {
      const sheet = (layout.dataset.mobileSheet ?? "none") as MobileSheet;
      if (sheet === "none" || !(event.target instanceof Element)) {
        return;
      }

      if (
        event.target.closest(
          "[data-mobile-workbench-dock], [data-slot='workflow-palette-overlay'], [data-slot='workflow-inspector-overlay'], [data-slot='workbench-toolbar']",
        )
      ) {
        return;
      }

      layout.dataset.mobileSheet = "none";
      syncDock(layout);
    },
    true,
  );
}

function installMobileWorkbench(layout: HTMLElement) {
  layout.dataset.mobileWorkbench = "true";
  layout.dataset.mobileSheet ??= "none";
  installDock(layout);
  installCanvasDismiss(layout);
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
  attributeFilter: ["aria-label", "disabled"],
  childList: true,
  subtree: true,
});

mobileViewport.addEventListener("change", queueReconcile);
reconcileMobileWorkbench();
