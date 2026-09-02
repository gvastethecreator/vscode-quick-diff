import assert from "node:assert/strict";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import yauzl from "yauzl";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requested = process.argv[2];
const filename = requested
  ? path.resolve(root, requested)
  : path.join(root, (await readdir(root)).find((name) => /^quick-diff(?:-.*)?\.vsix$/.test(name)) || "");
assert.ok(filename.endsWith(".vsix"), "No Quick Diff VSIX found.");
assert.ok((await stat(filename)).size < 5 * 1024 * 1024, "VSIX exceeds the 5 MB budget.");

const { names, contents } = await inspect(filename);
for (const required of [
  "extension/package.json",
  "extension/dist/node/extension.cjs",
  "extension/dist/web/extension.cjs",
  "extension/media/icon.png",
  "extension/media/preview.png",
  "extension/readme.md",
  "extension/changelog.md",
  "extension/LICENSE.txt",
  "extension/SECURITY.md",
]) {
  assert.ok(names.has(required), `Missing packaged file: ${required}`);
}
for (const name of names) {
  assert.ok(!name.includes(".."), `Unsafe archive entry: ${name}`);
  assert.ok(!name.startsWith("extension/src/"), `Source file leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/test/"), `Test file leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/scripts/"), `Build script leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/node_modules/"), `Dependency leaked into VSIX: ${name}`);
  assert.ok(!name.endsWith(".map"), `Source map leaked into VSIX: ${name}`);
}

const manifest = JSON.parse(contents.get("extension/package.json").toString("utf8"));
assert.equal(manifest.name, "quick-diff");
assert.equal(manifest.version, "0.1.0");
assert.equal(manifest.main, "./dist/node/extension.cjs");
assert.equal(manifest.browser, "./dist/web/extension.cjs");
assert.deepEqual(manifest.activationEvents, []);
assert.deepEqual(manifest.extensionKind, ["ui", "workspace"]);
assert.equal(manifest.capabilities.untrustedWorkspaces.supported, true);
assert.equal(manifest.capabilities.virtualWorkspaces.supported, true);
assert.equal(manifest.contributes.commands.length, 5);
assert.equal(manifest.contributes.menus["editor/context"].length, 1);
assert.equal(manifest.contributes.menus["editor/context"][0].command, "quickDiff.compareSelectionWithClipboard");
assert.equal(manifest.contributes.keybindings, undefined, "No default keybinding should ship in 0.1.0.");
assert.equal(manifest.contributes.views, undefined, "Quick Diff must not ship a view or webview.");
assert.equal(manifest.contributes.configuration, undefined, "Quick Diff 0.1.0 must not add settings.");

for (const bundleName of ["extension/dist/node/extension.cjs", "extension/dist/web/extension.cjs"]) {
  const bundle = contents.get(bundleName).toString("utf8");
  assert.ok(Buffer.byteLength(bundle) < 250 * 1024, `${bundleName} exceeds the 250 KiB budget.`);
  for (const forbidden of ["child_process", "XMLHttpRequest", "WebSocket(", "fetch(", "https://", "http://", "eval("]) {
    assert.equal(bundle.includes(forbidden), false, `${bundleName} contains forbidden runtime surface: ${forbidden}`);
  }
}

const icon = pngMetadata(contents.get("extension/media/icon.png"), "Marketplace icon");
assert.deepEqual([icon.width, icon.height], [256, 256]);
assert.ok(icon.colorType === 4 || icon.colorType === 6, "Marketplace icon must have alpha.");
assert.equal(icon.transparentCorners, 4, "Marketplace icon corners must be transparent.");
const preview = pngMetadata(contents.get("extension/media/preview.png"), "Marketplace preview");
assert.deepEqual([preview.width, preview.height], [1200, 800]);
assert.ok(preview.colorType === 4 || preview.colorType === 6, "Marketplace preview must have alpha.");
assert.equal(preview.transparentCorners, 4, "Marketplace preview corners must be transparent.");
console.log(`VSIX inspection passed: ${names.size} entries.`);

function inspect(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        reject(error || new Error("Could not open VSIX."));
        return;
      }
      const names = new Set();
      const contents = new Map();
      const collected = new Set([
        "extension/package.json",
        "extension/dist/node/extension.cjs",
        "extension/dist/web/extension.cjs",
        "extension/media/icon.png",
        "extension/media/preview.png",
      ]);
      zip.on("error", reject);
      zip.on("end", () => resolve({ names, contents }));
      zip.on("entry", (entry) => {
        names.add(entry.fileName);
        if (!collected.has(entry.fileName)) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError || new Error("Could not read a packaged file."));
            return;
          }
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            contents.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

function pngMetadata(buffer, label) {
  assert.ok(buffer, `${label} is missing.`);
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${label} must be PNG.`);
  assert.equal(buffer.subarray(12, 16).toString("ascii"), "IHDR", `${label} has no IHDR chunk.`);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);
  assert.equal(bitDepth, 8, `${label} must use 8-bit channels.`);
  assert.equal(buffer.readUInt8(28), 0, `${label} must not use interlacing.`);
  const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : 0;
  let offset = 8;
  const imageData = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") imageData.push(buffer.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  let transparentCorners = 0;
  if (channels > 0) {
    const inflated = inflateSync(Buffer.concat(imageData));
    const stride = width * channels;
    const pixels = Buffer.alloc(height * stride);
    let sourceOffset = 0;
    for (let y = 0; y < height; y += 1) {
      const filter = inflated[sourceOffset++];
      assert.ok(filter >= 0 && filter <= 4, `${label} uses an unsupported PNG filter.`);
      for (let x = 0; x < stride; x += 1) {
        const raw = inflated[sourceOffset++];
        const left = x >= channels ? pixels[y * stride + x - channels] : 0;
        const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
        const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
        let predictor = 0;
        if (filter === 1) predictor = left;
        else if (filter === 2) predictor = up;
        else if (filter === 3) predictor = Math.floor((left + up) / 2);
        else if (filter === 4) {
          const estimate = left + up - upLeft;
          const leftDistance = Math.abs(estimate - left);
          const upDistance = Math.abs(estimate - up);
          const diagonalDistance = Math.abs(estimate - upLeft);
          predictor = leftDistance <= upDistance && leftDistance <= diagonalDistance
            ? left
            : upDistance <= diagonalDistance
              ? up
              : upLeft;
        }
        pixels[y * stride + x] = (raw + predictor) & 0xff;
      }
    }
    const alphaOffset = channels - 1;
    const corners = [
      alphaOffset,
      (width - 1) * channels + alphaOffset,
      (height - 1) * stride + alphaOffset,
      (height - 1) * stride + (width - 1) * channels + alphaOffset,
    ];
    transparentCorners = corners.filter((corner) => pixels[corner] === 0).length;
  }
  return { colorType, height, transparentCorners, width };
}
