import { access, mkdir, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDir, "..");
const buildDir = path.join(projectRoot, "dist", "chromium");
const artifactsDir = path.join(projectRoot, "artifacts");

const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const manifestPath = path.join(buildDir, "manifest.json");

await access(manifestPath);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.version !== packageJson.version) {
  throw new Error(
    `Built manifest version ${manifest.version} does not match package version ${packageJson.version}.`,
  );
}

if ("update_url" in manifest) {
  throw new Error(
    "Chrome Web Store packages must not contain a self-hosted update_url.",
  );
}

if ("sidebar_action" in manifest) {
  throw new Error(
    "Chromium package unexpectedly contains the Firefox-only sidebar_action field.",
  );
}

await mkdir(artifactsDir, { recursive: true });
const archivePath = path.join(
  artifactsDir,
  `ai-translate-chrome-web-store-${packageJson.version}.zip`,
);
await rm(archivePath, { force: true });

await new Promise((resolve, reject) => {
  const child = spawn(
    "zip",
    ["-q", "-r", archivePath, ".", "-x", "*.DS_Store", "__MACOSX/*"],
    {
      cwd: buildDir,
      stdio: "inherit",
    },
  );
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`zip exited with code ${code}`));
  });
});

console.log(`Chrome Web Store package created: ${archivePath}`);
