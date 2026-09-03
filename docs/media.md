# Media provenance

## Marketplace icon

- Generator: OpenAI Imagegen.
- Generation id: `exec-3197c550-8c23-4bb1-94af-a83b068ec2ab`, extracted from the accepted square composition without changing its artwork.
- Raw source: `media/source/quick-diff-imagegen-raw.png`.
- Production source: `media/source/quick-diff-imagegen.png` (1254 × 1254 RGBA), normalized to a thin transparent safety margin without redrawing the generated art.
- Production: `media/icon.png` is a direct 256 × 256 alpha-preserving downsample of that generated PNG. No SVG reinterpretation is used.
- Direction: two aligned document panels in a square 1:1 composition, with graphite, white, cool light gray, coral, orange, and violet; crisp vectorized 3D and compact vector shadows.
- SHA-256: raw `965A732E33451570558EFDE52A80B51A09284F887E15593141CE85558C30FC69`; production source `8A6F1453FC5E9E5F4ABB0985A9A2685FA007C3C4E960CDF02807088C594465E4`; icon `7DDC54C848D12ACA773AF05787D24E4727D7D5C1647B1A262317F4DE05158521`.

## Marketplace preview

`media/preview.png` comes from Quick Diff 0.1.0 installed in stable VS Code 1.136.1 on 2026-09-03. The helper opened the synthetic `deploy-service/src/deploy.ts` file, placed changed text on the VS Code clipboard, ran **Compare File with Clipboard**, and captured the native side-by-side diff editor.

The media pipeline tightly crops the native diff editor and adds a transparent RGBA edge with rounded corners. It does not generate or recreate the interface.
