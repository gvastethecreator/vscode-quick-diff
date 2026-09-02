import assert from "node:assert/strict";
import test from "node:test";
import { snapshotIdFromVirtualPath, virtualPathForSnapshot } from "./uri.ts";

test("round-trips content-independent snapshot ids", () => {
  const id = "snapshot-0001";
  const path = virtualPathForSnapshot(id);
  assert.equal(path, "/snapshot/snapshot-0001");
  assert.equal(snapshotIdFromVirtualPath(path), id);
});

test("rejects paths that could carry labels or source text", () => {
  for (const path of [
    "/snapshot/short",
    "/snapshot/id-with/slash",
    "/snapshot/secret%20token",
    "/other/snapshot-0001",
  ]) {
    assert.equal(snapshotIdFromVirtualPath(path), undefined);
  }
  assert.throws(() => virtualPathForSnapshot("secret text"));
});
