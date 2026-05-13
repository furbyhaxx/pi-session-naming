import assert from "node:assert/strict";
import {
	filterSessionTitleMessagesFromContext,
	SESSION_TITLE_MESSAGE_TYPE,
} from "./title-context.js";
import { shouldCreateInitialTitlePending } from "./title-scheduling.js";
import {
	fallbackDatetime,
	isTrivialInput,
	normalizeTitle,
} from "./title-utils.js";

const ISO_FALLBACK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

assert.match(fallbackDatetime(), ISO_FALLBACK_RE);

for (const input of [
	"hello",
	"hi!",
	"test",
	"ok",
	"?",
	"...",
	"thanks",
	"ty",
	"gm",
	"",
]) {
	assert.equal(
		isTrivialInput(input),
		true,
		`${JSON.stringify(input)} should be trivial`,
	);
}

for (const input of [
	"fix auth bug in refresh token flow",
	"please refactor parser module",
	"propose teardown wireframes",
]) {
	assert.equal(
		isTrivialInput(input),
		false,
		`${JSON.stringify(input)} should not be trivial`,
	);
}

for (const [input, expected] of [
	["feat(auth): refresh token support", "feat(auth): refresh token support"],
	[
		"propose(teardown): wireframe options",
		"propose(teardown): wireframe options",
	],
	["research: agentic title taxonomies", "research: agentic title taxonomies"],
	[
		"analyze(pi-nukii): session naming flow",
		"analyze(pi-nukii): session naming flow",
	],
] as const) {
	assert.equal(normalizeTitle(input, 52), expected);
}

assert.equal(
	normalizeTitle('"fix(parser): repair broken parser"', 52),
	"fix(parser): repair broken parser",
);
assert.equal(
	normalizeTitle("feat(api): rate limiting.", 52),
	"feat(api): rate limiting",
);
assert.match(normalizeTitle("just random text", 52), ISO_FALLBACK_RE);
assert.match(normalizeTitle("Feat(api): uppercase type", 52), ISO_FALLBACK_RE);
assert.match(
	normalizeTitle(`feat(api): ${"x".repeat(200)}`, 52),
	ISO_FALLBACK_RE,
);
assert.equal(
	normalizeTitle("\u001b[32mfix(todo): replace progress glyphs\u001b[0m", 52),
	"fix(todo): replace progress glyphs",
);
assert.equal(
	normalizeTitle("fix(todo): replace progress glyphs╻▄▄▄▄▄▄", 52),
	"fix(todo): replace progress glyphs",
);

const contextMessages = [
	{ role: "user", content: "hello" },
	{ role: "custom", customType: SESSION_TITLE_MESSAGE_TYPE, content: "hidden" },
	{ role: "custom", customType: "other-extension", content: "kept" },
];
assert.deepEqual(filterSessionTitleMessagesFromContext(contextMessages), [
	contextMessages[0],
	contextMessages[2],
]);

assert.equal(
	shouldCreateInitialTitlePending({
		pending: false,
		generating: false,
		titleGenerationEnabled: true,
		hasTemporaryTitle: false,
		shouldSkip: false,
	}),
	true,
);
assert.equal(
	shouldCreateInitialTitlePending({
		pending: false,
		generating: false,
		titleGenerationEnabled: true,
		hasTemporaryTitle: true,
		shouldSkip: false,
	}),
	false,
);
assert.equal(
	shouldCreateInitialTitlePending({
		pending: false,
		generating: false,
		titleGenerationEnabled: true,
		hasTemporaryTitle: false,
		shouldSkip: true,
	}),
	false,
);

console.log("session auto-title tests passed");
