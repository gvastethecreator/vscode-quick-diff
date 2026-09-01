Repo: `X:\vscode-extensions\quick-diff`
Remote: private (`gvastethecreator/quick-diff`)

# PDR — Quick Diff

## Status
Scaffolded · Priority P1

## Product summary

Quick Diff provides frictionless comparisons between selections, clipboard text, open files and saved content using VS Code's native diff editor. It should be a command-driven utility, not a custom diff renderer.

## Opportunity

The diff utility category is fragmented across file comparison, partial diff and clipboard comparison extensions. VS Code already has an excellent diff editor; the product value is reducing setup friction and making common compare sources composable.

Category references:
- https://marketplace.visualstudio.com/search?term=partial%20diff&target=VSCode&category=All%20categories&sortBy=Relevance
- VS Code virtual documents: https://code.visualstudio.com/api/references/vscode-api#TextDocumentContentProvider

## Core jobs

- compare current selection with clipboard;
- capture one selection as Left and compare it with another selection;
- compare two open files quickly;
- compare current file with clipboard;
- compare current unsaved buffer with on-disk version where available.

## MVP commands

- `Quick Diff: Compare Selection with Clipboard`
- `Quick Diff: Use Selection as Left Side`
- `Quick Diff: Compare Selection with Left Side`
- `Quick Diff: Compare File with Clipboard`
- `Quick Diff: Compare Open Files...`

Post-MVP candidate:
- `Quick Diff: Compare Current Buffer with Saved File`

## Architecture

Use VS Code's built-in `vscode.diff` command. Ephemeral text sources should be represented through a custom URI scheme + `TextDocumentContentProvider` rather than temporary files wherever practical.

Example conceptual flow:

```text
selection A -> quickdiff:left/<id>  ┐
                                    ├-> vscode.diff(leftUri, rightUri)
clipboard   -> quickdiff:right/<id> ┘
```

This keeps the extension small and uses the native editor for syntax highlighting, navigation and diff presentation.

## State model

A captured selection should store:

- text;
- source label;
- language ID when useful for virtual-document highlighting;
- timestamp/session ID only in memory.

Default policy: state is window/session-local and not persisted across restarts.

## Privacy

Selections and clipboard text may contain secrets.

- never persist them to disk by default;
- never send them over network;
- never emit contents to logs;
- clear stale in-memory captures when replaced/deactivated;
- no telemetry containing compared content or filenames.

## UX

Use native primitives only:

- commands;
- editor context menu for selection commands;
- Quick Pick for choosing among open text documents;
- native diff editor.

Optional status feedback after `Use Selection as Left Side` may be a short non-modal status bar message/progress notification, not a persistent status item.

## Labels

Diff titles should clearly indicate source, for example:

```text
Selection: src/foo.ts ↔ Clipboard
Left Selection: README.md ↔ Selection: notes.md
```

Avoid leaking full absolute paths in titles unless VS Code naturally provides them and it is useful.

## Edge cases

- empty selection: decide whether current line is used or command rejects; default should reject to avoid surprise;
- huge clipboard contents;
- binary/non-text clipboard unsupported;
- untitled documents;
- dirty documents;
- documents with identical display names in different folders;
- multi-root workspaces;
- virtual/remote URIs;
- selection ending with partial line;
- mixed line endings.

## Limits

Set a generous warning threshold for extremely large ephemeral text to avoid freezing the extension host/diff UI. Warn and allow explicit continuation if needed; do not silently truncate.

## VS Code APIs

- `env.clipboard.readText`
- `workspace.registerTextDocumentContentProvider`
- `commands.executeCommand('vscode.diff', ...)`
- `window.visibleTextEditors` / `workspace.textDocuments`
- Quick Pick
- `Uri`
- editor selections.

## Compatibility

| Environment | Goal |
| --- | --- |
| Desktop | Full |
| Web | Full |
| Virtual Workspace | Full |
| Restricted Mode | Full |
| Remote | Full; clipboard behavior should follow VS Code's environment abstraction |

Because it uses VS Code APIs and virtual text documents, this should be an excellent web-compatible portfolio project.

## Testing

Unit:

- source labels;
- virtual URI generation;
- state replacement;
- size limits;
- language ID propagation.

Integration:

- provider returns exact text;
- `vscode.diff` invoked with expected URIs/title;
- clipboard command;
- dirty/untitled document handling;
- multiple same-name documents;
- web-host smoke test;
- state never writes to filesystem.

## Acceptance criteria

- no temp files for text-only diff flows;
- one command compares selection to clipboard;
- captured text is memory-only;
- native diff editor is always used;
- virtual documents display sensible language mode where possible;
- works in vscode.dev/web host;
- no idle workspace scanning or persistent state.

## Non-goals

- custom diff algorithm/rendering;
- binary/image diff;
- Git client replacement;
- patch application;
- three-way merge UI;
- persistent snippet/history manager.

## Post-MVP

- compare with saved version;
- compare two arbitrary selections using named slots;
- normalized/ignore-whitespace helper command only if native diff options cannot cover the workflow;
- API command arguments so other extensions can invoke Quick Diff programmatically.

## Definition of done

Native diff integration, virtual-document provider, privacy tests, web tests, docs, assets and release pipeline complete.
