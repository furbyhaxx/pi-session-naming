import assert from "node:assert/strict";
import {
	buildSessionTranscriptBlock,
	formatSessionTranscript,
} from "./session-transcript.js";

const branch = [
	{ type: "custom", customType: "ignored", data: {} },
	{ type: "message", message: { role: "user", content: "first user" } },
	{
		type: "message",
		message: { role: "toolResult", toolName: "read", content: "file contents" },
	},
	{ type: "message", message: { role: "assistant", content: "assistant reply" } },
	{
		type: "message",
		message: { role: "toolResult", toolName: "bash", content: "test output" },
	},
	{
		type: "message",
		message: {
			role: "user",
			content: [
				{ type: "thinking", thinking: "ignored" },
				{ type: "text", text: "latest user" },
			],
		},
	},
] as any[];

assert.equal(
	formatSessionTranscript(branch, { maxMessageCount: -1, includeTools: true }),
	[
		"[user] first user",
		"[tool:read] file contents",
		"[assistant] assistant reply",
		"[tool:bash] test output",
		"[user] latest user",
	].join("\n"),
);
assert.equal(
	formatSessionTranscript(branch, { maxMessageCount: 0, includeTools: false }),
	["[user] first user", "[assistant] assistant reply", "[user] latest user"].join(
		"\n",
	),
);
assert.equal(
	formatSessionTranscript(branch, { maxMessageCount: 2, includeTools: true }),
	["[tool:bash] test output", "[user] latest user"].join("\n"),
);
assert.equal(
	formatSessionTranscript(branch, { maxMessageCount: 2, includeTools: false }),
	["[assistant] assistant reply", "[user] latest user"].join("\n"),
);
assert.equal(
	buildSessionTranscriptBlock(branch, {
		maxMessageCount: 1,
		includeTools: false,
	}),
	"<session-transcript>\n[user] latest user\n</session-transcript>",
);
assert.equal(
	buildSessionTranscriptBlock([], { maxMessageCount: -1, includeTools: true }),
	undefined,
);

console.log("session transcript tests passed");
