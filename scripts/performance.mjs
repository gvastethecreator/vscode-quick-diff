import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { assessSourceSize } from "../src/core/limits.ts";
import { collectSelectionText } from "../src/core/selection.ts";
import { SnapshotStore } from "../src/core/snapshotStore.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = "const value = \"quick diff\";\n".repeat(28_000).slice(0, 768 * 1024);
const selections = Array.from({ length: 256 }, (_, index) => {
  const start = index * 1_024;
  return { anchor: start, active: start + 64 };
});

collectSelectionText(source, selections, "\n");
const selectionMs = measure(() => collectSelectionText(source, selections, "\n"));
assert.ok(selectionMs < 30, `Selection preparation exceeded 30 ms: ${selectionMs.toFixed(2)} ms.`);

assessSourceSize(source);
const sizeMs = measure(() => assessSourceSize(source));
assert.ok(sizeMs < 30, `UTF-8 size assessment exceeded 30 ms: ${sizeMs.toFixed(2)} ms.`);

let id = 0;
const store = new SnapshotStore({ createId: () => `snapshot-${String(++id).padStart(8, "0")}` });
const storeMs = measure(() => {
  for (let index = 0; index < 1_000; index += 1) {
    const created = store.createMany([{
      text: `value-${index}`,
      label: "Selection",
      languageId: "typescript",
      sourceKind: "selection",
    }]);
    assert.equal(created.ok, true);
    if (created.ok) assert.equal(store.get(created.snapshots[0].id)?.text, `value-${index}`);
  }
});
assert.ok(storeMs < 100, `1,000 snapshot insert/lookups exceeded 100 ms: ${storeMs.toFixed(2)} ms.`);
assert.ok(store.size <= 16, "Snapshot store exceeded its hard capacity.");

for (const output of ["dist/node/extension.cjs", "dist/web/extension.cjs"]) {
  const bytes = (await stat(path.join(root, output))).size;
  assert.ok(bytes < 250 * 1024, `${output} exceeds the 250 KiB bundle budget.`);
}

console.log(
  `Performance passed: selections ${selectionMs.toFixed(2)} ms; size ${sizeMs.toFixed(2)} ms; `
  + `1,000 store operations ${storeMs.toFixed(2)} ms.`,
);

function measure(operation) {
  const started = performance.now();
  operation();
  return performance.now() - started;
}
