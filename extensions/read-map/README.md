https://github.com/Whamp/pi-read-map

This pi extension augments the built-in read tool with structural file maps. When you open a file larger than 2,000 lines or 50 KB, the extension generates a map of every symbol and its line range. You navigate large codebases precisely instead of scanning sequentially.

Why This Exists
The problem: pi sees only the first 2,000 lines of a 50,000-line source file. Ask "how does the type checker handle unions?" and the model either hallucinates or burns tokens re-reading until it finds the answer.

The trade-off: pi-read-map spends ~2,000–10,000 tokens upfront to generate a map of the entire file. The extension triggers only for files exceeding the truncation limit (>2,000 lines and >50 KB); smaller files pass through unchanged.

The payoff: The map stays in context. Ask "show me the merge implementation," "compare error handling in these three functions," or "what symbols exist after line 40,000?" without re-reading. The investment pays for itself when you analyze a large file beyond a single summary.
