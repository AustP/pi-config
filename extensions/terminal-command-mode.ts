import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text, matchesKey } from "@mariozechner/pi-tui";

const MODE_STATUS_KEY = "terminal-mode";
const TOGGLE_SHORTCUT = "ctrl+shift+tab";
const MAX_OUTPUT_LINES = 220;
const INTERACTIVE_PREFIXES = [
	"vim",
	"nvim",
	"vi",
	"nano",
	"emacs",
	"less",
	"more",
	"man",
	"top",
	"htop",
	"btop",
	"ranger",
	"nnn",
	"lf",
	"tig",
	"lazygit",
	"git rebase -i",
	"git commit",
	"ssh",
	"tmux",
	"screen",
];

export default function (pi: ExtensionAPI) {
	let terminalMode = false;
	let terminalToggleInputUnsubscribe: (() => void) | undefined;

	function bindTerminalToggleInput(ctx: ExtensionContext) {
		if (!ctx.hasUI) return;
		terminalToggleInputUnsubscribe?.();
		terminalToggleInputUnsubscribe = ctx.ui.onTerminalInput((data) => {
			const isPrimaryShortcut = matchesKey(data, TOGGLE_SHORTCUT);
			const isShiftTabFallback = TOGGLE_SHORTCUT === "ctrl+shift+tab" && matchesKey(data, "shift+tab");
			if (!isPrimaryShortcut && !isShiftTabFallback) return undefined;
			setTerminalMode(ctx, !terminalMode);
			return { consume: true };
		});
	}

	function renderMode(ctx: ExtensionContext) {
		if (!ctx.hasUI) return;
		if (!terminalMode) {
			ctx.ui.setWidget(MODE_STATUS_KEY, undefined);
			return;
		}

		ctx.ui.setWidget(MODE_STATUS_KEY, [
			"Shell mode is ON",
			"- /term or type exit to leave",
		]);
	}

	function isInteractiveCommand(rawCommand: string): boolean {
		const command = rawCommand.trim().toLowerCase();
		if (!command) return false;
		for (const prefix of INTERACTIVE_PREFIXES) {
			if (command === prefix || command.startsWith(`${prefix} `)) return true;
		}
		return false;
	}

	function truncateOutput(output: string): string {
		const lines = output.split("\n");
		if (lines.length <= MAX_OUTPUT_LINES) return output;
		const tail = lines.slice(lines.length - MAX_OUTPUT_LINES).join("\n");
		return `[output truncated: showing last ${MAX_OUTPUT_LINES} of ${lines.length} lines]\n\n${tail}`;
	}

	async function showOutput(ctx: ExtensionContext, command: string, output: string, exitCode: number) {
		if (!ctx.hasUI) return;
		const finalOutput = truncateOutput(output).trim();
		const body = finalOutput.length > 0 ? finalOutput : "(no output)";
		const header = `$ ${command}\n(exit ${exitCode})\n\n`;

		await ctx.ui.custom<void>((tui, theme, _kb, done) => {
			const text = new Text(
				theme.fg("toolTitle", "Shell output") +
				"\n" +
				theme.fg("dim", "Press any key to close") +
				"\n\n" +
				theme.fg("muted", header) +
				body,
				1,
				1,
			);

			return {
				render: (width: number) => text.render(width),
				invalidate: () => text.invalidate(),
				handleInput: (_data: string) => {
					done();
					tui.requestRender();
				},
			};
		});
	}

	async function runCommand(ctx: ExtensionContext, rawCommand: string): Promise<number> {
		const command = rawCommand.trim();
		if (!command) return 0;
		const shell = process.env.SHELL || "/bin/sh";

		if (isInteractiveCommand(command) && ctx.hasUI) {
			const exitCode = await ctx.ui.custom<number>((tui, _theme, _kb, done) => {
				tui.stop();
				const result = spawnSync(shell, ["-lc", command], {
					cwd: ctx.cwd,
					stdio: "inherit",
					env: process.env,
				});
				tui.start();
				tui.requestRender(true);
				done(result.status ?? 1);
				return { render: () => [], invalidate: () => {} };
			});
			return exitCode ?? 1;
		}

		const result = spawnSync(shell, ["-lc", command], {
			cwd: ctx.cwd,
			stdio: ["ignore", "pipe", "pipe"],
			env: process.env,
			encoding: "utf8",
			maxBuffer: 8 * 1024 * 1024,
		});

		const stdout = typeof result.stdout === "string" ? result.stdout : "";
		const stderr = typeof result.stderr === "string" ? result.stderr : "";
		const combined = `${stdout}${stderr}`;
		const exitCode = result.status ?? 1;
		await showOutput(ctx, command, combined, exitCode);
		return exitCode;
	}

	function setTerminalMode(ctx: ExtensionContext, enabled: boolean) {
		terminalMode = enabled;
		renderMode(ctx);
	}

	pi.on("session_start", async (_event, ctx) => {
		renderMode(ctx);
		bindTerminalToggleInput(ctx);
	});

	pi.on("session_switch", async (_event, ctx) => {
		renderMode(ctx);
		bindTerminalToggleInput(ctx);
	});

	pi.on("session_shutdown", async () => {
		terminalToggleInputUnsubscribe?.();
		terminalToggleInputUnsubscribe = undefined;
	});

	pi.registerShortcut(TOGGLE_SHORTCUT, {
		description: "Toggle shell command mode",
		handler: async (ctx) => {
			setTerminalMode(ctx, !terminalMode);
		},
	});

	pi.registerCommand("term", {
		description: "Toggle shell command mode",
		handler: async (_args, ctx) => {
			setTerminalMode(ctx, !terminalMode);
		},
	});

	pi.on("input", async (event, ctx) => {
		if (!terminalMode) return { action: "continue" as const };
		const text = event.text.trim();
		if (!text) return { action: "handled" as const };

		if (text === "exit" || text === "quit") {
			setTerminalMode(ctx, false);
			return { action: "handled" as const };
		}

		if (text.startsWith("/")) {
			return { action: "continue" as const };
		}

		const exitCode = await runCommand(ctx, text);
		if (ctx.hasUI && exitCode !== 0) {
			ctx.ui.notify(`Command exited with code ${exitCode}`, "warning");
		}
		return { action: "handled" as const };
	});
}
