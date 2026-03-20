#!/usr/bin/env node

import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectBrowserOrExit, getPreferredPage } from "./browser-session.js";

const b = await connectBrowserOrExit();
const p = await getPreferredPage(b);

if (!p) {
	console.error("✗ No active tab found in current session");
	process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `screenshot-${timestamp}.png`;
const filepath = join(tmpdir(), filename);

await p.screenshot({ path: filepath });

console.log(filepath);

await b.disconnect();
