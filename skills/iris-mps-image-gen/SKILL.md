---
name: iris-mps-image-gen
description: Generate images on Apple Silicon with antirez/iris.c (MPS backend). Use when asked to create images from prompts, run local text-to-image or image-to-image generation, or manage iris models/artifacts in this skill directory.
---

# iris-mps-image-gen

Use this skill for local image generation with `iris.c` on macOS Apple Silicon.

## Artifact layout (all inside this skill)

- `artifacts/iris-src/` — cloned `antirez/iris.c` source
- `artifacts/bin/iris` — compiled MPS binary
- `artifacts/models/` — downloaded model directories
- `artifacts/outputs/` — generated images

## Required workflow

Run these commands from this skill directory.

1. Build/update iris with MPS:

```bash
./scripts/setup.sh
```

2. Download a model (stored in `artifacts/models`):

```bash
./scripts/download-model.sh 4b
```

3. Generate an image:

```bash
./scripts/generate.sh --prompt "A cinematic photo of a neon city street at night" --width 512 --height 512
```

The generator prints:
- `OUTPUT: <absolute path>`
- `DISCORD_ATTACH: <absolute path>`

Use the `DISCORD_ATTACH` line directly when returning files to Discord.

## Script usage

### `scripts/setup.sh`

- Clones or updates `https://github.com/antirez/iris.c`
- Builds with `make mps`
- Copies resulting binary to `artifacts/bin/iris`

### `scripts/download-model.sh <model-key> [extra args]`

Examples:

```bash
scripts/download-model.sh 4b
scripts/download-model.sh 4b-base
scripts/download-model.sh 9b --token <hf_token>
scripts/download-model.sh zimage-turbo
```

### `scripts/generate.sh`

```bash
scripts/generate.sh --prompt "..." [--model-dir flux-klein-4b] [--output name.png] [--width 512] [--height 512] [extra iris args]
```

- `--model-dir` is relative to `artifacts/models/`
- `--output` defaults to timestamped PNG in `artifacts/outputs/`
- Unknown flags are passed through to `iris`
