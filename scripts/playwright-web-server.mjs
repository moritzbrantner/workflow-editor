import { spawn } from "node:child_process";

const env = { ...process.env };
delete env.FORCE_COLOR;

const command = process.platform === "win32" ? "bunx.cmd" : "bunx";
const child = spawn(
  command,
  ["vite", "--host", "127.0.0.1", "--port", "4174", "--strictPort", "src/react.e2e-app"],
  {
    env,
    stdio: "inherit",
  },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
