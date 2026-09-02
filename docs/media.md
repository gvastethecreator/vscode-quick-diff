# Media provenance

## Marketplace icon

- Generator: OpenAI Imagegen.
- Generation id: `exec-ee171e23-66ed-491a-a4d6-5c09f9496c98`.
- Source: `media/source/quick-diff-imagegen.png` (1254 × 1254 RGBA).
- Production: `media/icon.png` is a direct 256 × 256 alpha-preserving downsample of that generated PNG. No SVG reinterpretation is used.
- Direction: two code documents, blue/violet base, amber/coral diff cues, restrained saturation, transparent canvas.

## Marketplace preview

`media/preview.png` comes from Quick Diff 0.1.0 installed from a VSIX into a clean temporary VS Code 1.136 profile. The helper opened an unsaved TypeScript buffer, placed changed text on the VS Code clipboard, ran **Compare File with Clipboard**, and captured the native side-by-side diff editor.

The media pipeline only crops the VS Code development-host title bar, rounds the runtime frame, and places it on a transparent 1200 × 800 RGBA canvas. It does not generate or recreate the interface.
