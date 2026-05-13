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

await writeFile(
	join(agentDir, "settings.json"),
	JSON.stringify(
		{
			user: { preferences: { language: "Deutsch" } },
			session: {
				titleGeneration: {
					style: { maxLength: 40 },
					commandStrategy: { waitTurns: 2 },
				},
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
					style: { emojis: true },
					retry: { max_temporary_retries: 7 },
				},
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
	assert.equal(loadedFromEnv.config.user.preferences.language, "Deutsch");
	assert.equal(loadedFromEnv.config.session.titleGeneration.style.maxLength, 40);
} finally {
	if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
	else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
}

assert.equal(loaded.config.user.preferences.language, "Deutsch");
assert.equal(loaded.config.session.titleGeneration.style.maxLength, 40);
assert.equal(loaded.config.session.titleGeneration.style.emojis, true);
assert.equal(loaded.config.session.titleGeneration.commandStrategy.waitTurns, 2);
assert.equal(loaded.config.session.titleGeneration.retry.maxTemporaryRetries, 7);
assert.equal(loaded.config.session.rename.command, "titel");
assert.equal(
	loaded.config.session.browser.command,
	DEFAULT_SESSION_NAMING_CONFIG.session.browser.command,
);
assert.deepEqual(loaded.sources, [
	join(agentDir, "settings.json"),
	join(cwd, ".pi", "settings.json"),
]);

console.log("settings config tests passed");
