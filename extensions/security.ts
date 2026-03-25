import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { prompt } from "/Users/aust/projects/pi/glimpse/src/glimpse.mjs";

const DIALOG_OPTIONS = {
  width: 560,
  height: 240,
  title: "Security approval",
  frameless: true,
  transparent: true,
  floating: true,
};

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseEnvKeyNames(content: string): string[] {
  const keys = new Set<string>();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) {
      keys.add(match[1]);
    }
  }

  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

function buildEnvReadBlockReason(filePath: string, absolutePath: string): string {
  try {
    const content = fs.readFileSync(absolutePath, "utf8");
    const keys = parseEnvKeyNames(content);
    const keyList = keys.length > 0 ? keys.join(", ") : "(no keys detected)";

    return [
      `Read blocked for ${filePath}: .env values are redacted by security policy.`,
      `Detected key names: ${keyList}`,
      "The read tool cannot reveal .env values.",
      "You can still reference these keys in code (for example: process.env.KEY_NAME).",
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [
      `Read blocked for ${filePath}: .env values are redacted by security policy.`,
      "The read tool cannot reveal .env values.",
      `Could not parse key names: ${message}`,
    ].join("\n");
  }
}

async function confirmWithPopup(title: string, detail: string): Promise<boolean> {
  const safeTitle = escapeHtml(title);
  const safeDetail = escapeHtml(detail);

  const result = await prompt(
    `
<body style="
  margin:0;
  height:100vh;
  overflow:hidden;
  box-sizing:border-box;
  padding:14px;
  background:transparent !important;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;
">
  <div style="
    height:100%;
    min-height:0;
    display:flex;
    flex-direction:column;
    border-radius:14px;
    background:rgba(28,28,30,0.96);
    color:#fff;
    box-shadow:0 14px 30px rgba(0,0,0,0.35);
    border:1px solid rgba(255,255,255,0.14);
    padding:16px;
    box-sizing:border-box;
  ">
    <div style="font-size:14px;font-weight:700;line-height:1.35;">${safeTitle}</div>
    <pre style="
      margin:10px 0 0;
      padding:10px;
      min-height:72px;
      flex:1;
      overflow:auto;
      border-radius:9px;
      background:rgba(255,255,255,0.08);
      color:#d6e4ff;
      font-size:12px;
      line-height:1.35;
      white-space:pre-wrap;
      word-break:break-word;
      box-sizing:border-box;
    ">${safeDetail}</pre>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
      <button id="deny" style="
        border:1px solid rgba(255,255,255,0.25);
        background:transparent;
        color:#fff;
        border-radius:8px;
        padding:7px 12px;
        font-size:13px;
        cursor:pointer;
      ">No</button>
      <button id="allow" autofocus style="
        border:none;
        background:#34c759;
        color:#04230f;
        border-radius:8px;
        padding:7px 12px;
        font-size:13px;
        font-weight:700;
        cursor:pointer;
      ">Yes</button>
    </div>
  </div>
  <script>
    const allow = () => window.glimpse.send({ ok: true });
    const deny = () => window.glimpse.send({ ok: false });

    document.getElementById('allow').addEventListener('click', allow);
    document.getElementById('deny').addEventListener('click', deny);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') allow();
      if (event.key === 'Escape') deny();
    });
  </script>
</body>
`,
    DIALOG_OPTIONS,
  );

  return result?.ok === true;
}

/**
 * Comprehensive security hook:
 * - Blocks dangerous bash commands (rm -rf, sudo, chmod 777, etc.)
 * - Protects sensitive paths from writes (.env, node_modules, .git, keys)
 */
export default function (pi: ExtensionAPI) {
  const dangerousCommands = [
    { pattern: /\brm\s+(-[^\s]*r|--recursive)/, desc: "recursive delete" }, // rm -rf, rm -r, rm --recursive
    { pattern: /\bsudo\b/, desc: "sudo command" }, // sudo anything
    { pattern: /\b(chmod|chown)\b.*777/, desc: "dangerous permissions" }, // chmod 777, chown 777
    { pattern: /\bmkfs\b/, desc: "filesystem format" }, // mkfs.ext4, mkfs.xfs
    { pattern: /\bdd\b.*\bof=\/dev\//, desc: "raw device write" }, // dd if=x of=/dev/sda
    { pattern: />\s*\/dev\/sd[a-z]/, desc: "raw device overwrite" }, // echo x > /dev/sda
    { pattern: /\bkill\s+-9\s+-1\b/, desc: "kill all processes" }, // kill -9 -1
    { pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, desc: "fork bomb" }, // :(){:|:&};:
  ];

  const envFilePattern = /\.env($|\.(?!example))/;

  const protectedPaths = [
    { pattern: envFilePattern, desc: "environment file", mode: "confirm" }, // .env, .env.local (but not .env.example)
    { pattern: /\.dev\.vars($|\.[^/]+$)/, desc: "dev vars file", mode: "confirm" }, // .dev.vars
    { pattern: /node_modules\//, desc: "node_modules", mode: "confirm" }, // node_modules/
    { pattern: /^\.git\/|\/\.git\//, desc: "git directory", mode: "confirm" }, // .git/
    { pattern: /\.pem$|\.key$/, desc: "private key file", mode: "confirm" }, // *.pem, *.key
    { pattern: /id_rsa|id_ed25519|id_ecdsa/, desc: "SSH key", mode: "confirm" }, // id_rsa, id_ed25519
    { pattern: /\.ssh\//, desc: ".ssh directory", mode: "confirm" }, // .ssh/
    { pattern: /secrets?\.(json|ya?ml|toml)$/i, desc: "secrets file", mode: "confirm" }, // secrets.json, secret.yaml
    { pattern: /credentials/i, desc: "credentials file", mode: "confirm" }, // credentials, CREDENTIALS
    { pattern: /package-lock\.json$/, desc: "package-lock.json", mode: "confirm" },
    { pattern: /yarn\.lock$/, desc: "yarn.lock", mode: "confirm" },
    { pattern: /pnpm-lock\.yaml$/, desc: "pnpm-lock.yaml", mode: "confirm" },
  ];

  const dangerousBashWrites = [
    { pattern: />\s*\.env/, desc: "shell redirect into .env" }, // echo x > .env
    { pattern: />\s*\.dev\.vars/, desc: "shell redirect into .dev.vars" }, // echo x > .dev.vars
    { pattern: />\s*.*\.pem/, desc: "shell redirect into .pem" }, // echo x > key.pem
    { pattern: />\s*.*\.key/, desc: "shell redirect into .key" }, // echo x > secret.key
    { pattern: /tee\s+.*\.env/, desc: "tee into .env" }, // cat x | tee .env
    { pattern: /tee\s+.*\.dev\.vars/, desc: "tee into .dev.vars" }, // cat x | tee .dev.vars
    { pattern: /cp\s+.*\s+\.env/, desc: "copy into .env" }, // cp x .env
    { pattern: /mv\s+.*\s+\.env/, desc: "move into .env" }, // mv x .env
  ];

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash") {
      const command = event.input.command as string;

      for (const { pattern, desc } of dangerousCommands) {
        if (pattern.test(command)) {
          const ok = await confirmWithPopup(`⚠️ Dangerous command: ${desc}`, command);

          if (!ok) {
            return { block: true, reason: `Blocked ${desc} by user` };
          }
          break;
        }
      }

      for (const { pattern, desc } of dangerousBashWrites) {
        if (!pattern.test(command)) continue;

        const ok = await confirmWithPopup(
          `⚠️ Dangerous bash write: ${desc}`,
          command,
        );

        if (!ok) {
          return { block: true, reason: `Blocked dangerous bash write (${desc}) by user` };
        }
        break;
      }

      return undefined;
    }

    if (event.toolName === "read") {
      const filePath = event.input.path as string;
      const normalizedPath = path.normalize(filePath);

      if (envFilePattern.test(normalizedPath)) {
        const absolutePath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(process.cwd(), filePath);

        return {
          block: true,
          reason: buildEnvReadBlockReason(filePath, absolutePath),
        };
      }

      return undefined;
    }

    if (event.toolName === "write" || event.toolName === "edit") {
      const filePath = event.input.path as string;
      const normalizedPath = path.normalize(filePath);

      for (const { pattern, desc, mode } of protectedPaths) {
        if (!pattern.test(normalizedPath)) continue;

        if (mode === "confirm") {
          const ok = await confirmWithPopup(
            `⚠️ Modifying ${desc}`,
            `Are you sure you want to modify ${filePath}?`,
          );

          if (!ok) {
            return { block: true, reason: `User blocked write to ${desc}` };
          }
          break;
        }
      }

      return undefined;
    }

    return undefined;
  });
}
