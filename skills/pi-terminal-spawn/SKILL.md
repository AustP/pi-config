---
name: pi-terminal-spawn
description: Use when asked to change Pi's current cwd/pwd by launching a new Pi process in a new macOS Terminal window with a specific working directory, optionally in RPC mode with startup slash commands such as /discord or /speak.
---

# Pi Terminal Spawn

Use this skill when the user wants to start a separate Pi instance in a different directory and see it in a new terminal window.

## What this skill provides

- `scripts/open-pi-terminal.mjs`
  - Opens a **new Terminal.app window/tab**
  - Starts Pi with a chosen `--cwd`
  - Supports `interactive` mode (normal Pi TUI)
  - Supports `rpc` mode with startup commands (e.g. `/discord`, `/speak`)
  - By default inherits active mode commands from current env and auto-sends them in the new session (`/discord` from `DISCORD_PI_PID`; `/speak` from `SPEAK_PI_PID` / `SPEAK_MODE_ENABLED` / `PI_SPEAK_ENABLED`)

- `scripts/run-pi-rpc-bootstrap.mjs`
  - Helper used by `open-pi-terminal.mjs` for RPC startup command bootstrapping

## Usage

### Interactive Pi in a new terminal

```bash
node /Users/aust/projects/pi/pi-config/skills/pi-terminal-spawn/scripts/open-pi-terminal.mjs \
  --cwd /path/to/project
```

### Interactive Pi in a new terminal without inheriting active modes

```bash
node /Users/aust/projects/pi/pi-config/skills/pi-terminal-spawn/scripts/open-pi-terminal.mjs \
  --cwd /path/to/project \
  --no-inherit-active-modes
```

### RPC Pi in a new terminal with startup commands

```bash
node /Users/aust/projects/pi/pi-config/skills/pi-terminal-spawn/scripts/open-pi-terminal.mjs \
  --cwd /Users/aust/projects/pi/pi-discord \
  --mode rpc \
  --rpc-command /discord \
  --rpc-command /speak
```

## Notes

- This skill is macOS Terminal.app oriented.
- In `rpc` mode, startup commands are sent as RPC `prompt` commands after boot.
- If active mode commands are inherited while `--mode interactive` is selected, the launcher auto-switches to `rpc` so it can send startup commands.
- For `/discord` ownership handoff, launching the new instance and running `/discord` is enough; old bridges self-yield on lock mismatch.
