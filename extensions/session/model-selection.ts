export type AutoTitleModelCandidate = {
	provider: string;
	id: string;
};

export type AvailableModelRef = AutoTitleModelCandidate & {
	contextWindow?: number | null;
};

export const AUTO_TITLE_MODEL_CANDIDATES: AutoTitleModelCandidate[] = [
	{ provider: "deepseek", id: "deepseek-v4-flash" },
	{ provider: "openai-codex", id: "gpt-5.4-mini" },
	{ provider: "github-copilot", id: "gpt-5.4-mini" },
	{ provider: "anthropic", id: "claude-haiku-4-5" },
	{ provider: "opencode", id: "big-pickle" },
];

export function isAutoTitleModelValue(value: string | undefined): boolean {
	return !value || value.trim() === "" || value.trim() === "auto";
}

export function shouldSkipAutoTitleCandidateForContext(args: {
	forceCurrentContextCheck: boolean;
	currentContextTokens: number | null | undefined;
	candidateContextWindow: number | null | undefined;
}): boolean {
	if (!args.forceCurrentContextCheck) return false;
	if (
		args.currentContextTokens === null ||
		args.currentContextTokens === undefined
	)
		return false;
	if (
		args.candidateContextWindow === null ||
		args.candidateContextWindow === undefined
	) {
		return false;
	}
	return args.currentContextTokens > args.candidateContextWindow;
}

export function pickAutoTitleModels(args: {
	availableModels: AvailableModelRef[];
	forceCurrentContextCheck: boolean;
	currentContextTokens: number | null | undefined;
}): AvailableModelRef[] {
	const out: AvailableModelRef[] = [];
	for (const candidate of AUTO_TITLE_MODEL_CANDIDATES) {
		const model = args.availableModels.find(
			(available) =>
				available.provider === candidate.provider &&
				available.id === candidate.id,
		);
		if (!model) continue;
		if (
			shouldSkipAutoTitleCandidateForContext({
				forceCurrentContextCheck: args.forceCurrentContextCheck,
				currentContextTokens: args.currentContextTokens,
				candidateContextWindow: model.contextWindow,
			})
		) {
			continue;
		}
		out.push(model);
	}
	return out;
}

export function pickAutoTitleModel(args: {
	availableModels: AvailableModelRef[];
	forceCurrentContextCheck: boolean;
	currentContextTokens: number | null | undefined;
}): AvailableModelRef | undefined {
	return pickAutoTitleModels(args)[0];
}
