# Implementation evidence — 0.1.0

Local release-candidate verification completed on Windows on 2026-09-02.

| Gate | Result |
| --- | --- |
| `pnpm run quality` | Pass: 20 unit tests, strict types, Node/browser bundles, performance, media alpha. |
| `pnpm run test:integration` on VS Code 1.136.0 | Pass: lazy activation and every desktop flow. |
| `VSCODE_TEST_VERSION=1.134.0 pnpm run test:integration` | Pass: same suite on the declared minimum. |
| `pnpm run test:web` | Pass: browser bundle and immutable virtual-workspace comparison. |
| `pnpm run vsix` | Pass: 11-file, 105.4 KB release candidate. |
| `pnpm run inspect:vsix` | Pass: allowlist, manifests, bundles, limits, no forbidden runtime surfaces, native PNG alpha. |
| `pnpm run test:vsix` | Pass: final VSIX installed and exercised in a clean temporary profile. |
| `pnpm audit --prod` | No known vulnerabilities. |
| `pnpm audit --audit-level high` | No known vulnerabilities in the complete locked graph. |
| Product/portfolio PDR | Byte-identical SHA-256 `A317AF1F802533E6591A7A07DED1C087B3B11395EA0D97A8EFE367CC1209FA9F`. |

## Frozen artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| `quick-diff.vsix` | `B2060B50CC1F635485B072143CC7980972C61AC3C65E788613CE33FADE3307D2` |
| `media/icon.png` | `423F0C980467F18D6C8FD21B3431556E0FA8C6F9DACC6EF98F37811B761F3E2F` |
| `media/preview.png` | `B1F2EF696F5059ED2CC7013CBB3AF709F1441371252115D6FFBCE58930F49E8B` |
| `dist/node/extension.cjs` | `D631D2C33BD3F715E74CF7FA6B9BA4A54A0895A8B242E999CCFCFB5138EA3878` |
| `dist/web/extension.cjs` | `760CFE1E18D46933DB5E98E9F650D40B01D1916DFC79A1252DB9343EB41BD495` |

Hosted Linux, macOS, Windows, and Insiders evidence remains pending until the PR branch is pushed. QDF-021 publication remains separately gated.
