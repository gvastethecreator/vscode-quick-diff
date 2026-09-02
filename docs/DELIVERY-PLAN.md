# Quick Diff — Complete delivery plan

Status: execution specification  
Repository: `gvastethecreator/vscode-quick-diff`  
Product phase: scaffold  
Target release: `0.1.0`  
Last reviewed: 2026-09-01

This document converts `docs/PDR.md` into an implementation-ready plan. It is the source of truth for the work still required before Quick Diff can be released. Product intent remains in the PDR; this file owns execution order, technical contracts, verification, and launch gates.

---

## 1. Current state

The repository currently provides a consistent extension scaffold:

- TypeScript source and strict type checking;
- esbuild bundle targeting the Node extension host;
- VS Code command declarations;
- CI for install, unit test, type check, and compilation;
- Marketplace icon and preview placeholders;
- PDR, development notes, publishing notes, and agent instructions.

The extension is not implemented yet:

- every contributed command is registered by a shared placeholder handler;
- every command reports `This command is not implemented yet.`;
- the only unit test proves the Node test runner works;
- no virtual document provider exists;
- no captured-left state exists;
- no native diff flow exists;
- no VS Code Extension Host integration tests exist;
- no browser bundle exists despite the PDR's web-compatibility goal;
- no packaged VSIX has been installed and smoke-tested.

The current manifest also declares `"type": "module"` while esbuild emits a CommonJS `dist/extension.js`. The runtime format and manifest must be made unambiguous before feature work.

---

## 2. Release outcome

Quick Diff `0.1.0` must let a user compare short-lived text sources without creating temporary files or leaving sensitive text behind.

The release is successful when all of these flows work through VS Code's native diff editor:

1. current selection versus clipboard;
2. current selection captured as the left side, followed by another selection as the right side;
3. current file buffer versus clipboard;
4. one open text document versus another open text document;
5. the same flows in the browser extension host where the underlying VS Code APIs are available.

The extension must remain command-driven and nearly invisible when idle.

---

## 3. Product contract

### 3.1 Commands in `0.1.0`

| Command | Required behavior |
| --- | --- |
| `Quick Diff: Compare Selection with Clipboard` | Compare the exact active selection with current clipboard text. |
| `Quick Diff: Use Selection as Left Side` | Store an immutable in-memory snapshot and show brief non-modal confirmation. |
| `Quick Diff: Compare Selection with Left Side` | Compare current selection against the last left snapshot. |
| `Quick Diff: Compare File with Clipboard` | Compare the complete current in-memory document buffer with clipboard text. |
| `Quick Diff: Compare Open Files...` | Pick two eligible open text documents and compare their current buffers. |

`Compare Current Buffer with Saved File` is post-`0.1.0` unless it can be delivered without weakening the launch date or compatibility work.

### 3.2 Selection semantics

- An empty selection is rejected by default. Do not silently substitute the current line.
- Multiple non-empty selections are joined in document order with the document's existing EOL sequence.
- Overlapping selections are normalized so content is never duplicated unexpectedly.
- A command creates one undo-neutral comparison operation; it does not edit the source document.
- Selection snapshots capture text at invocation time. Later source edits do not mutate an already captured snapshot.

### 3.3 Clipboard semantics

- Use `vscode.env.clipboard.readText()` only.
- Empty clipboard text must produce concise feedback and no diff editor.
- Binary clipboard content is outside scope.
- Clipboard contents are never logged, persisted, hashed for telemetry, or sent over the network.

### 3.4 Virtual document semantics

Ephemeral text must be represented by a custom URI scheme and `TextDocumentContentProvider`.

Required properties:

- unique, collision-resistant document identifiers;
- no source content embedded in the URI;
- stable content while a diff editor references the URI;
- a bounded in-memory store;
- explicit cleanup on replacement, expiry, and extension deactivation;
- language ID propagation where VS Code can apply it safely;
- readable labels without exposing absolute paths unnecessarily.

