import assert from "node:assert/strict";
import test from "node:test";
import {
  MAXIMUM_SOURCE_BYTES,
  WARNING_SOURCE_BYTES,
  assessSourceSize,
  utf8ByteLength,
} from "./limits.ts";

test("matches UTF-8 byte semantics for Unicode and lone surrogates", () => {
  for (const value of ["ascii", "é中😀", "\0\n", "\ud800", "a\udc00b"]) {
    assert.equal(utf8ByteLength(value), new TextEncoder().encode(value).byteLength);
  }
});

test("applies warning and hard boundaries without truncation", () => {
  assert.equal(assessSourceSize("a".repeat(WARNING_SOURCE_BYTES)).level, "safe");
  assert.equal(assessSourceSize("a".repeat(WARNING_SOURCE_BYTES + 1)).level, "warning");
  assert.equal(assessSourceSize("a".repeat(MAXIMUM_SOURCE_BYTES)).level, "warning");
  const blocked = assessSourceSize("a".repeat(MAXIMUM_SOURCE_BYTES + 1));
  assert.deepEqual(blocked, { bytes: MAXIMUM_SOURCE_BYTES + 1, level: "blocked" });
});
