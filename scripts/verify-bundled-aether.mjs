import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = path.join(repoRoot, "src-tauri");
const configPath = path.join(tauriDir, "tauri.conf.json");
const binaryName = process.platform === "win32" ? "aether.exe" : "aether";
const binaryPath = path.join(tauriDir, "binaries", binaryName);

async function main() {
  await access(binaryPath);
  const binaryStat = await stat(binaryPath);
  if (!binaryStat.isFile() || binaryStat.size <= 0) {
    throw new Error(`Bundled Aether binary is missing or empty: ${binaryPath}`);
  }

  const config = JSON.parse(await readFile(configPath, "utf8"));
  const resources = config?.bundle?.resources;
  if (!Array.isArray(resources) || !resources.includes("binaries/*")) {
    throw new Error(
      'Tauri bundle.resources must include "binaries/*" so the Aether core ships with installers.',
    );
  }

  console.log(
    `Bundled Aether resource verified: ${path.relative(repoRoot, binaryPath)} (${binaryStat.size} bytes)`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
