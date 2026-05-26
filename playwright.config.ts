import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const rootDir = fileURLToPath(new URL("./", import.meta.url));
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: "tests/playwright",
  fullyParallel: true,
  retries: isCi ? 2 : 0,
  workers: isCi ? 1 : undefined,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bunx vite --host 127.0.0.1 --port 4173 tests/playwright/app",
    cwd: rootDir,
    reuseExistingServer: !isCi,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  resolveSnapshotPath: (testInfo, snapshotPath) =>
    path.join(testInfo.snapshotDir, path.basename(snapshotPath)),
});
