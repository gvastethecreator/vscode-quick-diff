import * as vscode from "vscode";
import { QuickDiffController } from "./editor.ts";

let controller: QuickDiffController | undefined;

export function activate(context: vscode.ExtensionContext): void {
  controller = new QuickDiffController(context);
}

export function deactivate(): void {
  controller?.dispose();
  controller = undefined;
}
