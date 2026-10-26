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

interface TemporaryComparison {
  readonly tab: vscode.Tab;
  readonly source: vscode.TextDocument;
  readonly column: vscode.ViewColumn | undefined;
  readonly selections: readonly vscode.Selection[];
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
  #temporary: TemporaryComparison | undefined;

  constructor(context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider(QUICK_DIFF_SCHEME, this.#provider),
      vscode.workspace.onDidOpenTextDocument((document) => this.#trackOpenDocument(document)),
      vscode.workspace.onDidCloseTextDocument((document) => this.#trackClosedDocument(document)),
      vscode.window.tabGroups.onDidChangeTabs((event) => this.#trackTabs(event)),
      vscode.window.tabGroups.onDidChangeTabGroups(() => this.#updateTemporaryContext()),
    );
    for (const [id, action] of Object.entries(COMMAND_ACTIONS)) {
      context.subscriptions.push(
        vscode.commands.registerCommand(id, (...args: unknown[]) => this.run(action, args)),
      );
    }
    context.subscriptions.push(this);
    this.#updateTemporaryContext();
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
    this.#temporary = undefined;
    this.#updateTemporaryContext();
    this.#store.clear();
  }

  async #execute(command: QuickDiffCommand, args: readonly unknown[]): Promise<void> {
    if (this.#disposed) return;
    // The editor context menu passes the resource Uri; it carries nothing the command needs.
    if (args.length > 1 || (args.length === 1 && !(args[0] instanceof vscode.Uri))) {
      this.#warn("invalid-command-arguments");
      return;
    }
    try {
      if (command === "compareSelectionWithClipboard") await this.#compareSelectionWithClipboard();
      else if (command === "useSelectionAsLeft") await this.#captureLeft();
      else if (command === "compareSelectionWithLeft") await this.#compareSelectionWithLeft();
      else if (command === "compareFileWithClipboard") await this.#compareFileWithClipboard();
      else if (command === "compareOpenFiles") await this.#compareOpenFiles();
      else if (command === "compareVisibleEditors") await this.#compareVisibleEditors(false);
      else if (command === "toggleTemporary") {
        if (this.#temporary) await this.#closeTemporary();
        else await this.#compareVisibleEditors(true);
      }
      else if (command === "closeTemporary") await this.#closeTemporary();
      else if (command === "swapSides") await this.#swapSides();
      else if (command === "clearLeft") this.#clearLeft();
      else if (command === "inspectLeft") await this.#inspectLeft();
    } catch {
      this.#warn("operation-failed");
    }
  }

  #clearLeft(): void {
    if (this.#leftSnapshotId) this.#store.remove(this.#leftSnapshotId);
    this.#leftSnapshotId = undefined;
    this.#scheduleCleanup();
    this.#statusMessage?.dispose();
    this.#statusMessage = vscode.window.setStatusBarMessage("Quick Diff: Left capture cleared.", 2_000);
  }

  async #inspectLeft(): Promise<void> {
    const snapshot = this.#leftSnapshotId ? this.#store.get(this.#leftSnapshotId) : undefined;
    if (!snapshot) { this.#warn("missing-left"); return; }
    const size = new TextEncoder().encode(snapshot.text).byteLength;
    const choice = await vscode.window.showInformationMessage(
      `${snapshot.label} · ${size.toLocaleString()} UTF-8 bytes · Captured ${new Date(snapshot.createdAt).toLocaleString()}`,
      "Clear Capture",
    );
    if (choice === "Clear Capture") this.#clearLeft();
  }

  #visibleEditors(): vscode.TextEditor[] {
    const result: vscode.TextEditor[] = [];
    const keys = new Set<string>();
    for (const editor of [...vscode.window.visibleTextEditors].sort((left, right) => (left.viewColumn ?? 0) - (right.viewColumn ?? 0))) {
      const key = editor.document.uri.toString();
      const tab = vscode.window.tabGroups.all.find((group) => group.viewColumn === editor.viewColumn)?.activeTab;
      if (!editor.document.isClosed && editor.document.uri.scheme !== QUICK_DIFF_SCHEME &&
        tab?.input instanceof vscode.TabInputText && tab.input.uri.toString() === key && !keys.has(key)) {
        keys.add(key);
        result.push(editor);
      }
    }
    return result;
  }

  async #compareVisibleEditors(temporary: boolean): Promise<void> {
    const source = vscode.window.activeTextEditor;
    const editors = this.#visibleEditors();
    if (editors.length < 2 || !source) {
      void vscode.window.showInformationMessage("Show two different text documents in separate editor groups first.");
      return;
    }
    let selected = editors;
    if (editors.length > 2) {
      const labels = this.#labelsForDocuments(editors.map((editor) => editor.document));
      const picked = await vscode.window.showQuickPick(editors.map((editor, index) => ({ label: labels[index].label, description: `Column ${editor.viewColumn}`, editor })), {
        canPickMany: true, title: "Compare Visible Editors", placeHolder: "Select exactly two documents; columns determine left and right",
      });
      if (!picked) return;
      if (picked.length !== 2) {
        void vscode.window.showInformationMessage("Choose exactly two different visible documents.");
        return;
      }
      selected = picked.map((item) => item.editor).sort((left, right) => (left.viewColumn ?? 0) - (right.viewColumn ?? 0));
    }
    const visible = this.#visibleEditors();
    if (selected.some((editor) => !visible.includes(editor))) {
      void vscode.window.showInformationMessage("The visible editors changed. Choose them again.");
      return;
    }
    const labels = this.#labelsForDocuments(selected.map((editor) => editor.document));
    const inputs = selected.map((editor, index): SnapshotInput => ({ text: editor.document.getText(), label: labels[index].label, languageId: editor.document.languageId, sourceKind: "document" }));
    const origin = { source: source.document, column: source.viewColumn, selections: [...source.selections] };
    const tab = await this.#openComparison(inputs[0], inputs[1], temporary);
    if (temporary && tab) {
      this.#temporary = { tab, ...origin };
      this.#updateTemporaryContext();
    }
  }

  #updateTemporaryContext(): void {
    const tabs = vscode.window.tabGroups.all.flatMap((group) => group.tabs);
    if (this.#temporary && !tabs.includes(this.#temporary.tab)) this.#temporary = undefined;
    void vscode.commands.executeCommand("setContext", "quickDiff.temporaryActive", Boolean(this.#temporary && vscode.window.tabGroups.activeTabGroup.activeTab === this.#temporary.tab));
  }

  async #closeTemporary(): Promise<void> {
    const temporary = this.#temporary;
    if (!temporary) return;
    if (!vscode.window.tabGroups.all.some((group) => group.tabs.includes(temporary.tab))) {
      this.#temporary = undefined;
      this.#updateTemporaryContext();
      return;
    }
    if (!await vscode.window.tabGroups.close(temporary.tab, true)) return;
    this.#temporary = undefined;
    this.#updateTemporaryContext();
    if (!temporary.source.isClosed) {
      const editor = await vscode.window.showTextDocument(temporary.source, { viewColumn: temporary.column, preserveFocus: false });
      editor.selections = temporary.selections.map((selection) => new vscode.Selection(
        temporary.source.validatePosition(selection.anchor), temporary.source.validatePosition(selection.active),
      ));
    }
  }

  async #swapSides(): Promise<void> {
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    if (!(tab?.input instanceof vscode.TabInputTextDiff)) {
      void vscode.window.showInformationMessage("Open a Quick Diff comparison before swapping sides.");
      return;
    }
    const leftId = this.#provider.snapshotId(tab.input.original);
    const rightId = this.#provider.snapshotId(tab.input.modified);
    const left = leftId ? this.#store.get(leftId) : undefined;
    const right = rightId ? this.#store.get(rightId) : undefined;
    if (!left || !right) {
      void vscode.window.showInformationMessage("This comparison is not owned by Quick Diff.");
      return;
    }
    const temporary = this.#temporary?.tab === tab ? this.#temporary : undefined;
    const replacement = await this.#openComparison(right, left, Boolean(temporary), tab.group.viewColumn);
    if (!replacement) return;
    if (temporary) this.#temporary = { ...temporary, tab: replacement };
    await vscode.window.tabGroups.close(tab, true);
    this.#updateTemporaryContext();
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

  async #openComparison(
    left: SnapshotInput,
    right: SnapshotInput,
    temporary = false,
    viewColumn = temporary ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
  ): Promise<vscode.Tab | undefined> {
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
        { preview: false, viewColumn },
      );
      return vscode.window.tabGroups.all.flatMap((group) => group.tabs).find((tab) =>
        tab.input instanceof vscode.TabInputTextDiff && tab.input.original.toString() === leftUri.toString() && tab.input.modified.toString() === rightUri.toString());
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
    this.#retainUri(document.uri);
  }

  #retainUri(uri: vscode.Uri): void {
    const id = this.#provider.snapshotId(uri);
    const key = uri.toString();
    if (!id || this.#openSnapshotIds.has(key)) return;
    if (this.#store.retain(id)) this.#openSnapshotIds.set(key, id);
    this.#scheduleCleanup();
  }

  #trackClosedDocument(document: vscode.TextDocument): void {
    this.#releaseKey(document.uri.toString());
  }

  // onDidCloseTextDocument can lag minutes behind a closed tab, so release snapshots once no tab shows them.
  #trackTabs(event: vscode.TabChangeEvent): void {
    for (const tab of event.opened) for (const uri of tabUris(tab)) this.#retainUri(uri);
    if (event.closed.length !== 0) {
      const shown = new Set(vscode.window.tabGroups.all.flatMap((group) => group.tabs).flatMap(tabUris).map(String));
      for (const tab of event.closed) {
        for (const uri of tabUris(tab)) if (!shown.has(uri.toString())) this.#releaseKey(uri.toString());
      }
    }
    this.#updateTemporaryContext();
  }

  #releaseKey(key: string): void {
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

function tabUris(tab: vscode.Tab): vscode.Uri[] {
  if (tab.input instanceof vscode.TabInputText) return [tab.input.uri];
  if (tab.input instanceof vscode.TabInputTextDiff) return [tab.input.original, tab.input.modified];
  return [];
}
