# Implementation evidence — 0.1.0

Local release-candidate verification completed on Windows on 2026-09-02.

| Gate | Result |
| --- | --- |
| `pnpm run quality` | Pass: 20 unit tests, strict types, Node/browser bundles, performance, media alpha. |
| `pnpm run test:integration` on VS Code 1.136.0 | Pass: lazy activation and every desktop flow. |
| `VSCODE_TEST_VERSION=1.134.0 pnpm run test:integration` | Pass: same suite on the declared minimum. |
| `pnpm run test:web` | Pass: browser bundle and immutable virtual-workspace comparison. |
| `pnpm run vsix` | Pass: 11-file, 123,047-byte release candidate. |
| `pnpm run inspect:vsix` | Pass: allowlist, manifests, bundles, limits, no forbidden runtime surfaces, native PNG alpha. |
| `pnpm run test:vsix` | Pass: final VSIX installed and exercised in a clean temporary profile. |
| `pnpm audit --prod` | No known vulnerabilities. |
| `pnpm audit --audit-level high` | No known vulnerabilities in the complete locked graph. |
| Product/portfolio PDR | Byte-identical SHA-256 `C53D4982F341EC657ED2B0E8C909FB29BD68EAA88EBEC26060FC8753D0FBA1C0`. |

## Frozen artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| `quick-diff.vsix` | `A37C294D9F27BDFD8B0CA2554E1C7A51064599D4B46A971117576D4D44539B4F` |
| `media/icon.png` | `423F0C980467F18D6C8FD21B3431556E0FA8C6F9DACC6EF98F37811B761F3E2F` |
| `media/preview.png` | `A6478F73F62C05C8BAFA88EF740514D4EAD465EA46355A30BAA226D0612448FB` |
| `dist/node/extension.cjs` | `F217AAAA3C9DCEC0F56727E927D0BB87CEF0F0D56E5B9E9B60015398B6D22BCD` |
| `dist/web/extension.cjs` | `C52F96C0A9ECEF94FEE776E347F9BF68782E7D8B2C4A0EC878698CDC1237E038` |

Hosted Linux, macOS, Windows, and Insiders evidence remains pending until the PR branch is pushed. QDF-021 publication remains separately gated.
