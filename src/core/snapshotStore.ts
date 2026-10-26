import { type SnapshotInput, type TextSnapshot } from "./model.ts";
import { isValidSnapshotId } from "./uri.ts";

export const MAXIMUM_SNAPSHOTS = 16;
export const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

interface SnapshotEntry {
  readonly snapshot: TextSnapshot;
  references: number;
  unreferencedAt: number | undefined;
}

export interface SnapshotStoreOptions {
  readonly maximum?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
  readonly createId?: () => string;
}

export type CreateSnapshotsResult =
  | { readonly ok: true; readonly snapshots: readonly TextSnapshot[] }
  | { readonly ok: false; readonly reason: "capacity" | "id-collision" };

export class SnapshotStore {
  readonly #entries = new Map<string, SnapshotEntry>();
  readonly #maximum: number;
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #createId: () => string;

  constructor(options: SnapshotStoreOptions = {}) {
    this.#maximum = options.maximum ?? MAXIMUM_SNAPSHOTS;
    this.#ttlMs = options.ttlMs ?? SNAPSHOT_TTL_MS;
    this.#now = options.now ?? Date.now;
    this.#createId = options.createId ?? (() => globalThis.crypto.randomUUID());
    if (!Number.isSafeInteger(this.#maximum) || this.#maximum < 1) {
      throw new Error("Snapshot capacity must be a positive integer.");
    }
    if (!Number.isFinite(this.#ttlMs) || this.#ttlMs < 1) {
      throw new Error("Snapshot TTL must be positive.");
    }
  }

  createMany(
    inputs: readonly SnapshotInput[],
    retained: readonly boolean[] = inputs.map(() => false),
  ): CreateSnapshotsResult {
    if (inputs.length === 0) return { ok: true, snapshots: [] };
    if (inputs.length > this.#maximum || retained.length !== inputs.length) {
      return { ok: false, reason: "capacity" };
    }
    const now = this.#now();
    this.prune(now);
    const snapshots: TextSnapshot[] = [];
    const reserved = new Set<string>();
    for (const input of inputs) {
      const id = this.#nextId(reserved);
      if (!id) return { ok: false, reason: "id-collision" };
      reserved.add(id);
      snapshots.push(Object.freeze({ ...input, id, createdAt: now }));
    }

    const required = this.#entries.size + snapshots.length - this.#maximum;
    if (required > 0) {
      const evictable = [...this.#entries.values()]
        .filter((entry) => entry.references === 0)
        .sort(compareEvictionOrder);
      if (evictable.length < required) return { ok: false, reason: "capacity" };
      for (const entry of evictable.slice(0, required)) this.#entries.delete(entry.snapshot.id);
    }

    snapshots.forEach((snapshot, index) => {
      const references = retained[index] ? 1 : 0;
      this.#entries.set(snapshot.id, {
        snapshot,
        references,
        unreferencedAt: references === 0 ? now : undefined,
      });
    });
    return { ok: true, snapshots };
  }

  replaceRetained(existingId: string | undefined, input: SnapshotInput): CreateSnapshotsResult {
    const existing = existingId ? this.#entries.get(existingId) : undefined;
    if (existingId) this.#entries.delete(existingId);
    const result = this.createMany([input], [true]);
    if (!result.ok && existing) this.#entries.set(existing.snapshot.id, existing);
    return result;
  }

  get(id: string): TextSnapshot | undefined {
    this.prune();
    return this.#entries.get(id)?.snapshot;
  }

  retain(id: string): boolean {
    this.prune();
    const entry = this.#entries.get(id);
    if (!entry) return false;
    entry.references += 1;
    entry.unreferencedAt = undefined;
    return true;
  }

  release(id: string): boolean {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    if (entry.references > 0) entry.references -= 1;
    if (entry.references === 0 && entry.unreferencedAt === undefined) {
      entry.unreferencedAt = this.#now();
    }
    return true;
  }

  remove(id: string): boolean {
    return this.#entries.delete(id);
  }

  prune(now = this.#now()): number {
    let removed = 0;
    for (const [id, entry] of this.#entries) {
      if (
        entry.references === 0
        && entry.unreferencedAt !== undefined
        && now - entry.unreferencedAt >= this.#ttlMs
      ) {
        this.#entries.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  nextExpiryAt(): number | undefined {
    let next: number | undefined;
    for (const entry of this.#entries.values()) {
      if (entry.references !== 0 || entry.unreferencedAt === undefined) continue;
      const expiry = entry.unreferencedAt + this.#ttlMs;
      if (next === undefined || expiry < next) next = expiry;
    }
    return next;
  }

  clear(): void {
    this.#entries.clear();
  }

  get size(): number {
    this.prune();
    return this.#entries.size;
  }

  #nextId(reserved: ReadonlySet<string>): string | undefined {
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const id = this.#createId();
      if (isValidSnapshotId(id) && !reserved.has(id) && !this.#entries.has(id)) return id;
    }
    return undefined;
  }
}

function compareEvictionOrder(left: SnapshotEntry, right: SnapshotEntry): number {
  return (left.unreferencedAt ?? left.snapshot.createdAt)
    - (right.unreferencedAt ?? right.snapshot.createdAt)
    || left.snapshot.createdAt - right.snapshot.createdAt
    || compareSnapshotIds(left.snapshot.id, right.snapshot.id);
}

function compareSnapshotIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
