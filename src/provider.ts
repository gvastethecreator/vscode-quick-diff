import * as vscode from "vscode";
import { SnapshotStore } from "./core/snapshotStore.ts";
import { snapshotIdFromVirtualPath, virtualPathForSnapshot } from "./core/uri.ts";

export const QUICK_DIFF_SCHEME = "quickdiff";

export class QuickDiffContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly store: SnapshotStore) {}

  uriFor(id: string): vscode.Uri {
    return vscode.Uri.from({ scheme: QUICK_DIFF_SCHEME, path: virtualPathForSnapshot(id) });
  }

  snapshotId(uri: vscode.Uri): string | undefined {
    return uri.scheme === QUICK_DIFF_SCHEME
      ? snapshotIdFromVirtualPath(uri.path)
      : undefined;
  }

  provideTextDocumentContent(uri: vscode.Uri): string | undefined {
    const id = this.snapshotId(uri);
    return id ? this.store.get(id)?.text : undefined;
  }
}
