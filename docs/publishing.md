# Publishing Quick Diff

Extension id: `gvastethecreator.quick-diff`.

Publication is a separate, explicitly authorized step. Building or validating a release candidate does not authorize Marketplace/Open VSX publication, tags, releases, or branch deletion.

## Release candidate gate

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm run quality`.
3. Run desktop integration on VS Code 1.134 and current stable.
4. Run `pnpm run test:web`.
5. Run `pnpm run vsix` and `pnpm run inspect:vsix`.
6. Run `pnpm run test:vsix` against the final bytes.
7. Confirm `docs/PDR.md` matches the portfolio PDR byte-for-byte.
8. Review the real runtime preview, icon alpha, changelog, license, and security notes.

The `Release candidate` workflow builds and uploads an artifact only. It does not publish anything.

## Human publication gate

After explicit approval, publish the exact reviewed VSIX to the Visual Studio Marketplace and Open VSX, create the matching tag/release, then install each public listing and exercise all five commands. Record listing URLs and artifact hashes. Until then, QDF-021 remains open.
