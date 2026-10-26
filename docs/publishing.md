# Publishing Quick Diff

Extension id: `gvastethecreator.quick-diff`.

Publication is a separate, explicitly authorized step. Building or validating a release candidate does not authorize Marketplace/Open VSX publication, tags, releases, or branch deletion.

The **Release** workflow starts from **Actions → Release → Run workflow**. Default input `artifact-only` does not publish.

## Release candidate gate

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm run quality`.
3. Run desktop integration on VS Code 1.134 and current stable.
4. Run `pnpm run test:web`.
5. Run `pnpm run vsix` and `pnpm run inspect:vsix`.
6. Run `pnpm run test:vsix` against the final bytes.
7. Confirm `docs/PDR.md` matches the portfolio PDR byte-for-byte.
8. Review the real runtime preview, icon alpha, changelog, license, and security notes.

## GitHub Actions

1. Run **Release** with `artifact-only` from `main`.
2. After approval, run one of `github-release`, `vscode-marketplace`, or `open-vsx`.
3. Run one registry at a time.

Environments `github-release`, `vscode-marketplace`, and `open-vsx` accept `main` only. Do not store `VSCE_PAT` or `OVSX_PAT` until the owner asks to publish.

## Human publication gate

After explicit approval, publish the exact reviewed VSIX to the Visual Studio Marketplace and Open VSX, create the matching GitHub Release, then install each public listing and exercise all five commands. Record listing URLs and artifact hashes.

Marketplace: upload the exact verified VSIX at [Marketplace management](https://marketplace.visualstudio.com/manage).

Open VSX:

```powershell
pnpm exec ovsx publish .\quick-diff.vsix -p $env:OVSX_PAT
```

Never place a PAT in a command, an issue, a log, or a document.

## Rollback

Prefer a forward patch. Do not rewrite a public tag or replace bytes under an existing version.
