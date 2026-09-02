import assert from "node:assert/strict";
import test from "node:test";
import { buildDiffTitle, buildDocumentLabels } from "./labels.ts";

test("uses basenames when they are unique", () => {
  assert.deepEqual(buildDocumentLabels([
    { key: "a", basename: "app.ts", workspaceRelative: "client/app.ts", scheme: "file" },
    { key: "b", basename: "config.ts", workspaceRelative: "server/config.ts", scheme: "file" },
  ]), [
    { key: "a", label: "app.ts", description: "client/app.ts" },
    { key: "b", label: "config.ts", description: "server/config.ts" },
  ]);
});

test("disambiguates duplicate names with safe workspace-relative labels", () => {
  assert.deepEqual(buildDocumentLabels([
    { key: "a", basename: "index.ts", workspaceRelative: "client/index.ts", scheme: "file" },
    { key: "b", basename: "index.ts", workspaceRelative: "server/index.ts", scheme: "file" },
  ]).map((item) => item.label), ["client/index.ts", "server/index.ts"]);
});

test("never promotes absolute paths into labels", () => {
  const labels = buildDocumentLabels([
    { key: "a", basename: "same.ts", workspaceRelative: "C:\\secret\\same.ts", scheme: "file" },
    { key: "b", basename: "same.ts", workspaceRelative: "/private/same.ts", scheme: "file" },
  ]);
  assert.deepEqual(labels.map((item) => item.label), ["same.ts (1)", "same.ts (2)"]);
  assert.equal(JSON.stringify(labels).includes("secret"), false);
  assert.equal(JSON.stringify(labels).includes("private"), false);
});

test("sanitizes control characters in native diff titles", () => {
  assert.equal(buildDiffTitle("Left\nsecret", "Right\0value"), "Left secret ↔ Right value");
});
