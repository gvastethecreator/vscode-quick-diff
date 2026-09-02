import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTests } from "@vscode/test-electron";
import { downloadVSCode } from "./download-vscode.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const version = process.env.VSCODE_TEST_VERSION || "stable";
const vscodeExecutablePath = await downloadVSCode(version);
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "qdf-"));
const workspace = path.join(temporaryRoot, "workspace");
await cp(path.join(root, "test-workspace"), workspace, { recursive: true });
const launchArgs = [
  workspace,
  "--disable-extensions",
  "--skip-welcome",
  "--skip-release-notes",
  "--user-data-dir",
  path.join(temporaryRoot, "data"),
  "--extensions-dir",
  path.join(temporaryRoot, "ext"),
];
if (process.platform === "linux") {
  launchArgs.push("--disable-gpu");
  if (process.env.CI) launchArgs.push("--no-sandbox");
}

try {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, "test", "integration", "suite", "index.cjs"),
    launchArgs,
    reuseMachineInstall: true,
    vscodeExecutablePath,
  });
} finally {
  if (temporaryRoot.startsWith(os.tmpdir() + path.sep)) {
    await rm(temporaryRoot, { force: true, maxRetries: 10, recursive: true, retryDelay: 200 });
  }
}
