const assert = require("node:assert/strict");
const vscode = require("vscode");

const commands = {
  selectionClipboard: "quickDiff.compareSelectionWithClipboard",
  useLeft: "quickDiff.useSelectionAsLeft",
  selectionLeft: "quickDiff.compareSelectionWithLeft",
  fileClipboard: "quickDiff.compareFileWithClipboard",
  openFiles: "quickDiff.compareOpenFiles",
};

async function openText(content, language = "typescript") {
  const document = await vscode.workspace.openTextDocument({ content, language });
  return vscode.window.showTextDocument(document, { preview: false });
}

function selection(document, needle, length = needle.length) {
  const offset = document.getText().indexOf(needle);
  assert.ok(offset >= 0, `Missing fixture text: ${needle}`);
  return new vscode.Selection(document.positionAt(offset), document.positionAt(offset + length));
}

async function activeDiff() {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  assert.ok(tab, "No active tab after Quick Diff command.");
  assert.ok(tab.input instanceof vscode.TabInputTextDiff, `Expected native diff tab, got ${tab.label}.`);
  const left = await vscode.workspace.openTextDocument(tab.input.original);
  const right = await vscode.workspace.openTextDocument(tab.input.modified);
  assert.equal(tab.input.original.scheme, "quickdiff");
  assert.equal(tab.input.modified.scheme, "quickdiff");
  return { tab, left, right };
}

async function closeAllEditors() {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await delay(100);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function run() {
  const extension = vscode.extensions.getExtension("gvastethecreator.quick-diff");
  assert.ok(extension, "Quick Diff was not discovered.");
  assert.deepEqual(extension.packageJSON.extensionKind, ["ui", "workspace"]);
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, true);
  assert.equal(extension.packageJSON.capabilities.virtualWorkspaces.supported, true);

  const source = await openText(`const value = "alpha";`);
  source.selection = selection(source.document, "alpha");
  const activationStarted = performance.now();
  await vscode.commands.executeCommand(commands.useLeft);
  const activationMs = performance.now() - activationStarted;
  assert.equal(extension.isActive, true, "Use Selection as Left Side must lazily activate Quick Diff.");
  const registered = await vscode.commands.getCommands(true);
  for (const id of Object.values(commands)) assert.ok(registered.includes(id), `${id} was not registered.`);

  await source.edit((builder) => builder.replace(selection(source.document, "alpha"), "changed"));
  source.selection = selection(source.document, "changed");
  await vscode.commands.executeCommand(commands.selectionLeft);
  let diff = await activeDiff();
  assert.equal(diff.left.getText(), "alpha", "Captured left text mutated with its source document.");
  assert.equal(diff.right.getText(), "changed");
  assert.ok(diff.tab.label.includes("Left Selection"));
  assert.equal(diff.tab.input.original.toString().includes("alpha"), false, "Virtual URI leaked source text.");
  await closeAllEditors();

  const multi = await openText("first middle third");
  multi.selections = [
    selection(multi.document, "third"),
    selection(multi.document, "first"),
  ];
  await vscode.env.clipboard.writeText("clipboard\r\n😀 text");
  await vscode.commands.executeCommand(commands.selectionClipboard);
  diff = await activeDiff();
  const documentEol = multi.document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
  assert.equal(diff.left.getText(), `first${documentEol}third`);
  assert.equal(diff.right.getText(), "clipboard\r\n😀 text");
  assert.ok(diff.tab.label.includes("Clipboard"));
  await closeAllEditors();

  const dirty = await openText("const mode = 'before';");
  await dirty.edit((builder) => builder.insert(dirty.document.positionAt(dirty.document.getText().length), "\n// unsaved"));
  const dirtyText = dirty.document.getText();
  await vscode.env.clipboard.writeText("const mode = 'after';");
  await vscode.commands.executeCommand(commands.fileClipboard);
  diff = await activeDiff();
  assert.equal(diff.left.getText(), dirtyText);
  assert.equal(diff.right.getText(), "const mode = 'after';");
  await closeAllEditors();

  const invalid = await openText("plain text", "plaintext");
  invalid.selection = new vscode.Selection(invalid.document.positionAt(0), invalid.document.positionAt(0));
  await vscode.env.clipboard.writeText("available");
  await vscode.commands.executeCommand(commands.selectionClipboard);
  assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab.input instanceof vscode.TabInputTextDiff, false);
  await vscode.env.clipboard.writeText("");
  await vscode.commands.executeCommand(commands.fileClipboard);
  assert.equal(vscode.window.tabGroups.activeTabGroup.activeTab.input instanceof vscode.TabInputTextDiff, false);
  invalid.selection = selection(invalid.document, "plain");
  await vscode.commands.executeCommand(commands.useLeft, { text: "must not be accepted" });
  await closeAllEditors();

  const scheme = `quick-diff-test-${Date.now()}`;
  const bytes = new TextEncoder().encode("virtual selection");
  const emitter = new vscode.EventEmitter();
  const provider = {
    createDirectory() {},
    delete() {},
    onDidChangeFile: emitter.event,
    readDirectory() { return []; },
    readFile() { return bytes; },
    rename() {},
    stat() { return { ctime: 0, mtime: 0, size: bytes.length, type: vscode.FileType.File }; },
    watch() { return new vscode.Disposable(() => {}); },
    writeFile() {},
  };
  const registration = vscode.workspace.registerFileSystemProvider(scheme, provider, { isCaseSensitive: true });
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(`${scheme}:/remote.ts`));
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    editor.selection = selection(document, "virtual");
    await vscode.commands.executeCommand(commands.useLeft);
    assert.equal(extension.isActive, true);
  } finally {
    registration.dispose();
    emitter.dispose();
  }
  await closeAllEditors();

  const folder = vscode.workspace.workspaceFolders[0].uri;
  const leftDocument = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder, "one", "same.ts"));
  const rightDocument = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder, "two", "same.ts"));
  await vscode.window.showTextDocument(leftDocument, { preview: false, viewColumn: vscode.ViewColumn.One });
  await vscode.window.showTextDocument(rightDocument, { preview: false, viewColumn: vscode.ViewColumn.Beside });
  const openFiles = vscode.commands.executeCommand(commands.openFiles);
  await delay(350);
  const acceptLeft = vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
  await delay(350);
  const acceptRight = vscode.commands.executeCommand("workbench.action.acceptSelectedQuickOpenItem");
  await Promise.race([
    openFiles,
    delay(5_000).then(() => { throw new Error("Open-files Quick Pick did not complete."); }),
  ]);
  await Promise.all([acceptLeft, acceptRight]);
  diff = await activeDiff();
  assert.equal(diff.left.getText(), leftDocument.getText());
  assert.equal(diff.right.getText(), rightDocument.getText());
  assert.ok(diff.tab.label.includes("one/same.ts"), diff.tab.label);
  assert.ok(diff.tab.label.includes("two/same.ts"), diff.tab.label);
  assert.equal(diff.tab.label.includes(folder.fsPath), false, "Diff title leaked the absolute workspace path.");

  console.log(`Quick Diff integration passed; first command and lazy activation took ${activationMs.toFixed(2)} ms.`);
}

module.exports = { run };
