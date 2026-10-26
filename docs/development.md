# Development

Quick Diff uses pnpm and TypeScript. Do not switch package managers.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm install --frozen-lockfile` | Install the locked dependency graph. |
| `pnpm test` | Run focused core unit tests. |
| `pnpm run check-types` | Type-check without emitting files. |
| `pnpm run compile` | Build Node and browser development bundles. |
| `pnpm run package` | Build minified production bundles. |
| `pnpm run test:performance` | Check selection, size, store, and bundle budgets. |
| `pnpm run test:integration` | Exercise the development extension in desktop VS Code. Build first. |
| `pnpm run test:web` | Exercise the browser bundle in a writable virtual workspace. Build first. |
| `pnpm run render:media` | Downsample the accepted Imagegen raster icon. |
| `pnpm run check:media` | Verify deterministic icon output, dimensions, and native alpha. |
| `pnpm run quality` | Run unit, type, dual-bundle, performance, and media gates. |
| `pnpm run vsix` | Build `quick-diff.vsix`. |
| `pnpm run inspect:vsix` | Inspect contents, manifests, bundles, limits, and PNG alpha. |
| `pnpm run test:vsix` | Install and exercise the VSIX in a clean temporary profile. |

## Runtime design

`src/core/` contains VS Code-independent selection, size, label, URI, and snapshot-store logic. `QuickDiffController` owns commands and lifecycle. `QuickDiffContentProvider` exposes immutable `quickdiff:/snapshot/<id>` documents to the native `vscode.diff` command.

The extension produces `dist/node/extension.cjs` and `dist/web/extension.cjs`. It does not use Node-only runtime APIs, persistence, network APIs, or temporary files.

## Manual development

Run `pnpm run compile`, then press F5 with **Run Extension**. The launch configuration opens `test-workspace/` in an Extension Development Host.

See [compatibility.md](compatibility.md), [media.md](media.md), [security-review.md](security-review.md), and [publishing.md](publishing.md) for release evidence and gates.
