#!/usr/bin/env node

import { connectBrowserOrExit, getPreferredPage } from "./browser-session.js";

const b = await connectBrowserOrExit();
const p = await getPreferredPage(b);

if (!p) {
	console.error("✗ No active tab found in current session");
	process.exit(1);
}

const cookies = await p.cookies();

for (const cookie of cookies) {
	console.log(`${cookie.name}: ${cookie.value}`);
	console.log(`  domain: ${cookie.domain}`);
	console.log(`  path: ${cookie.path}`);
	console.log(`  httpOnly: ${cookie.httpOnly}`);
	console.log(`  secure: ${cookie.secure}`);
	console.log("");
}

await b.disconnect();
