# iris-mps-image-gen

Pi skill for local image generation using [`antirez/iris.c`](https://github.com/antirez/iris.c) on Apple Silicon with MPS.

## Quick start

```bash
# from this skill directory
./scripts/setup.sh
./scripts/download-model.sh 4b
./scripts/generate.sh --prompt "A watercolor fox in a forest" --width 512 --height 512
```

Artifacts remain inside this skill directory under `artifacts/`.
