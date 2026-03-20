#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { DEBUG_BROWSER_URL } from "./browser-session.js";

const useProfile = process.argv[2] === "--profile";

if (process.argv[2] && process.argv[2] !== "--profile") {
	console.log("Usage: browser-start.js [--profile]");
	console.log("\nOptions:");
	console.log("  --profile  Copy your default Brave profile (cookies, logins)");
	process.exit(1);
}

const BRAVE_EXECUTABLE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const BRAVE_PROFILE_SOURCE_DIR = `${process.env.HOME}/Library/Application Support/BraveSoftware/Brave-Browser/`;
const BROWSER_TOOLS_PROFILE_DIR = `${process.env.HOME}/.cache/browser-tools/brave`;

async function canConnectToDebugPort() {
	try {
		const browser = await puppeteer.connect({
			browserURL: DEBUG_BROWSER_URL,
			defaultViewport: null,
		});
		await browser.disconnect();
		return true;
	} catch {
		return false;
	}
}

// Prioritize attaching to the current session if port 9222 is already open.
if (await canConnectToDebugPort()) {
	console.log("✓ Browser debugging session already available on :9222");
	process.exit(0);
}

if (!existsSync(BRAVE_EXECUTABLE)) {
	console.error("✗ Brave executable not found:");
	console.error(`  ${BRAVE_EXECUTABLE}`);
	process.exit(1);
}

execSync(`mkdir -p "${BROWSER_TOOLS_PROFILE_DIR}"`, { stdio: "ignore" });

// Remove singleton lock artifacts so a dedicated debug instance can start cleanly.
try {
	execSync(`rm -f "${BROWSER_TOOLS_PROFILE_DIR}/SingletonLock" "${BROWSER_TOOLS_PROFILE_DIR}/SingletonSocket" "${BROWSER_TOOLS_PROFILE_DIR}/SingletonCookie"`, { stdio: "ignore" });
} catch {}

if (useProfile) {
	console.log("Syncing Brave profile...");
	execSync(
		`rsync -a --delete \
			--exclude='SingletonLock' \
			--exclude='SingletonSocket' \
			--exclude='SingletonCookie' \
			--exclude='*/Sessions/*' \
			--exclude='*/Current Session' \
			--exclude='*/Current Tabs' \
			--exclude='*/Last Session' \
			--exclude='*/Last Tabs' \
			"${BRAVE_PROFILE_SOURCE_DIR}" "${BROWSER_TOOLS_PROFILE_DIR}/"`,
		{ stdio: "pipe" },
	);
}

spawn(
	BRAVE_EXECUTABLE,
	[
		"--remote-debugging-port=9222",
		`--user-data-dir=${BROWSER_TOOLS_PROFILE_DIR}`,
		"--no-first-run",
		"--no-default-browser-check",
	],
	{ detached: true, stdio: "ignore" },
).unref();

let connected = false;
for (let i = 0; i < 30; i++) {
	if (await canConnectToDebugPort()) {
		connected = true;
		break;
	}
	await new Promise((r) => setTimeout(r, 500));
}

if (!connected) {
	console.error("✗ Failed to connect to debugging port :9222");
	process.exit(1);
}

console.log(`✓ Brave started with remote debugging on :9222${useProfile ? " (profile synced)" : ""}`);
