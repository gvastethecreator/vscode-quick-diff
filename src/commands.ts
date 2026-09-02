export const COMMANDS = {
  compareSelectionWithClipboard: "quickDiff.compareSelectionWithClipboard",
  useSelectionAsLeft: "quickDiff.useSelectionAsLeft",
  compareSelectionWithLeft: "quickDiff.compareSelectionWithLeft",
  compareFileWithClipboard: "quickDiff.compareFileWithClipboard",
  compareOpenFiles: "quickDiff.compareOpenFiles",
} as const;

export type QuickDiffCommand = keyof typeof COMMANDS;

export const COMMAND_ACTIONS: Readonly<Record<(typeof COMMANDS)[QuickDiffCommand], QuickDiffCommand>> = {
  [COMMANDS.compareSelectionWithClipboard]: "compareSelectionWithClipboard",
  [COMMANDS.useSelectionAsLeft]: "useSelectionAsLeft",
  [COMMANDS.compareSelectionWithLeft]: "compareSelectionWithLeft",
  [COMMANDS.compareFileWithClipboard]: "compareFileWithClipboard",
  [COMMANDS.compareOpenFiles]: "compareOpenFiles",
};
