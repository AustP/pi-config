---
name: iris-mps-image-gen
description: Generate images on Apple Silicon with antirez/iris.c (MPS backend). Use when asked to create images from prompts, run local text-to-image or image-to-image generation, or manage iris models/artifacts in this skill directory.
---

# iris-mps-image-gen

Use this skill for local image generation with `iris.c` on macOS Apple Silicon.

Default behavior: use `iris` defaults unless the user explicitly requests overrides (for example, default image size is 256x256).

Model selection policy:
- Default to the 4B distilled model (`flux-klein-4b`) for normal requests.
- If the user explicitly asks for **high quality** (or equivalent wording like best quality / maximum quality), use the 9B distilled model (`flux-klein-9b`).
- Only use base variants (`*-base`) when the user explicitly asks for base/undistilled models.

## Artifact layout (all inside this skill)

- `artifacts/iris-src/` — cloned `antirez/iris.c` source
- `artifacts/bin/iris` — compiled MPS binary
- `artifacts/models/` — downloaded model directories
- `artifacts/outputs/` — generated images

## Required workflow

Run commands from this skill directory.

1. Try generation first (do not run setup/download by default):

```bash
./scripts/generate.sh --prompt "A cinematic photo of a neon city street at night"
```

For high-quality requests, use 9B distilled:

```bash
./scripts/generate.sh --model-dir flux-klein-9b --prompt "A cinematic photo of a neon city street at night"
```

2. Only if generation fails because dependencies are missing, run recovery steps:

```bash
./scripts/setup.sh
./scripts/download-model.sh 4b
```

For high-quality recovery, download 9B instead:

```bash
./scripts/download-model.sh 9b
```

The generator prints:
- `OUTPUT: <absolute path>`
- `DISCORD_ATTACH: <absolute path>`

Use the `DISCORD_ATTACH` line directly when returning files to Discord.

## Script usage

### `scripts/setup.sh`

Use only as a fallback when generation reports a missing binary/source.

- Clones or updates `https://github.com/antirez/iris.c`
- Builds with `make mps`
- Copies resulting binary to `artifacts/bin/iris`

### `scripts/download-model.sh <model-key> [extra args]`

Use only as a fallback when generation reports a missing model directory.

Examples:

```bash
scripts/download-model.sh 4b
scripts/download-model.sh 4b-base
scripts/download-model.sh 9b --token <hf_token>
scripts/download-model.sh zimage-turbo
```

### `scripts/generate.sh`

```bash
scripts/generate.sh --prompt "..." [--model-dir flux-klein-4b] [--output name.png] [extra iris args]
```

- `--model-dir` is relative to `artifacts/models/`
- `--output` defaults to timestamped PNG in `artifacts/outputs/`
- Size defaults come from `iris` (`--width 256 --height 256`)
- Only pass explicit size flags when the user asks for a different size
- Unknown flags are passed through to `iris`
