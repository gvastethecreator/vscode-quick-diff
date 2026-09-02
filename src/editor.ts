import * as vscode from "vscode";
import { COMMAND_ACTIONS, type QuickDiffCommand } from "./commands.ts";
import { buildDiffTitle, buildDocumentLabels } from "./core/labels.ts";
import { assessSourceSize } from "./core/limits.ts";
import {
  type DocumentLabel,
  type DocumentLabelInput,
  type QuickDiffRejection,
  type SnapshotInput,
} from "./core/model.ts";
import { collectSelectionText } from "./core/selection.ts";
import { SnapshotStore } from "./core/snapshotStore.ts";
import { QUICK_DIFF_SCHEME, QuickDiffContentProvider } from "./provider.ts";

interface OpenDocumentItem extends vscode.QuickPickItem {
  readonly document: vscode.TextDocument;
  readonly sourceLabel: string;
}

export class QuickDiffController implements vscode.Disposable {
  readonly #store = new SnapshotStore();
  readonly #provider = new QuickDiffContentProvider(this.#store);
  readonly #openSnapshotIds = new Map<string, string>();
  #leftSnapshotId: string | undefined;
  #cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  #statusMessage: vscode.Disposable | undefined;
  #pending: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(QUICK_DIFF_SCHEME, this.#provider),
      vscode.workspace.onDidOpenTextDocument((document) => this.#trackOpenDocument(document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.#trackClosedDocument(document)),
    );
    for (const [id, action] of Object.entries(COMMAND_ACTIONS)) {
      context.subscriptions.push(
        vscode.commands.registerCommand(id, (...args: unknown[]) => this.run(action, args)),
      );
    }
    context.subscriptions.push(this);
  }

  run(command: QuickDiffCommand, args: readonly unknown[]): Promise<void> {
    const operation = this.#pending.then(() => this.#execute(command, args));
    this.#pending = operation.catch(() => undefined);
    return operation;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.#cleanupTimer) clearTimeout(this.#cleanupTimer);
    this.#cleanupTimer = undefined;
    this.#statusMessage?.dispose();
    this.#statusMessage = undefined;
    this.#openSnapshotIds.clear();
    this.#leftSnapshotId = undefined;
    this.#store.clear();
  }

  async #execute(command: QuickDiffCommand, args: readonly unknown[]): Promise<void> {
    if (this.#disposed) return;
    if (args.length !== 0) {
      this.#warn("invalid-command-arguments");
      return;
    }
    try {
      if (command === "compareSelectionWithClipboard") await this.#compareSelectionWithClipboard();
      else if (command === "useSelectionAsLeft") await this.#captureLeft();
      else if (command === "compareSelectionWithLeft") await this.#compareSelectionWithLeft();
      else if (command === "compareFileWithClipboard") await this.#compareFileWithClipboard();
      else await this.#compareOpenFiles();
    } catch {
      this.#warn("operation-failed");
    }
  }

  async #compareSelectionWithClipboard(): Promise<void> {
    const selected = this.#activeSelection();
    if (!selected.ok) {
      this.#warn(selected.reason);
      return;
    }
    const clipboard = await vscode.env.clipboard.readText();
    if (clipboard.length === 0) {
      this.#warn("empty-clipboard");
      return;
    }
    await this.#openComparison(
      {
        text: selected.text,
        label: `Selection: ${selected.documentLabel}`,
        languageId: selected.document.languageId,
        sourceKind: "selection",
      },
      {
        text: clipboard,
        label: "Clipboard",
        languageId: selected.document.languageId,
        sourceKind: "clipboard",
      },
    );
  }

  async #captureLeft(): Promise<void> {
    const selected = this.#activeSelection();
    if (!selected.ok) {
      this.#warn(selected.reason);
      return;
    }
    const input: SnapshotInput = {
      text: selected.text,
      label: `Left Selection: ${selected.documentLabel}`,
      languageId: selected.document.languageId,
      sourceKind: "selection",
    };
    if (!await this.#approveSizes([input], "Capture Anyway")) return;
    const created = this.#store.replaceRetained(this.#leftSnapshotId, input);
    if (!created.ok) {
      this.#warn("snapshot-capacity");
      return;
    }
    this.#leftSnapshotId = created.snapshots[0].id;
    this.#scheduleCleanup();
    this.#statusMessage?.dispose();
    this.#statusMessage = vscode.window.setStatusBarMessage("Quick Diff: Left selection captured.", 2_000);
  }

  async #compareSelectionWithLeft(): Promise<void> {
    const left = this.#leftSnapshotId ? this.#store.get(this.#leftSnapshotId) : undefined;
    if (!left) {
      this.#leftSnapshotId = undefined;
      this.#warn("missing-left");
      return;
    }
    const selected = this.#activeSelection();
    if (!selected.ok) {
      this.#warn(selected.reason);
      return;
    }
    await this.#openComparison(
      {
        text: left.text,
        label: left.label,
        languageId: left.languageId,
        sourceKind: left.sourceKind,
      },
      {
        text: selected.text,
        label: `Selection: ${selected.documentLabel}`,
        languageId: selected.document.languageId,
        sourceKind: "selection",
      },
    );
  }

  async #compareFileWithClipboard(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.#warn("no-editor");
      return;
    }
    const clipboard = await vscode.env.clipboard.readText();
    if (clipboard.length === 0) {
      this.#warn("empty-clipboard");
      return;
    }
    const label = this.#labelsForDocuments([editor.document])[0].label;
    await this.#openComparison(
      {
        text: editor.document.getText(),
        label,
        languageId: editor.document.languageId,
        sourceKind: "document",
      },
      {
        text: clipboard,
        label: "Clipboard",
        languageId: editor.document.languageId,
        sourceKind: "clipboard",
      },
    );
  }

  async #compareOpenFiles(): Promise<void> {
    const documents = this.#openTextDocuments();
    if (documents.length < 2) {
      this.#warn("not-enough-open-documents");
      return;
    }
    const labels = this.#labelsForDocuments(documents);
    const labelByKey = new Map(labels.map((label) => [label.key, label]));
    const items: OpenDocumentItem[] = documents.map((document) => {
      const key = document.uri.toString();
      const source = labelByKey.get(key) ?? { key, label: this.#basename(document.uri) };
      return {
        label: source.label,
        description: source.description,
        detail: document.isDirty ? `${document.languageId} · Unsaved changes` : document.languageId,
        document,
        sourceLabel: source.label,
      };
    }).sort((left, right) => left.label.localeCompare(right.label) || (left.description ?? "").localeCompare(right.description ?? ""));

    const left = await vscode.window.showQuickPick(items, {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select the left document",
    });
    if (!left) return;
    const right = await vscode.window.showQuickPick(items.filter((item) => item.document !== left.document), {
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "Select the right document",
    });
    if (!right) return;

    await this.#openComparison(
      {
        text: left.document.getText(),
        label: left.sourceLabel,
        languageId: left.document.languageId,
        sourceKind: "document",
      },
      {
        text: right.document.getText(),
        label: right.sourceLabel,
        languageId: right.document.languageId,
        sourceKind: "document",
      },
    );
  }

  #activeSelection():
    | {
        readonly ok: true;
        readonly text: string;
        readonly document: vscode.TextDocument;
        readonly documentLabel: string;
      }
    | { readonly ok: false; readonly reason: Extract<QuickDiffRejection, "no-editor" | "empty-selection" | "invalid-selection"> } {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return { ok: false, reason: "no-editor" };
    const document = editor.document;
    const selected = collectSelectionText(
      document.getText(),
      editor.selections.map((selection) => ({
        anchor: document.offsetAt(selection.anchor),
        active: document.offsetAt(selection.active),
      })),
      document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n",
    );
    if (!selected.ok) return selected;
    return {
      ok: true,
      text: selected.text,
      document,
      documentLabel: this.#labelsForDocuments([document])[0].label,
    };
  }

  async #openComparison(left: SnapshotInput, right: SnapshotInput): Promise<void> {
    if (!await this.#approveSizes([left, right], "Compare Anyway")) return;
    const created = this.#store.createMany([left, right]);
    if (!created.ok) {
      this.#warn("snapshot-capacity");
      return;
    }
    const [leftSnapshot, rightSnapshot] = created.snapshots;
    const leftUri = this.#provider.uriFor(leftSnapshot.id);
    const rightUri = this.#provider.uriFor(rightSnapshot.id);
    this.#scheduleCleanup();
    try {
      await this.#prepareVirtualDocument(leftUri, leftSnapshot.languageId);
      await this.#prepareVirtualDocument(rightUri, rightSnapshot.languageId);
      await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        buildDiffTitle(leftSnapshot.label, rightSnapshot.label),
      );
    } catch {
      this.#store.remove(leftSnapshot.id);
      this.#store.remove(rightSnapshot.id);
      this.#scheduleCleanup();
      throw new Error("Quick Diff could not open the native diff editor.");
    }
  }

  async #prepareVirtualDocument(uri: vscode.Uri, languageId: string | undefined): Promise<void> {
    const document = await vscode.workspace.openTextDocument(uri);
    if (languageId && document.languageId !== languageId) {
      await vscode.languages.setTextDocumentLanguage(document, languageId);
    }
  }

  async #approveSizes(inputs: readonly SnapshotInput[], action: string): Promise<boolean> {
    const assessments = inputs.map((input) => assessSourceSize(input.text));
    if (assessments.some((assessment) => assessment.level === "blocked")) {
      this.#warn("source-too-large");
      return false;
    }
    if (assessments.some((assessment) => assessment.level === "warning")) {
      const choice = await vscode.window.showWarningMessage(
        "Quick Diff is about to keep text larger than 2 MiB in memory for this comparison.",
        { modal: true },
        action,
      );
      return choice === action;
    }
    return true;
  }

  #openTextDocuments(): vscode.TextDocument[] {
    const uriStrings = new Set<string>();
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputText) uriStrings.add(tab.input.uri.toString());
        else if (tab.input instanceof vscode.TabInputTextDiff) {
          uriStrings.add(tab.input.original.toString());
          uriStrings.add(tab.input.modified.toString());
        }
      }
    }
    return vscode.workspace.textDocuments.filter(
      (document) => !document.isClosed
        && document.uri.scheme !== QUICK_DIFF_SCHEME
        && uriStrings.has(document.uri.toString()),
    );
  }

  #labelsForDocuments(documents: readonly vscode.TextDocument[]): readonly DocumentLabel[] {
    const inputs: DocumentLabelInput[] = documents.map((document) => {
      const folder = vscode.workspace.getWorkspaceFolder(document.uri);
      return {
        key: document.uri.toString(),
        basename: this.#basename(document.uri),
        workspaceRelative: folder ? vscode.workspace.asRelativePath(document.uri, true) : undefined,
        scheme: document.uri.scheme,
      };
    });
    return buildDocumentLabels(inputs);
  }

  #basename(uri: vscode.Uri): string {
    const segments = uri.path.split("/").filter(Boolean);
    return segments.at(-1) || (uri.scheme === "untitled" ? "Untitled" : `${uri.scheme} document`);
  }

  #trackOpenDocument(document: vscode.TextDocument): void {
    const id = this.#provider.snapshotId(document.uri);
    const key = document.uri.toString();
    if (!id || this.#openSnapshotIds.has(key)) return;
    if (this.#store.retain(id)) this.#openSnapshotIds.set(key, id);
    this.#scheduleCleanup();
  }

  #trackClosedDocument(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const id = this.#openSnapshotIds.get(key);
    if (!id) return;
    this.#openSnapshotIds.delete(key);
    this.#store.release(id);
    this.#scheduleCleanup();
  }

  #scheduleCleanup(): void {
    if (this.#cleanupTimer) clearTimeout(this.#cleanupTimer);
    this.#cleanupTimer = undefined;
    const next = this.#store.nextExpiryAt();
    if (next === undefined || this.#disposed) return;
    const delay = Math.max(0, Math.min(0x7fff_ffff, next - Date.now()));
    this.#cleanupTimer = setTimeout(() => {
      this.#cleanupTimer = undefined;
      this.#store.prune();
      this.#scheduleCleanup();
    }, delay);
  }

  #warn(reason: QuickDiffRejection): void {
    const messages: Record<QuickDiffRejection, string> = {
      "no-editor": "Open a text editor before running Quick Diff.",
      "empty-selection": "Select text before running this Quick Diff command.",
      "invalid-selection": "Quick Diff could not read the current selections safely.",
      "empty-clipboard": "Copy text to the clipboard before running this command.",
      "missing-left": "Use Selection as Left Side before comparing with the left side.",
      "source-too-large": "Quick Diff supports text sources up to 16 MiB.",
      "snapshot-capacity": "Close an existing Quick Diff editor before starting another comparison.",
      "not-enough-open-documents": "Open at least two text documents before comparing open files.",
      "invalid-command-arguments": "Quick Diff commands do not accept arguments.",
      "operation-failed": "Quick Diff could not open this comparison.",
    };
    void vscode.window.showWarningMessage(messages[reason]);
  }
}
