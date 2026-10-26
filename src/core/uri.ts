const SNAPSHOT_ID = /^[A-Za-z0-9-]{8,128}$/u;
const PREFIX = "/snapshot/";

export function virtualPathForSnapshot(id: string): string {
  if (!SNAPSHOT_ID.test(id)) throw new Error("Invalid Quick Diff snapshot id.");
  return `${PREFIX}${id}`;
}

export function snapshotIdFromVirtualPath(path: string): string | undefined {
  if (!path.startsWith(PREFIX)) return undefined;
  const id = path.slice(PREFIX.length);
  return SNAPSHOT_ID.test(id) ? id : undefined;
}

export function isValidSnapshotId(id: string): boolean {
  return SNAPSHOT_ID.test(id);
}
