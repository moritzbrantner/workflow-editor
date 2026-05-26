import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

delete process.env.FORCE_COLOR;
delete process.env.NO_COLOR;

const rootDir = fileURLToPath(new URL("./", import.meta.url));
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "on-first-retry",
  },
  webServer: {
    command: "node scripts/playwright-web-server.mjs",
    cwd: rootDir,
    reuseExistingServer: false,
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