No temp-file fallback is allowed for text-only comparisons in `0.1.0`.

### 3.5 Diff titles

Titles should describe sources without leaking more information than the user already sees:

```text
Selection: editor.ts ↔ Clipboard
Left Selection: README.md ↔ Selection: notes.md
app.ts ↔ config.ts
```

For duplicate basenames, add a compact workspace-relative disambiguator. Do not use full absolute paths by default.

### 3.6 Limits

Default safeguards:

- warn at 2 MiB per ephemeral source;
- hard-stop at 16 MiB per ephemeral source unless the implementation proves a safer upper bound;
- keep no more than 16 snapshots in memory;
- expire unreferenced snapshots after 30 minutes;
- never silently truncate text.

Limits must be constants with tests. A future setting may expose the warning threshold, but `0.1.0` should avoid configuration unless user testing demonstrates a need.

---

## 4. Explicit non-goals

- custom diff rendering or algorithm;
- binary or image diff;
- Git client features;
- patch generation or application;
- three-way merge;
- persistent snippet history;
- cloud synchronization;
- automatic workspace scanning;
- automatic clipboard watching;
- AI summaries of differences;
- temporary files for normal text comparisons.

---

## 5. Architecture

Recommended layout:

```text
src/
├─ extension.ts
├─ commands/
│  ├─ captureLeft.ts
│  ├─ compareSelectionClipboard.ts
│  ├─ compareSelectionLeft.ts
│  ├─ compareFileClipboard.ts
│  └─ compareOpenFiles.ts
├─ core/
│  ├─ snapshot.ts
│  ├─ snapshotStore.ts
│  ├─ selection.ts
│  ├─ labels.ts
│  └─ limits.ts
├─ virtual/
│  ├─ uri.ts
│  └─ provider.ts
└─ platform/
   ├─ clipboard.ts
   ├─ documents.ts
   └─ openDiff.ts
```

### 5.1 Pure core

The following code must not import `vscode`:

- selection ordering and overlap normalization;
- source label generation inputs;
- byte/character limit decisions;
- snapshot store eviction policy;
- ID-safe URI payload creation;
- state transition rules.

### 5.2 Platform boundary

VS Code-specific modules own:

- active editor validation;
- reading clipboard text;
- creating `Uri` values;
- registering `TextDocumentContentProvider`;
- opening `vscode.diff`;
- Quick Pick UX;
- lifecycle disposal.

### 5.3 State model

A snapshot contains:

```ts
interface TextSnapshot {
  id: string;
  text: string;
  label: string;
  languageId?: string;
  createdAt: number;
  sourceKind: "selection" | "clipboard" | "document";
}
```

The store is window-local and memory-only. `ExtensionContext.globalState`, `workspaceState`, local storage, temp directories, and logs must never contain snapshot text.

---

## 6. Manifest and runtime requirements

### 6.1 Build formats

Choose and document one of these valid arrangements:

- Node entry: `dist/node/extension.cjs`, esbuild `format: "cjs"`;
- browser entry: `dist/web/extension.js`, esbuild browser/webworker bundle.

Do not declare an ESM package while shipping a CommonJS `.js` entry.

### 6.2 Web support

Quick Diff should support a browser entry because its required APIs are browser-safe. The browser bundle must:

- avoid Node globals and modules;
- be emitted as one browser-compatible file;
- expose the same user commands;
- use `vscode.env.clipboard` and virtual documents;
- pass `@vscode/test-web` tests;
- be manually sideloaded into `vscode.dev` before release.

### 6.3 Activation

Command contributions can activate the extension automatically on supported VS Code versions. If the minimum supported VS Code version is moved below 1.74, explicit `onCommand:` activation events must be added.

### 6.4 Capabilities

Expected final declaration, subject to tests:

