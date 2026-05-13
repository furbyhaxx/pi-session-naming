import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	DEFAULT_SESSION_NAMING_CONFIG,
	loadPiConfig,
	loadSessionNamingConfig,
} from "./index.js";

const root = await mkdtemp(join(tmpdir(), "pi-session-naming-config-"));
const agentDir = join(root, "agent");
const cwd = join(root, "project");
await mkdir(agentDir, { recursive: true });
await mkdir(join(cwd, ".pi"), { recursive: true });

assert.deepEqual(DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration, {
	enabled: true,
	language: "auto",
	model: "auto",
	retries: 3,
	emojis: false,
	maxLength: 52,
	maxMessageCount: -1,
	includeTools: true,
	useTags: true,
	builtinTags: true,
	tags: [],
});
assert.equal(
	Object.hasOwn(DEFAULT_SESSION_NAMING_CONFIG.session, "list"),
	false,
);
assert.equal(
	Object.hasOwn(DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration, "style"),
	false,
);
assert.equal(
	Object.hasOwn(DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration, "fallback"),
	false,
);
assert.equal(
	Object.hasOwn(
		DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration,
		"commandStrategy",
	),
	false,
);
assert.equal(
	Object.hasOwn(DEFAULT_SESSION_NAMING_CONFIG.session.titleGeneration, "retry"),
	false,
);

await writeFile(
	join(agentDir, "settings.json"),
	JSON.stringify(
		{
			session: {
				titleGeneration: {
					language: "Deutsch",
					model: "deepseek/deepseek-v4-flash:high",
					retries: 5,
					maxLength: 40,
					maxMessageCount: 7,
					includeTools: false,
					builtinTags: false,
					tags: ["cook", "book"],
					style: { maxLength: 999, emojis: true },
					fallback: "datetime",
					commandStrategy: { waitTurns: 9 },
					retry: { maxTemporaryRetries: 9 },
				},
				list: { enabled: false, flag: "old-sessions", jsonFlag: "old-json" },
				rename: { command: "titel" },
			},
		},
		null,
		2,
	),
);
await writeFile(
	join(cwd, ".pi", "settings.json"),
	JSON.stringify(
		{
			session: {
				title_generation: {
					emojis: true,
					max_message_count: 2,
					include_tools: true,
					use_tags: false,
					builtin_tags: true,
					tags: ["meet"],
				},
				browser: { pageSize: 5, showCwd: "always" },
			},
		},
		null,
		2,
	),
);

const loaded = loadSessionNamingConfig(cwd, agentDir);

const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = agentDir;
try {
	const loadedFromEnv = await loadPiConfig(cwd);
	assert.equal(loadedFromEnv.config.session.titleGeneration.language, "Deutsch");
	assert.equal(loadedFromEnv.config.session.titleGeneration.maxLength, 40);
} finally {
	if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
}

assert.deepEqual(loaded.config.session.titleGeneration, {
	enabled: true,
	language: "Deutsch",
	model: "deepseek/deepseek-v4-flash:high",
	retries: 5,
	emojis: true,
	maxLength: 40,
	maxMessageCount: 2,
	includeTools: true,
	useTags: false,
	builtinTags: true,
	tags: ["meet"],
});
assert.equal(loaded.config.session.rename.command, "titel");
assert.equal(loaded.config.session.browser.pageSize, 5);
assert.equal(Object.hasOwn(loaded.config.session, "list"), false);
assert.equal(Object.hasOwn(loaded.config.session.browser, "showCwd"), false);
assert.equal(
	loaded.config.session.browser.command,
	DEFAULT_SESSION_NAMING_CONFIG.session.browser.command,
);
assert.deepEqual(loaded.sources, [
	join(agentDir, "settings.json"),
	join(cwd, ".pi", "settings.json"),
]);

console.log("settings config tests passed");
