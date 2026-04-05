#!/usr/bin/env node

import { spawn } from "node:child_process";

function parseArgs(argv) {
	const out = {
		cwd: "",
		rpcCommands: [],
	};
	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--cwd") {
			out.cwd = argv[i + 1] || "";
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
  run-pi-rpc-bootstrap --cwd <path> [--rpc-command </command>]...
`);
	process.exit(code);
}

function makeId(prefix) {
	return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const args = parseArgs(process.argv.slice(2));
if (!args.cwd) {
	console.error("Missing required --cwd");
	printHelp(1);
}

const pi = spawn("pi", ["--mode", "rpc"], {
	cwd: args.cwd,
	stdio: ["pipe", "pipe", "pipe"],
});

const pending = new Map();
let stdoutBuffer = "";

function sendRpc(command) {
	const id = makeId(command.type || "rpc");
	const payload = { id, ...command };
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject });
		pi.stdin.write(`${JSON.stringify(payload)}\n`, (error) => {
			if (!error) return;
			pending.delete(id);
			reject(error);
		});
	});
}

pi.stdout.setEncoding("utf8");
pi.stdout.on("data", (chunk) => {
	process.stdout.write(chunk);
	stdoutBuffer += chunk;
	while (true) {
		const newline = stdoutBuffer.indexOf("\n");
		if (newline === -1) break;
		const line = stdoutBuffer.slice(0, newline).trim();
		stdoutBuffer = stdoutBuffer.slice(newline + 1);
		if (!line) continue;
		let parsed;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}
		if (parsed?.type !== "response" || !parsed.id) continue;
		const wait = pending.get(parsed.id);
		if (!wait) continue;
		pending.delete(parsed.id);
		if (parsed.success) wait.resolve(parsed.data || {});
		else wait.reject(new Error(parsed.error || "RPC command failed"));
	}
});

pi.stderr.setEncoding("utf8");
pi.stderr.on("data", (chunk) => {
	process.stderr.write(chunk);
});

pi.on("exit", (code, signal) => {
	for (const item of pending.values()) {
		item.reject(new Error(`pi exited (${code ?? signal ?? "unknown"})`));
	}
	pending.clear();
	process.exit(typeof code === "number" ? code : 0);
});

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
	if (!pi.stdin.writable) return;
	pi.stdin.write(chunk);
});

process.on("SIGINT", () => {
	try {
		pi.kill("SIGINT");
	} catch {}
});

process.on("SIGTERM", () => {
	try {
		pi.kill("SIGTERM");
	} catch {}
});

(async () => {
	try {
		await sendRpc({ type: "get_state" });
		for (const cmd of args.rpcCommands) {
			await sendRpc({ type: "prompt", message: cmd });
		}
		if (args.rpcCommands.length > 0) {
			console.log(`# bootstrap complete (${args.rpcCommands.length} command(s) sent)`);
		}
	} catch (error) {
		console.error(`Bootstrap error: ${error instanceof Error ? error.message : String(error)}`);
		try {
			pi.kill("SIGTERM");
		} catch {}
	}
})();