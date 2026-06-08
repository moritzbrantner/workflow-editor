import { cp, mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const rootDir = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const tempDir = await mkdtemp(path.join(tmpdir(), "workflow-editor-tsd-"));
const keepTemp = process.env.WORKFLOW_EDITOR_KEEP_TSD_TEMP === "1";

try {
  await cp(path.join(rootDir, "dist"), path.join(tempDir, "dist"), { recursive: true });
  await cp(path.join(rootDir, "test-d"), path.join(tempDir, "test-d"), { recursive: true });
  await linkNodeModules(tempDir);

  const packageJson = await import(path.join(rootDir, "package.json"), {
    with: { type: "json" },
  });
  await writeFile(
    path.join(tempDir, "package.json"),
    `${JSON.stringify(
      {
        name: packageJson.default.name,
        version: packageJson.default.version,
        type: packageJson.default.type,
        main: packageJson.default.main,
        types: packageJson.default.types,
        exports: packageJson.default.exports,
        dependencies: packageJson.default.dependencies,
        peerDependencies: packageJson.default.peerDependencies,
        tsd: {
          directory: "test-d",
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(tempDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
        },
        include: ["test-d/**/*.ts"],
      },
      null,
      2,
    )}\n`,
  );

  execFileSync(
    path.join(rootDir, "node_modules/.bin/tsd"),
    ["--typings", "dist/index.d.ts", "--files", "test-d/workflow-editor.test-d.ts"],
    {
      cwd: tempDir,
      stdio: "inherit",
    },
  );
} finally {
  if (keepTemp) {
    process.stderr.write(`Kept tsd temp directory: ${tempDir}\n`);
  } else {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function linkNodeModules(packageDir) {
  const rootNodeModules = path.join(rootDir, "node_modules");
  const tempNodeModules = path.join(packageDir, "node_modules");
  await mkdir(tempNodeModules, { recursive: true });

  await Promise.all(
    (await readdir(rootNodeModules))
      .filter((entry) => entry !== ".bin" && entry !== "@moritzbrantner")
      .map((entry) =>
        symlink(path.join(rootNodeModules, entry), path.join(tempNodeModules, entry), "junction"),
      ),
  );

  const tempScopeDir = path.join(tempNodeModules, "@moritzbrantner");
  const rootScopeDir = path.join(rootNodeModules, "@moritzbrantner");
  await mkdir(tempScopeDir, { recursive: true });

  await Promise.all(
    (await readdir(rootScopeDir))
      .filter((entry) => entry !== "workflow-editor")
      .map((entry) =>
        symlink(path.join(rootScopeDir, entry), path.join(tempScopeDir, entry), "junction"),
      ),
  );

  await symlink(packageDir, path.join(tempScopeDir, "workflow-editor"), "junction");
}
