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
		inheritActiveModes: true,
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
		if (arg === "--inherit-active-modes") {
			out.inheritActiveModes = true;
			continue;
		}
		if (arg === "--no-inherit-active-modes") {
			out.inheritActiveModes = false;
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
  open-pi-terminal --cwd <path> [--mode interactive|rpc] [--rpc-command </command>]... [--inherit-active-modes|--no-inherit-active-modes]

Examples:
  open-pi-terminal --cwd /Users/aust/projects/pi/pi-discord
  open-pi-terminal --cwd /Users/aust/projects/pi/pi-discord --mode rpc --rpc-command /discord --rpc-command /speak
  open-pi-terminal --cwd /Users/aust/tmp --no-inherit-active-modes
`);
	process.exit(code);
}

function shellEscape(value) {
	return `'${String(value).replace(/'/g, `"'"'`)}'`;
}

function appleScriptEscape(value) {
	return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isTruthy(value) {
	const normalized = String(value || "")
		.trim()
		.toLowerCase();
	return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function collectActiveModeCommandsFromEnv() {
	const commands = [];
	if ((process.env.DISCORD_PI_PID || "").trim()) commands.push("/discord");
	if ((process.env.SPEAK_PI_PID || "").trim() || isTruthy(process.env.SPEAK_MODE_ENABLED) || isTruthy(process.env.PI_SPEAK_ENABLED)) {
		commands.push("/speak");
	}
	return commands;
}

function uniqueCommands(commands) {
	return [...new Set(commands.map((cmd) => String(cmd || "").trim()).filter(Boolean))];
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

const inheritedCommands = args.inheritActiveModes ? collectActiveModeCommandsFromEnv() : [];
const finalRpcCommands = uniqueCommands([...args.rpcCommands, ...inheritedCommands]);
const finalMode = args.mode === "interactive" && finalRpcCommands.length > 0 ? "rpc" : args.mode;

const command = buildTerminalCommand({
	cwd: resolve(args.cwd),
	mode: finalMode,
	rpcCommands: finalRpcCommands,
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

if (inheritedCommands.length > 0) {
	console.log(`Inherited active mode command(s): ${inheritedCommands.join(", ")}`);
}
if (finalMode === "rpc" && args.mode === "interactive" && finalRpcCommands.length > 0) {
	console.log("Switched to rpc mode to send startup commands.");
}
console.log("Opened new Terminal with Pi startup command.");
