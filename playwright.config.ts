import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

delete process.env.FORCE_COLOR;
delete process.env.NO_COLOR;

const rootDir = fileURLToPath(new URL("./", import.meta.url));
const workerCount = parseWorkerCount(
  process.env.WORKFLOW_EDITOR_PLAYWRIGHT_WORKERS ??
    process.env.WORKFLOW_EDITOR_TEST_WORKERS ??
    process.env.WORKFLOW_EDITOR_WORKERS,
  1,
);
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "src",
  testMatch: "**/*.e2e.spec.ts",
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  workers: workerCount,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/playwright-web-server.mjs",
    cwd: rootDir,
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
  resolveSnapshotPath: (testInfo, snapshotPath) =>
    path.join(testInfo.snapshotDir, path.basename(snapshotPath)),
});

function parseWorkerCount(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
