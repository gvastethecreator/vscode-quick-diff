# Media provenance

## Marketplace icon

- Generator: OpenAI Imagegen.
- Generation ids: style pass `exec-78d2f0ae-86d2-4865-87f0-69dd5fd138b1`; native-alpha extraction `exec-e827ae09-1001-4e81-bc30-b9c17679a9a6`.
- Raw source: `media/source/quick-diff-imagegen-raw.png`.
- Production source: `media/source/quick-diff-imagegen.png` (1254 × 1254 RGBA), normalized to a thin transparent safety margin without redrawing the generated art.
- Production: `media/icon.png` is a direct 256 × 256 alpha-preserving downsample of that generated PNG. No SVG reinterpretation is used.
- Direction: two balanced front-facing document halves around one center compare arrow, with graphite, white, cool light gray, coral, orange, violet, and muted teal; Tag Mate-style crisp vectorized semi-3D and compact gradient shadows.
- SHA-256: raw `C1123D3AACDA5F5A004DEFA3043C0BE3ACE68900E54DB35141E28A12AB5E4737`; production source `EBA4791319B1D255110114B78477EDA8505B423706330B75B65854A3AAF56F5C`; icon `A8819FC92261921735B9345CE426F24FFF19313EBA9CEA0612FD3FD47EB15FE8`.

## Marketplace preview

`media/preview.png` comes from Quick Diff 0.1.0 installed in stable VS Code 1.136.1 on 2026-09-03. The helper opened the synthetic `deploy-service/src/deploy.ts` file, placed changed text on the VS Code clipboard, ran **Compare File with Clipboard**, and captured the native side-by-side diff editor.

The media pipeline tightly crops the native diff editor and adds a transparent RGBA edge with rounded corners. It does not generate or recreate the interface.
