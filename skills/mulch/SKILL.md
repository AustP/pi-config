---
name: mulch
description: "Use when tasks involve Mulch (`ml`) project memory: storing domain-specific expertise as typed JSONL records in `.mulch/expertise/*.jsonl`, then reloading that expertise with `ml prime`, `ml query`, and `ml search` to ground future agent sessions."
---

# Mulch skill

Mulch is a **passive, git-native expertise layer** for coding agents.

- Mulch does **not** call an LLM.
- Agents write learnings via `ml record`.
- Agents reload learnings via `ml prime` / `ml query` / `ml search`.
- Expertise is stored in `.mulch/expertise/<domain>.jsonl` (one typed JSON record per line).

## Main workflow (clear loop)

Use this sequence whenever Mulch is available in a repo:

1. **Start session: load accumulated expertise**
   ```bash
   ml prime
   ```
   Scope when useful:
   ```bash
   ml prime <domain>
   ml prime --files src/foo.ts
   ```

2. **During task: consult prior learnings**
   ```bash
   ml query
   ml query <domain>
   ml search "keyword or concept"
   ```

3. **Before finishing: preserve new learnings**
   ```bash
   ml learn
   ml record <domain> --type <record-type> ...
   ```

4. **Sync learnings to git**
   ```bash
   ml sync
   ```

This is the compounding loop: **record now, reload later**.

## Setup

If Mulch is not initialized:

```bash
ml init
ml add <domain>
```

If CLI is missing:

```bash
bun install -g @os-eco/mulch-cli
```

## Data model: domains, record types, classifications

### Domains (user-defined buckets)
Domains are project-defined namespaces like `api`, `database`, `testing`, `architecture`.
Each domain maps to one file:

- `.mulch/expertise/api.jsonl`
- `.mulch/expertise/database.jsonl`
- etc.

### The 6 record types (fixed)

1. `convention` — stable rule or standard (`content`)
2. `pattern` — reusable implementation shape (`name`, `description`)
3. `failure` — what went wrong + resolution (`description`, `resolution`)
4. `decision` — choice and rationale (`title`, `rationale`)
5. `reference` — key resource pointer (`name`, `description`)
6. `guide` — repeatable procedure (`name`, `description`)

### The 3 classifications (shelf-life semantics)

- `foundational` — long-lived / effectively permanent
- `tactical` — short-lived implementation guidance (prune horizon: ~14 days)
- `observational` — ephemeral observations (prune horizon: ~30 days)

Use classification intentionally; it powers pruning and freshness workflows.

## Command catalog (checked against `src/cli.ts`)

Primary commands:

- `ml init`
- `ml add <domain>`
- `ml record <domain> --type <type>`
- `ml edit <domain> <id>`
- `ml delete <domain> [id]`
- `ml query [domain]`
- `ml prime [domains...]`
- `ml search [query]`
- `ml compact [domain]`
- `ml diff [ref]`
- `ml status`
- `ml validate`
- `ml doctor`
- `ml setup [provider]`
- `ml onboard`
- `ml prune`
- `ml ready`
- `ml sync`
- `ml outcome <domain> <id>`
- `ml upgrade`
- `ml learn`
- `ml completions <shell>`

Global flags:

- `--json`, `--quiet`/`-q`, `--verbose`, `--timing`, `--version`/`-v`

## High-signal recording patterns

Prefer specific, reusable records with concrete details.

### Convention
```bash
ml record api --type convention \
  --content "Use idempotency keys on all POST /payments requests" \
  --classification foundational \
  --tags api,payments,reliability
```

### Failure
```bash
ml record database --type failure \
  --description "VACUUM inside a transaction caused silent corruption" \
  --resolution "Run VACUUM only outside explicit transactions" \
  --outcome-status failure
```

### Decision
```bash
ml record architecture --type decision \
  --title "SQLite over PostgreSQL for local mode" \
  --rationale "No network dependency required; simpler deployment and backup"
```

### Batch session capture
```bash
ml record api --batch records.json --dry-run
ml record api --batch records.json
echo '[{"type":"convention","content":"Use UTC timestamps"}]' | ml record api --stdin
```

## Multi-agent safety (from README + CLAUDE.md)

- Read-only commands are fully parallel-safe: `prime`, `query`, `search`, `status`, `validate`, `learn`, `ready`
- Write commands are lock-protected: `record`, `edit`, `delete`, `compact`, `prune`, `doctor --fix`
- Setup-style commands should be serialized: `init`, `add`, `setup`, `onboard`

Practical tips:

- In swarms, do most writes with `ml record`; defer heavy rewrite ops when possible.
- After merging many branches/worktrees, run `ml doctor --fix` for cleanup/dedup.
- Coordinate `ml sync` on shared branches (git ref locking can contend).
- Use unique paths for `ml prime --export` outputs.

## Agent behavior expectations

When Mulch exists in a repo:

- Run `ml prime` at task start (or scoped `prime` variants).
- Query/search before decisions that may have prior project history.
- Before final response, run `ml learn` and record durable insights.
- Keep records concrete, concise, and domain-reusable.
- Prefer `--json` when another tool/process will parse output.