- `virtualWorkspaces.supported: true`;
- `untrustedWorkspaces.supported: true`;
- no workspace code execution;
- no filesystem write requirement.

Derive the real minimum `engines.vscode` from APIs used, then test both that version and current stable. Do not retain `^1.134.0` merely because it was the scaffold default.

---

## 7. UX and accessibility

- Use Command Palette, scoped editor context menus, and Quick Pick only.
- Do not add a persistent Status Bar item.
- Do not open a webview.
- Successful comparisons should not display notifications.
- `Use Selection as Left Side` may use `window.setStatusBarMessage` with a short timeout.
- Errors must explain the corrective action: select text, copy text, open another file, or reduce input size.
- Quick Picks need meaningful labels, descriptions, and detail for duplicate filenames.
- Commands must remain usable entirely from the keyboard.
- Context menu entries should only appear when an editor and relevant selection state exist.

---

## 8. Security and privacy requirements

- zero telemetry in `0.1.0`;
- no network requests;
- no persistence of compared text;
- no logging of clipboard, selection, document content, or full absolute paths;
- no content in command arguments that can leak through command history;
- no temp files;
- snapshot IDs generated independently of content;
- dispose all providers and state through `context.subscriptions` or explicit deactivation;
- Marketplace README must state that comparison content remains in memory only.

Threat cases to test:

- secrets in clipboard;
- secrets in selection;
- very large hostile input;
- crafted URI-like labels;
- duplicate filenames;
- extension deactivation with open diff editors;
- malformed command arguments from another extension.

---

## 9. Performance budget

- activation under 50 ms on a typical desktop after bundle load;
- no work before a command is invoked beyond command/provider registration;
- no workspace scans or file watchers;
- normal comparison command preparation under 30 ms for sources below 1 MiB, excluding VS Code rendering;
- bounded memory with deterministic eviction;
- provider lookup O(1) by snapshot ID;
- no repeated text copies beyond those required to snapshot source content.

Record measured activation and command-preparation timings before release.

---

## 10. Test matrix

### 10.1 Unit tests

- empty, one, and multiple selections;
- out-of-order selections;
- overlapping and adjacent selections;
- CRLF and LF joining;
- snapshot replacement and expiry;
- bounded-store eviction;
- label disambiguation;
- URI IDs contain no source content;
- warning and hard-limit boundaries;
- Unicode, emoji, null characters, and very long lines;
- no accidental mutation of captured values.

### 10.2 Desktop Extension Host tests

- extension activates through every command;
- provider returns exact text;
- `vscode.diff` receives expected URIs and title;
- selection-versus-clipboard flow;
- left-capture flow;
- full dirty buffer versus clipboard;
- untitled document;
- two open files with equal basenames;
- multi-root workspace;
- empty clipboard and empty selection errors;
- deactivation cleanup;
- Restricted Mode;
- non-file document URI.

### 10.3 Web tests

- browser bundle loads in web extension host;
- core command flows pass under `@vscode/test-web`;
- no Node module is bundled accidentally;
- virtual-workspace URI behavior;
- manual `vscode.dev` sideload smoke test.

### 10.4 Package tests

- production bundle compiles;
- `vsce package --no-dependencies` succeeds;
- VSIX contents contain only required runtime files, icon, README, CHANGELOG, LICENSE, and manifest;
- packaged extension installs in a clean profile;
- all five commands are visible and activate the packaged extension;
- uninstall leaves no persisted comparison content.

---

## 11. Ordered ticket backlog

Ticket bodies should be copied into GitHub Issues when implementation begins. Keep these IDs in issue titles and PR descriptions.

### Foundation

#### QDF-001 — Align module format and artifact layout
Priority: P0  
Depends on: none

Deliver:

- explicit Node and browser output paths;
- remove the current ESM/CommonJS ambiguity;
- update `package.json`, esbuild config, launch tasks, and `.vscodeignore`;
- add a build test that imports/activates the packaged Node entry.

Acceptance evidence:

