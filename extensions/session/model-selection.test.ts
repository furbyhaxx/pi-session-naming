import assert from "node:assert/strict";
import {
	isAutoTitleModelValue,
	parseTitleModelRef,
	pickAutoTitleModel,
	shouldSkipAutoTitleCandidateForContext,
} from "./model-selection.js";

assert.equal(isAutoTitleModelValue(undefined), true);
assert.equal(isAutoTitleModelValue(""), true);
assert.equal(isAutoTitleModelValue("auto"), true);
assert.equal(isAutoTitleModelValue(" inherit "), false);

assert.deepEqual(parseTitleModelRef("deepseek/deepseek-v4-flash:high"), {
	provider: "deepseek",
	id: "deepseek-v4-flash",
	thinking: "high",
});
assert.deepEqual(parseTitleModelRef("github-copilot/gpt-5.4-mini"), {
	provider: "github-copilot",
	id: "gpt-5.4-mini",
	thinking: undefined,
});
assert.deepEqual(parseTitleModelRef("gpt-5.4-mini:low", "github-copilot"), {
	provider: "github-copilot",
	id: "gpt-5.4-mini",
	thinking: "low",
});
assert.equal(parseTitleModelRef("auto"), undefined);
assert.equal(parseTitleModelRef("deepseek/"), undefined);
assert.equal(parseTitleModelRef("deepseek/deepseek-v4-flash:huge"), undefined);

assert.equal(
	shouldSkipAutoTitleCandidateForContext({
		forceCurrentContextCheck: false,
		currentContextTokens: 500_000,
		candidateContextWindow: 128_000,
	}),
	false,
);
assert.equal(
	shouldSkipAutoTitleCandidateForContext({
		forceCurrentContextCheck: true,
		currentContextTokens: 500_000,
		candidateContextWindow: 128_000,
	}),
	true,
);
assert.equal(
	shouldSkipAutoTitleCandidateForContext({
		forceCurrentContextCheck: true,
		currentContextTokens: 100_000,
		candidateContextWindow: 128_000,
	}),
	false,
);

assert.deepEqual(
	pickAutoTitleModel({
		availableModels: [
			{
				provider: "github-copilot",
				id: "gpt-5.4-mini",
				contextWindow: 400_000,
			},
			{ provider: "opencode", id: "big-pickle", contextWindow: 200_000 },
		],
		forceCurrentContextCheck: false,
		currentContextTokens: null,
	}),
	{ provider: "github-copilot", id: "gpt-5.4-mini", contextWindow: 400_000 },
);

assert.deepEqual(
	pickAutoTitleModel({
		availableModels: [
			{
				provider: "deepseek",
				id: "deepseek-v4-flash",
				contextWindow: 1_000_000,
			},
			{
				provider: "github-copilot",
				id: "gpt-5.4-mini",
				contextWindow: 400_000,
			},
		],
		forceCurrentContextCheck: true,
		currentContextTokens: 700_000,
	}),
	{ provider: "deepseek", id: "deepseek-v4-flash", contextWindow: 1_000_000 },
);

assert.equal(
	pickAutoTitleModel({
		availableModels: [
			{ provider: "openai-codex", id: "gpt-5.4-mini", contextWindow: 400_000 },
			{
				provider: "github-copilot",
				id: "gpt-5.4-mini",
				contextWindow: 400_000,
			},
			{ provider: "anthropic", id: "claude-haiku-4-5", contextWindow: 200_000 },
			{ provider: "opencode", id: "big-pickle", contextWindow: 200_000 },
		],
		forceCurrentContextCheck: true,
		currentContextTokens: 500_000,
	}),
	undefined,
);

console.log("session model-selection tests passed");
