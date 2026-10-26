import * as vscode from "vscode";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("gvastethecreator.quick-diff");
  assert(extension, "Quick Diff was not discovered in the web host.");
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert(folder, "The virtual test workspace did not open.");
  assert(folder.uri.scheme === "vscode-test-web", "The web test is not using a virtual filesystem.");

  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "fixture.ts"));
  const editor = await vscode.window.showTextDocument(document, { preview: false });
  const original = "hello from Quick Diff";
  const start = document.getText().indexOf(original);
  assert(start >= 0, "Web fixture text is missing.");
  editor.selection = new vscode.Selection(document.positionAt(start), document.positionAt(start + original.length));
  await vscode.commands.executeCommand("quickDiff.useSelectionAsLeft");
  assert(extension.isActive, "Use Selection as Left Side did not activate Quick Diff in the web host.");

  await editor.edit((builder) => builder.replace(editor.selection, "hello from the web host"));
  const changed = "hello from the web host";
  const changedStart = document.getText().indexOf(changed);
  editor.selection = new vscode.Selection(
    document.positionAt(changedStart),
    document.positionAt(changedStart + changed.length),
  );
  await vscode.commands.executeCommand("quickDiff.compareSelectionWithLeft");

  const virtual = vscode.workspace.textDocuments.filter((item) => item.uri.scheme === "quickdiff");
  assert(virtual.some((item) => item.getText() === original), "Web diff lost the immutable left snapshot.");
  assert(virtual.some((item) => item.getText() === changed), "Web diff lost the right snapshot.");
  assert(virtual.every((item) => !item.uri.toString().includes("hello")), "Web virtual URI leaked source text.");
}