- `pnpm run package` succeeds;
- Node Extension Host activates the built artifact;
- manifest entry files exist in the VSIX.

#### QDF-002 — Establish desktop and web test harnesses
Priority: P0  
Depends on: QDF-001

Deliver:

- unit test command;
- `@vscode/test-electron` integration runner;
- `@vscode/test-web` runner;
- fixture workspace;
- CI jobs with caches and timeouts.

Acceptance evidence:

- one activation test passes in both compatible hosts;
- CI fails when the extension entry cannot activate.

#### QDF-003 — Define core source and snapshot types
Priority: P0  
Depends on: QDF-001

Deliver immutable source/snapshot models, source kinds, labels, language IDs, timestamps, and validation helpers without `vscode` imports.

Acceptance evidence: exhaustive type tests and unit fixtures.

#### QDF-004 — Implement bounded in-memory snapshot store
Priority: P0  
Depends on: QDF-003

Deliver create/get/release/replace/expire/clear operations, maximum entry count, deterministic eviction, and injectable clock/ID generation for tests.

Acceptance evidence: no persistence APIs used; lifecycle and eviction tests pass.

### Virtual documents and diff integration

#### QDF-005 — Implement safe virtual URI codec
Priority: P0  
Depends on: QDF-003

Deliver a `quickdiff:` URI format containing IDs and safe metadata only, never comparison text.

Acceptance evidence: secrets in input never appear in generated URIs.

#### QDF-006 — Implement `TextDocumentContentProvider`
Priority: P0  
Depends on: QDF-004, QDF-005

Deliver provider registration, exact content lookup, missing-snapshot behavior, and cleanup.

Acceptance evidence: Extension Host test reads exact Unicode/CRLF content from virtual documents.

#### QDF-007 — Implement native diff launcher
Priority: P0  
Depends on: QDF-006

Deliver a single platform function that opens `vscode.diff`, applies source labels, and propagates language mode where possible.

Acceptance evidence: all commands call this abstraction; no temp file code exists.

### User flows

#### QDF-008 — Normalize editor selections
Priority: P0  
Depends on: QDF-003

Deliver validation, ordering, overlap handling, multi-selection joining, and source metadata.

Acceptance evidence: unit matrix covers empty, adjacent, overlapping, reversed, CRLF, and multi-cursor cases.

#### QDF-009 — Implement capture-left command
Priority: P0  
Depends on: QDF-004, QDF-008

Deliver immutable left snapshot replacement and brief status feedback.

Acceptance evidence: changing the source afterward does not change captured text.

#### QDF-010 — Implement selection-versus-left command
Priority: P0  
Depends on: QDF-007, QDF-009

Deliver missing-left and empty-selection UX plus native diff launch.

Acceptance evidence: full integration test and one-step command flow.

#### QDF-011 — Implement selection-versus-clipboard command
Priority: P0  
Depends on: QDF-007, QDF-008

Deliver clipboard read, empty clipboard validation, snapshots, and diff.

Acceptance evidence: clipboard content remains memory-only and exact.

#### QDF-012 — Implement file-buffer-versus-clipboard command
Priority: P0  
Depends on: QDF-007

Deliver comparison using the current in-memory buffer, including unsaved edits and untitled documents.

Acceptance evidence: dirty-buffer test proves disk content is not substituted.

#### QDF-013 — Implement open-files picker and comparison
Priority: P0  
Depends on: QDF-007

Deliver eligible-document filtering, two-stage or multi-select Quick Pick, duplicate-name disambiguation, and cancellation.

Acceptance evidence: two same-name documents in different folders can be selected unambiguously.

### Safety and UX

#### QDF-014 — Add source-size safeguards
Priority: P0  
Depends on: QDF-004

Deliver warning/hard limits, explicit continue path below hard limit, and no silent truncation.

Acceptance evidence: boundary and cancellation tests.

