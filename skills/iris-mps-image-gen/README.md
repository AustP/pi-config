# iris-mps-image-gen

Pi skill for local image generation using [`antirez/iris.c`](https://github.com/antirez/iris.c) on Apple Silicon with MPS.

## Quick start

```bash
# from this skill directory
./scripts/generate.sh --prompt "A watercolor fox in a forest"
```

If generation fails because iris or models are missing, run:

```bash
./scripts/setup.sh
./scripts/download-model.sh 4b
```

Default model is `flux-klein-4b` (4B distilled).
For high-quality generations, use `--model-dir flux-klein-9b`.

Artifacts remain inside this skill directory under `artifacts/`.
