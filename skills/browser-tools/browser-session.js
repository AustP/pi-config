#!/usr/bin/env node

import puppeteer from "puppeteer-core";

export const DEBUG_BROWSER_URL = "http://127.0.0.1:9222";
const CONNECT_TIMEOUT_MS = 5000;

export async function connectBrowserOrExit() {
	const browser = await Promise.race([
		puppeteer.connect({
			browserURL: DEBUG_BROWSER_URL,
			defaultViewport: null,
		}),
		new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), CONNECT_TIMEOUT_MS)),
	]).catch((e) => {
		console.error("✗ Could not connect to Brave/Chromium debugging session:", e.message);
		console.error("  Make sure port 9222 is open, then run: browser-start.js");
		process.exit(1);
	});

	return browser;
}

export async function getPreferredPage(browser) {
	const pages = await browser.pages();
	if (!pages.length) return null;

	const newestFirst = [...pages].reverse();

	// Prefer the currently focused tab in the current browser session.
	for (const page of newestFirst) {
		try {
			const hasFocus = await page.evaluate(() => document.hasFocus());
			if (hasFocus) return page;
		} catch {}
	}

	// Next prefer a meaningful non-internal page.
	const meaningfulPage = newestFirst.find((page) => {
		const url = page.url();
		return url && !url.startsWith("about:blank") && !url.startsWith("chrome://") && !url.startsWith("devtools://");
	});

	return meaningfulPage ?? pages.at(-1);
}
