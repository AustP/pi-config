#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(SCRIPT_DIR, "..");
const RPC_BOOTSTRAP_SCRIPT = resolve(SKILL_DIR, "scripts", "run-pi-rpc-bootstrap.mjs");

function parseArgs(argv) {
	const out = {
		cwd: "",
		mode: "interactive",
		rpcCommands: [],
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--cwd") {
			out.cwd = argv[i + 1] || "";
			i += 1;
			continue;
		}
		if (arg === "--mode") {
			out.mode = argv[i + 1] || "interactive";
			i += 1;
			continue;
		}
		if (arg === "--rpc-command") {
			const cmd = argv[i + 1] || "";
			if (cmd) out.rpcCommands.push(cmd);
			i += 1;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printHelp(0);
		}
	}
	return out;
}

function printHelp(code = 0) {
	console.log(`Usage:
  open-pi-terminal --cwd <path> [--mode interactive|rpc] [--rpc-command </command>]...

Examples:
  open-pi-terminal --cwd /Users/aust/projects/pi/pi-discord
  open-pi-terminal --cwd /Users/aust/projects/pi/pi-discord --mode rpc --rpc-command /discord --rpc-command /speak
`);
	process.exit(code);
}

function shellEscape(value) {
	return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function appleScriptEscape(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildTerminalCommand({ cwd, mode, rpcCommands }) {
	if (mode === "rpc") {
		const args = ["node", shellEscape(RPC_BOOTSTRAP_SCRIPT), "--cwd", shellEscape(cwd)];
		for (const cmd of rpcCommands) {
			args.push("--rpc-command", shellEscape(cmd));
		}
		return `cd ${shellEscape(cwd)} && ${args.join(" ")}`;
	}
	return `cd ${shellEscape(cwd)} && pi`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.cwd) {
	console.error("Missing required --cwd");
	printHelp(1);
}
if (args.mode !== "interactive" && args.mode !== "rpc") {
	console.error(`Invalid --mode: ${args.mode}`);
	printHelp(1);
}
if (process.platform !== "darwin") {
	console.error("This launcher is macOS-only (Terminal.app).");
	process.exit(1);
}

const command = buildTerminalCommand({
	cwd: resolve(args.cwd),
	mode: args.mode,
	rpcCommands: args.rpcCommands,
});

const run = spawnSync(
	"osascript",
	[
		"-e",
		'tell application "Terminal" to activate',
		"-e",
		`tell application "Terminal" to do script "${appleScriptEscape(command)}"`,
	],
	{ stdio: "inherit" },
);

if (run.error) {
	console.error(run.error.message);
	process.exit(1);
}
if (typeof run.status === "number" && run.status !== 0) {
	process.exit(run.status);
}

console.log("Opened new Terminal with Pi startup command.");