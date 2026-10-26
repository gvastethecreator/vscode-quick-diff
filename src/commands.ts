export const COMMANDS = {
  compareSelectionWithClipboard: "quickDiff.compareSelectionWithClipboard",
  useSelectionAsLeft: "quickDiff.useSelectionAsLeft",
  compareSelectionWithLeft: "quickDiff.compareSelectionWithLeft",
  compareFileWithClipboard: "quickDiff.compareFileWithClipboard",
  compareOpenFiles: "quickDiff.compareOpenFiles",
  compareVisibleEditors: "quickDiff.compareVisibleEditors",
  inspectLeft: "quickDiff.inspectLeft",
  clearLeft: "quickDiff.clearLeft",
  swapSides: "quickDiff.swapSides",
  toggleTemporary: "quickDiff.toggleTemporary",
  closeTemporary: "quickDiff.closeTemporary",
} as const;

export type QuickDiffCommand = keyof typeof COMMANDS;

export const COMMAND_ACTIONS: Readonly<Record<(typeof COMMANDS)[QuickDiffCommand], QuickDiffCommand>> = {
  [COMMANDS.compareSelectionWithClipboard]: "compareSelectionWithClipboard",
  [COMMANDS.useSelectionAsLeft]: "useSelectionAsLeft",
  [COMMANDS.compareSelectionWithLeft]: "compareSelectionWithLeft",
  [COMMANDS.compareFileWithClipboard]: "compareFileWithClipboard",
  [COMMANDS.compareOpenFiles]: "compareOpenFiles",
  [COMMANDS.compareVisibleEditors]: "compareVisibleEditors",
  [COMMANDS.inspectLeft]: "inspectLeft",
  [COMMANDS.clearLeft]: "clearLeft",
  [COMMANDS.swapSides]: "swapSides",
  [COMMANDS.toggleTemporary]: "toggleTemporary",
  [COMMANDS.closeTemporary]: "closeTemporary",
};
