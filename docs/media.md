# Media provenance

## Marketplace icon

- Generator: OpenAI Imagegen.
- Generation id: `exec-ee171e23-66ed-491a-a4d6-5c09f9496c98`.
- Source: `media/source/quick-diff-imagegen.png` (1254 × 1254 RGBA).
- Production: `media/icon.png` is a direct 256 × 256 alpha-preserving downsample of that generated PNG. No SVG reinterpretation is used.
- Direction: two code documents, blue/violet base, amber/coral diff cues, restrained saturation, transparent canvas.

## Marketplace preview

`media/preview.png` comes from Quick Diff 0.1.0 installed in stable VS Code 1.136.1 on 2026-09-03. The helper opened the synthetic `deploy-service/src/deploy.ts` file, placed changed text on the VS Code clipboard, ran **Compare File with Clipboard**, and captured the native side-by-side diff editor.

The media pipeline tightly crops the native diff editor and adds a transparent RGBA edge with rounded corners. It does not generate or recreate the interface.
