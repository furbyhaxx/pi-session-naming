import assert from "node:assert/strict";
import {
	filterSessionTitleMessagesFromContext,
	SESSION_TITLE_MESSAGE_TYPE,
} from "./title-context.js";
import { shouldCreateInitialTitlePending } from "./title-scheduling.js";
import {
	BUILTIN_TITLE_TAGS,
	fallbackDatetime,
	formatTitleTagCatalog,
	isTrivialInput,
	normalizeTitle,
	resolveTitleTags,
} from "./title-utils.js";

const ISO_FALLBACK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

assert.match(fallbackDatetime(), ISO_FALLBACK_RE);
assert.ok(
	BUILTIN_TITLE_TAGS.some((tag) => tag.name === "research" && tag.description),
);
assert.ok(BUILTIN_TITLE_TAGS.some((tag) => tag.name === "fix" && tag.description));
assert.ok(
	BUILTIN_TITLE_TAGS.some((tag) => tag.name === "onboard" && tag.description),
);
assert.ok(
	BUILTIN_TITLE_TAGS.some((tag) => tag.name === "scaffold" && tag.description),
);
assert.ok(
	BUILTIN_TITLE_TAGS.some((tag) => tag.name === "bootstrap" && tag.description),
);
assert.ok(BUILTIN_TITLE_TAGS.some((tag) => tag.name === "init" && tag.description));
assert.ok(BUILTIN_TITLE_TAGS.some((tag) => tag.name === "skill" && tag.description));
assert.deepEqual(
	resolveTitleTags({ builtinTags: true, tags: ["cook", "Research", "bad tag"] }),
	[...BUILTIN_TITLE_TAGS, { name: "cook" }],
);
assert.deepEqual(
	resolveTitleTags({
		builtinTags: false,
		tags: [["Cook", "Use when cooking"], "meet", ["bad tag", "nope"], ["book", ""]],
	}),
	[
		{ name: "cook", description: "Use when cooking" },
		{ name: "meet" },
		{ name: "book" },
	],
);
assert.equal(
	formatTitleTagCatalog([
		{ name: "cook", description: "Use when cooking" },
		{ name: "meet" },
	]),
	"- cook — Use when cooking\n- meet",
);
const builtinTagNames = BUILTIN_TITLE_TAGS.map((tag) => tag.name);

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
		"analyze(pi): session naming flow",
		"analyze(pi): session naming flow",
	],
] as const) {
	assert.equal(
		normalizeTitle(input, {
			maxLength: 52,
			useTags: true,
			tags: builtinTagNames,
		}),
		expected,
	);
}

assert.equal(
	normalizeTitle('"fix(parser): repair broken parser"', {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	"fix(parser): repair broken parser",
);
assert.equal(
	normalizeTitle("feat(api): rate limiting.", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	"feat(api): rate limiting",
);
assert.equal(
	normalizeTitle("Feat(Parser): repair broken parser", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	"feat(parser): repair broken parser",
);
assert.match(
	normalizeTitle("research(really-long-scope-name): short", {
		maxLength: 5,
		useTags: true,
		tags: builtinTagNames,
	}),
	ISO_FALLBACK_RE,
);
assert.match(
	normalizeTitle("research(longscopeword): short", {
		maxLength: 5,
		useTags: true,
		scopeMaxLength: 8,
		tags: builtinTagNames,
	}),
	ISO_FALLBACK_RE,
);
assert.equal(
	normalizeTitle("research(recipe): chocolate", {
		maxLength: 10,
		useTags: true,
		scopeMaxLength: 12,
		tags: builtinTagNames,
	}),
	"research(recipe): chocolate",
);
assert.match(
	normalizeTitle("research(recipe): chocolate cookie recipe", {
		maxLength: 10,
		useTags: true,
		tags: builtinTagNames,
	}),
	ISO_FALLBACK_RE,
);
assert.match(
	normalizeTitle("just random text", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	ISO_FALLBACK_RE,
);
assert.match(
	normalizeTitle("Feat(auth-service): uppercase type invalid scope", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	ISO_FALLBACK_RE,
);
assert.match(
	normalizeTitle("feat(pi-fancy-editor): extract standalone extension package", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	ISO_FALLBACK_RE,
);
assert.equal(
	normalizeTitle("short title without tag", {
		maxLength: 24,
		useTags: false,
		tags: [],
	}),
	"short title without tag",
);
assert.equal(
	normalizeTitle("cook(recipe): chocolate cookies", {
		maxLength: 24,
		useTags: true,
		tags: ["cook"],
	}),
	"cook(recipe): chocolate cookies",
);
assert.match(
	normalizeTitle("fix(auth): refresh token flow", {
		maxLength: 52,
		useTags: true,
		tags: ["cook"],
	}),
	ISO_FALLBACK_RE,
);
assert.equal(
	normalizeTitle("plain title with no tags configured", {
		maxLength: 40,
		useTags: true,
		tags: [],
	}),
	"plain title with no tags configured",
);
assert.match(
	normalizeTitle("title body that is far too long", {
		maxLength: 8,
		useTags: false,
		tags: [],
	}),
	ISO_FALLBACK_RE,
);
assert.equal(
	normalizeTitle("\u001b[32mfix(todo): replace progress glyphs\u001b[0m", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
	"fix(todo): replace progress glyphs",
);
assert.equal(
	normalizeTitle("fix(todo): replace progress glyphs╻▄▄▄▄▄▄", {
		maxLength: 52,
		useTags: true,
		tags: builtinTagNames,
	}),
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