#### QDF-015 — Add command/menu contexts and optional keybinding decision
Priority: P1  
Depends on: QDF-009 through QDF-013

Deliver contextual editor menu entries and document the decision on default keybindings. Avoid collisions and hide irrelevant commands.

Acceptance evidence: manifest-context integration tests/manual keyboard QA.

#### QDF-016 — Complete privacy and security review
Priority: P0  
Depends on: QDF-004 through QDF-014

Audit logging, persistence, URI construction, error messages, command arguments, and deactivation.

Acceptance evidence: security checklist committed; grep/audit finds no content logging or filesystem writes.

### Compatibility, packaging, and release

#### QDF-017 — Ship browser bundle and web verification
Priority: P0  
Depends on: QDF-002, QDF-006 through QDF-014

Deliver `browser` entry, browser-safe bundle, web tests, and manual `vscode.dev` result.

Acceptance evidence: web test suite green and support matrix updated.

#### QDF-018 — Derive minimum VS Code version and capabilities
Priority: P0  
Depends on: QDF-017

Deliver tested `engines.vscode`, `capabilities`, and any `extensionKind` decision.

Acceptance evidence: tests pass on minimum supported and current stable versions.

#### QDF-019 — Replace placeholder documentation and media
Priority: P1  
Depends on: all user flows

Deliver real README usage examples, commands, privacy section, limitations, troubleshooting, screenshots/GIF, final icon, and updated CHANGELOG.

Acceptance evidence: all screenshots come from the packaged extension; no scaffold instructions remain in user-facing sections.

#### QDF-020 — Harden CI and inspect VSIX
Priority: P0  
Depends on: QDF-018, QDF-019

Deliver unit, desktop integration, web integration, production build, VSIX creation, package-content inspection, and clean-profile smoke test.

Acceptance evidence: release-candidate workflow produces an installable artifact.

#### QDF-021 — Publish `0.1.0` and verify both registries
Priority: P0  
Depends on: QDF-020

Deliver Marketplace publication, Open VSX publication if compatible, tags/release notes, and post-publication install checks.

Acceptance evidence: public listing installs successfully and every documented command works.

---

## 12. Launch gate

Do not publish `0.1.0` until every statement is true:

- all P0 tickets are closed with verification evidence;
- no placeholder handler or placeholder test remains;
- desktop and web Extension Host tests pass;
- Node and browser artifacts match their manifest entry points;
- comparison text is memory-only;
- no temp files are used;
- limits prevent accidental extension-host exhaustion;
- capabilities and minimum VS Code version are tested rather than assumed;
- the packaged VSIX is installed and exercised in a clean profile;
- README screenshots represent real behavior;
- Marketplace and Open VSX names are rechecked immediately before publication.

---

## 13. Post-`0.1.0` candidates

Evaluate only after real usage:

- compare buffer with saved version;
- named left/right slots;
- public command API for other extensions;
- ignore-whitespace convenience action if native options are insufficient;
- recent in-memory comparisons for the current window only;
- richer source labels;
- configurable warning threshold.

Do not add persistence, history, custom diff rendering, or Git features without a separate PDR revision.

---

## 14. Primary references

- https://code.visualstudio.com/api
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/references/activation-events
- https://code.visualstudio.com/api/references/vscode-api#TextDocumentContentProvider
- https://code.visualstudio.com/api/extension-guides/virtual-documents
- https://code.visualstudio.com/api/extension-guides/web-extensions
- https://code.visualstudio.com/api/extension-guides/virtual-workspaces
- https://code.visualstudio.com/api/extension-guides/workspace-trust
- https://code.visualstudio.com/api/advanced-topics/extension-host
- https://code.visualstudio.com/api/working-with-extensions/testing-extension
- https://code.visualstudio.com/api/working-with-extensions/bundling-extension
- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://github.com/microsoft/vscode-extension-samples
- https://github.com/microsoft/vscode-test-web
