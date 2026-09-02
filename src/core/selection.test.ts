import assert from "node:assert/strict";
import test from "node:test";
import { collectSelectionText } from "./selection.ts";

test("rejects missing and empty selections", () => {
  assert.deepEqual(collectSelectionText("abc", [], "\n"), { ok: false, reason: "empty-selection" });
  assert.deepEqual(collectSelectionText("abc", [{ anchor: 1, active: 1 }], "\n"), {
    ok: false,
    reason: "empty-selection",
  });
});

test("sorts reversed selections and joins them with the document EOL", () => {
  const source = "zero one two three";
  const result = collectSelectionText(source, [
    { anchor: 18, active: 13 },
    { anchor: 8, active: 5 },
  ], "\r\n");
  assert.deepEqual(result, {
    ok: true,
    ranges: [{ start: 5, end: 8 }, { start: 13, end: 18 }],
    text: "one\r\nthree",
  });
});

test("unions overlaps without duplicating source text", () => {
  const result = collectSelectionText("abcdefgh", [
    { anchor: 1, active: 5 },
    { anchor: 3, active: 7 },
    { anchor: 2, active: 4 },
  ], "\n");
  assert.deepEqual(result, {
    ok: true,
    ranges: [{ start: 1, end: 7 }],
    text: "bcdefg",
  });
});

test("keeps adjacent selections distinct", () => {
  const result = collectSelectionText("abcd", [
    { anchor: 0, active: 2 },
    { anchor: 2, active: 4 },
  ], "\n");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.text, "ab\ncd");
});

test("preserves Unicode, emoji, nulls, and partial lines exactly", () => {
  const source = "prefix\n😀\0中 suffix\nend";
  const start = source.indexOf("😀");
  const end = source.indexOf(" suffix") + 4;
  const result = collectSelectionText(source, [{ anchor: start, active: end }], "\n");
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.text, source.slice(start, end));
});

test("rejects offsets outside the document", () => {
  assert.deepEqual(collectSelectionText("abc", [{ anchor: -1, active: 2 }], "\n"), {
    ok: false,
    reason: "invalid-selection",
  });
  assert.deepEqual(collectSelectionText("abc", [{ anchor: 0, active: 4 }], "\n"), {
    ok: false,
    reason: "invalid-selection",
  });
});
