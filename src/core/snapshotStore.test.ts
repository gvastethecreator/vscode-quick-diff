import assert from "node:assert/strict";
import test from "node:test";
import { SnapshotStore } from "./snapshotStore.ts";

function input(text: string) {
  return { text, label: text, languageId: "typescript", sourceKind: "selection" as const };
}

function idFactory() {
  let counter = 0;
  return () => `snapshot-${String(++counter).padStart(4, "0")}`;
}

test("creates immutable snapshots and returns exact content", () => {
  let now = 10;
  const store = new SnapshotStore({ now: () => now, createId: idFactory() });
  const created = store.createMany([input("secret\0😀")]);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const snapshot = created.snapshots[0];
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(store.get(snapshot.id)?.text, "secret\0😀");
  assert.equal(snapshot.createdAt, 10);
  now += 1;
});

test("evicts the oldest unreferenced snapshot deterministically", () => {
  let now = 0;
  const store = new SnapshotStore({ maximum: 2, ttlMs: 1_000, now: () => now, createId: idFactory() });
  const first = store.createMany([input("first")]);
  assert.equal(first.ok, true);
  now = 1;
  const second = store.createMany([input("second")]);
  assert.equal(second.ok, true);
  now = 2;
  const third = store.createMany([input("third")]);
  assert.equal(third.ok, true);
  if (!first.ok || !second.ok || !third.ok) return;
  assert.equal(store.get(first.snapshots[0].id), undefined);
  assert.equal(store.get(second.snapshots[0].id)?.text, "second");
  assert.equal(store.get(third.snapshots[0].id)?.text, "third");
});

test("retained snapshots block unsafe eviction", () => {
  const store = new SnapshotStore({ maximum: 2, createId: idFactory() });
  const pinned = store.createMany([input("left"), input("right")], [true, true]);
  assert.equal(pinned.ok, true);
  assert.deepEqual(store.createMany([input("extra")]), { ok: false, reason: "capacity" });
});

test("expires only after a snapshot becomes unreferenced", () => {
  let now = 0;
  const store = new SnapshotStore({ ttlMs: 100, now: () => now, createId: idFactory() });
  const created = store.createMany([input("open")], [true]);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const id = created.snapshots[0].id;
  now = 500;
  assert.equal(store.prune(), 0);
  store.release(id);
  assert.equal(store.nextExpiryAt(), 600);
  now = 599;
  assert.equal(store.prune(), 0);
  now = 600;
  assert.equal(store.prune(), 1);
  assert.equal(store.size, 0);
});

test("replaces the retained left snapshot without mutating its text", () => {
  const store = new SnapshotStore({ maximum: 1, createId: idFactory() });
  const first = store.replaceRetained(undefined, input("first"));
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const oldSnapshot = first.snapshots[0];
  const second = store.replaceRetained(oldSnapshot.id, input("second"));
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(store.get(oldSnapshot.id), undefined);
  assert.equal(store.get(second.snapshots[0].id)?.text, "second");
  assert.equal(oldSnapshot.text, "first");
});

test("fails closed after repeated invalid or colliding ids", () => {
  const invalid = new SnapshotStore({ createId: () => "source text" });
  assert.deepEqual(invalid.createMany([input("x")]), { ok: false, reason: "id-collision" });

  const colliding = new SnapshotStore({ createId: () => "snapshot-fixed" });
  assert.equal(colliding.createMany([input("a")]).ok, true);
  assert.deepEqual(colliding.createMany([input("b")]), { ok: false, reason: "id-collision" });
});
