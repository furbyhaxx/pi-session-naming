/** Session title generation for Pi sessions. */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	getAgentDir,
	SessionManager,
	SettingsManager,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	type SessionEntry,
	type SessionInfo,
} from "@earendil-works/pi-coding-agent";
import { completeSimple, type Model } from "@earendil-works/pi-ai";
import {
	DEFAULT_PI_CONFIG,
	type PiConfig,
	type SessionTitleGenerationConfig,
	type SessionTitlePromptOverrides,
} from "../shared/config/index.js";
import { loadPiConfig } from "../shared/config/index.js";
import {
	hasTemporaryAutoTitle,
	markAutoTitle,
	shouldSkipAutoTitle,
} from "./state.js";
import { emitSessionTitleMessage } from "./title-message.js";
import { shouldCreateInitialTitlePending } from "./title-scheduling.js";
import {
	isAutoTitleModelValue,
	pickAutoTitleModels,
} from "./model-selection.js";
import {
	fallbackDatetime,
	ISO_FALLBACK_RE,
	isTrivialInput,
	normalizeTitle,
} from "./title-utils.js";

export {
	fallbackDatetime,
	isTrivialInput,
	normalizeTitle,
} from "./title-utils.js";

type PendingTitle = {
	firstPrompt: string;
	rawInput?: string;
	commandName?: string;
	waitTurns: number;
	turnsSeen: number;
	reason: "initial" | "temporary-retry" | "temporary-fallback" | "manual-auto";
	force?: boolean;
};

type TitleResult = {
	title: string;
	temporary: boolean;
};

type WorkspaceContext = {
	sessionTitles: string[];
	git?: { branch?: string; dirty?: string[] };
	packageName?: string;
	trackedFiles?: string[];
};

const SESSION_EXTENSION_DIR = dirname(fileURLToPath(import.meta.url));

const DEFAULT_SYSTEM_TEMPLATE = readFileSync(
	resolve(SESSION_EXTENSION_DIR, "prompt-title-system.md"),
	"utf8",
);
const DEFAULT_REQUEST_TEMPLATE = readFileSync(
	resolve(SESSION_EXTENSION_DIR, "prompt-title-request.md"),
	"utf8",
);

const RULES_BLOCK_RE = /<rules>\n?([\s\S]*?)\n?<\/rules>/;
const EXAMPLES_BLOCK_RE = /<examples>\n?([\s\S]*?)\n?<\/examples>/;
const NO_TEMPERATURE_APIS = new Set(["openai-codex-responses"]);

const extractBlock = (source: string, re: RegExp): string => {
	const m = source.match(re);
	return m ? m[1]!.trim() : "";
};

const BUILTIN_RULES = extractBlock(DEFAULT_SYSTEM_TEMPLATE, RULES_BLOCK_RE);
const BUILTIN_EXAMPLES = extractBlock(
	DEFAULT_SYSTEM_TEMPLATE,
	EXAMPLES_BLOCK_RE,
);

function render(template: string, vars: Record<string, string>): string {
	return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key) =>
		Object.hasOwn(vars, key) ? vars[key] : whole,
	);
}

function firstTextContent(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.map((part: unknown) => {
			if (
				part &&
				typeof part === "object" &&
				(part as { type?: string }).type === "text"
			) {
				return String((part as { text?: string }).text ?? "");
			}
			return "";
		})
		.filter(Boolean)
		.join("\n");
}

function entryText(entry: SessionEntry): string | undefined {
	if (entry.type !== "message") return undefined;
	const m = entry.message;
	if (m.role === "user") return `[user] ${firstTextContent(m.content)}`;
	if (m.role === "assistant")
		return `[assistant] ${firstTextContent(m.content)}`;
	if (m.role === "toolResult")
		return `[tool:${m.toolName}] ${firstTextContent(m.content)}`;
	return undefined;
}

function latestUserPrompt(branch: SessionEntry[]): string | undefined {
	for (let i = branch.length - 1; i >= 0; i--) {
		const entry = branch[i];
		if (entry?.type === "message" && entry.message.role === "user")
			return firstTextContent(entry.message.content);
	}
	return undefined;
}

function isCommandInput(text: string): boolean {
	return /^\s*\/[\w:-]+/.test(text);
}

function commandName(text: string): string | undefined {
	return text.match(/^\s*\/([^\s]+)/)?.[1]?.toLowerCase();
}

function resolveConfiguredModel(
	value: string | undefined,
	current: Model<any> | undefined,
): { provider: string; id: string } | undefined {
	const resolved = value?.trim() || "auto";
	if (isAutoTitleModelValue(resolved)) return undefined;
	if (resolved === "inherit")
		return current ? { provider: current.provider, id: current.id } : undefined;
	const slash = resolved.indexOf("/");
	if (slash <= 0)
		return current ? { provider: current.provider, id: resolved } : undefined;
	return { provider: resolved.slice(0, slash), id: resolved.slice(slash + 1) };
}

function sessionTitle(session: SessionInfo): string | undefined {
	return session.name?.trim() || session.firstMessage?.trim() || undefined;
}

async function collectSessionTitles(ctx: ExtensionContext): Promise<string[]> {
	try {
		const current = ctx.sessionManager.getSessionFile();
		const dir = SettingsManager.create(ctx.cwd, getAgentDir()).getSessionDir();
		return (await SessionManager.list(ctx.cwd, dir))
			.filter((s) => s.path !== current)
			.map(sessionTitle)
			.filter((t): t is string => Boolean(t))
			.slice(0, 15);
	} catch {
		return [];
	}
}

async function collectGit(pi: ExtensionAPI): Promise<WorkspaceContext["git"]> {
	try {
		const [br, st] = await Promise.all([
			pi.exec("git", ["branch", "--show-current"], { timeout: 1500 }),
			pi.exec("git", ["status", "--short"], { timeout: 1500 }),
		]);
		return {
			branch: br.stdout.trim() || undefined,
			dirty: st.stdout
				.split("\n")
				.map((l) => l.trim())
				.filter(Boolean)
				.slice(0, 15),
		};
	} catch {
		return undefined;
	}
}

function collectPackageName(cwd: string): string | undefined {
	try {
		const p = join(cwd, "package.json");
		if (!existsSync(p)) return undefined;
		const pkg = JSON.parse(readFileSync(p, "utf8")) as { name?: unknown };
		return typeof pkg.name === "string" ? pkg.name : undefined;
	} catch {
		return undefined;
	}
}

async function collectTrackedFiles(pi: ExtensionAPI): Promise<string[]> {
	try {
		const r = await pi.exec("git", ["ls-files"], { timeout: 1500 });
		return r.stdout.split("\n").filter(Boolean).slice(0, 30);
	} catch {
		return [];
	}
}

async function collectWorkspace(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
): Promise<WorkspaceContext> {
	const [sessionTitles, git, trackedFiles] = await Promise.all([
		collectSessionTitles(ctx),
		collectGit(pi),
		collectTrackedFiles(pi),
	]);
	return {
		sessionTitles,
		git,
		packageName: collectPackageName(ctx.cwd),
		trackedFiles,
	};
}

function resolvePromptSections(
	overrides: Partial<SessionTitlePromptOverrides> | undefined,
	builtinRules: string,
	builtinExamples: string,
): { replace: string; rules: string; examples: string } {
	const replace = overrides?.replace?.trim() || "";
	const userRules = overrides?.rules?.trim() || "";
	const userExamples = overrides?.examples?.trim() || "";

	const rules = userRules
		? replace
			? userRules
			: `${builtinRules}\n${userRules}`
		: builtinRules;
	const examples = userExamples
		? replace
			? userExamples
			: `${builtinExamples}\n${userExamples}`
		: builtinExamples;
	return { replace, rules, examples };
}

function configuredTitleMaxLength(
	titleConfig: SessionTitleGenerationConfig,
): number {
	const value = titleConfig.style.maxLength;
	return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 52;
}

function buildSystemPrompt(
	titleConfig: SessionTitleGenerationConfig,
	pending: PendingTitle,
	language: string,
): string {
	const maxLen = configuredTitleMaxLength(titleConfig);
	const style = titleConfig.style;
	const emojis = style.emojis;

	const styleSections = resolvePromptSections(
		style.prompt,
		BUILTIN_RULES,
		BUILTIN_EXAMPLES,
	);

	let finalRules = styleSections.rules;
	let finalExamples = styleSections.examples;
	if (pending.commandName && titleConfig.commandStrategy.prompt) {
		const cmdSections = resolvePromptSections(
			titleConfig.commandStrategy.prompt,
			finalRules,
			finalExamples,
		);
		finalRules = cmdSections.rules;
		finalExamples = cmdSections.examples;
	}

	const replace = styleSections.replace;
	const template = replace
		? replace
		: DEFAULT_SYSTEM_TEMPLATE.replace(
				RULES_BLOCK_RE,
				`<rules>\n${finalRules}\n</rules>`,
			).replace(EXAMPLES_BLOCK_RE, `<examples>\n${finalExamples}\n</examples>`);

	const emojiRule = emojis
		? "Emojis are allowed inside `<description>` only when they meaningfully clarify the topic"
		: "Never use emojis";

	return render(template, {
		max_length: String(maxLen),
		emoji_rule: emojiRule,
		fallback_datetime: fallbackDatetime(),
		rules: finalRules,
		examples: finalExamples,
		language,
	});
}

const DEFAULT_COMMAND_HINT =
	"This session was started with the user command `/{{command.name}}`. Make sure the title clearly reflects that — prefer using `{{command.name}}` (or a short normalized form) as the `<scope>`, e.g. `feat({{command.name}}): …`.";

function buildCommandHintBlock(
	pending: PendingTitle,
	titleConfig: SessionTitleGenerationConfig,
): string {
	if (!pending.commandName) return "";
	const tpl =
		titleConfig.commandStrategy.prompt.replace?.trim() || DEFAULT_COMMAND_HINT;
	const rendered = tpl.replace(
		/\{\{\s*command\.name\s*\}\}/g,
		pending.commandName,
	);
	return `<command-hint>\n${rendered}\n</command-hint>\n\n`;
}

function buildUserMessage(
	pending: PendingTitle,
	branch: SessionEntry[],
	titleConfig: SessionTitleGenerationConfig,
	workspace: WorkspaceContext,
	language: string,
): string {
	const ctx: string[] = [];
	ctx.push(`language: ${language}`);
	if (workspace.packageName) ctx.push(`project: ${workspace.packageName}`);
	if (workspace.git?.branch) ctx.push(`branch: ${workspace.git.branch}`);
	if (workspace.git?.dirty?.length)
		ctx.push(`dirty: ${workspace.git.dirty.slice(0, 8).join(", ")}`);
	if (workspace.trackedFiles?.length)
		ctx.push(`files: ${workspace.trackedFiles.slice(0, 20).join(", ")}`);
	const context_block = ctx.length
		? `<context>\n${ctx.join("\n")}\n</context>\n\n`
		: "";
	const existing_titles_block = workspace.sessionTitles?.length
		? `<existing-titles>\n${workspace.sessionTitles.join("\n")}\n</existing-titles>\n\n`
		: "";
	const command_hint_block = buildCommandHintBlock(pending, titleConfig);
	const branchText = branch
		.map(entryText)
		.filter(Boolean)
		.slice(-40)
		.join("\n");
	const content_block = branchText
		? `<conversation>\n${branchText}\n</conversation>`
		: `<message>\n${pending.rawInput ?? pending.firstPrompt ?? ""}\n</message>`;

	return render(DEFAULT_REQUEST_TEMPLATE, {
		context_block,
		existing_titles_block,
		command_hint_block,
		content_block,
	}).trimEnd();
}

function parseResult(
	raw: string,
	pending: PendingTitle,
	titleConfig: SessionTitleGenerationConfig,
): TitleResult {
	const maxLen = configuredTitleMaxLength(titleConfig);
	const inputText = pending.rawInput ?? pending.firstPrompt;
	const inputIsTrivial = isTrivialInput(inputText);
	const normalized = normalizeTitle(raw ?? "", maxLen);
	const isFallback = ISO_FALLBACK_RE.test(normalized);
	return { title: normalized, temporary: isFallback || inputIsTrivial };
}

type ResolvedTitleModel = {
	model: Model<any>;
	auth: { apiKey?: string; headers?: Record<string, string> };
};

async function resolveTitleModels(
	ctx: ExtensionContext,
	titleConfig: SessionTitleGenerationConfig,
	pending: PendingTitle,
): Promise<ResolvedTitleModel[]> {
	const configured = titleConfig.model?.trim() || "auto";
	const inheritModel = ctx.model;
	const resolveAuth = async (
		model: Model<any> | undefined,
	): Promise<ResolvedTitleModel | undefined> => {
		if (!model) return undefined;
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) return undefined;
		return { model, auth };
	};

	if (configured === "inherit") {
		const r = await resolveAuth(inheritModel);
		return r ? [r] : [];
	}
	if (!isAutoTitleModelValue(configured)) {
		const modelRef = resolveConfiguredModel(configured, inheritModel);
		const model = modelRef
			? ctx.modelRegistry.find(modelRef.provider, modelRef.id)
			: inheritModel;
		const r = await resolveAuth(model);
		return r ? [r] : [];
	}

	const usage = ctx.getContextUsage();
	const currentContextTokens = usage?.tokens ?? null;
	const forceCurrentContextCheck =
		pending.force === true && pending.reason === "manual-auto";
	const available = ctx.modelRegistry.getAvailable().map((model) => ({
		provider: model.provider,
		id: model.id,
		contextWindow: model.contextWindow,
	}));
	const picked = pickAutoTitleModels({
		availableModels: available,
		forceCurrentContextCheck,
		currentContextTokens,
	});

	const out: ResolvedTitleModel[] = [];
	const seen = new Set<string>();
	for (const ref of picked) {
		const model = ctx.modelRegistry.find(ref.provider, ref.id);
		const r = await resolveAuth(model);
		if (r) {
			const key = `${r.model.provider}/${r.model.id}`;
			if (!seen.has(key)) {
				seen.add(key);
				out.push(r);
			}
		}
	}
	const inherit = await resolveAuth(inheritModel);
	if (inherit) {
		const key = `${inherit.model.provider}/${inherit.model.id}`;
		if (!seen.has(key)) out.push(inherit);
	}
	return out;
}

async function requestTitle(
	model: Model<any>,
	auth: { apiKey?: string; headers?: Record<string, string> },
	systemPrompt: string,
	userMessage: string,
): Promise<string> {
	const message = await completeSimple(
		model,
		{
			systemPrompt,
			messages: [{ role: "user", content: userMessage, timestamp: Date.now() }],
		},
		{
			apiKey: auth.apiKey,
			headers: auth.headers,
			maxTokens: 80,
			...(NO_TEMPERATURE_APIS.has(model.api) ? {} : { temperature: 0.3 }),
		},
	);
	return firstTextContent(message.content);
}

async function loadConfig(ctx: ExtensionContext): Promise<PiConfig> {
	try {
		return (await loadPiConfig(ctx.cwd)).config;
	} catch {
		return DEFAULT_PI_CONFIG;
	}
}

export async function generateSessionTitleNow(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	options: { force?: boolean; reason?: PendingTitle["reason"] } = {},
): Promise<TitleResult | undefined> {
	const config = await loadConfig(ctx);
	const titleConfig = config.session.titleGeneration;
	if (titleConfig.enabled === false) return undefined;
	const branch = ctx.sessionManager.getBranch();
	const prompt = latestUserPrompt(branch) ?? pi.getSessionName() ?? "";
	const pending: PendingTitle = {
		firstPrompt: prompt,
		rawInput: prompt,
		waitTurns: 0,
		turnsSeen: 0,
		reason: options.reason ?? "manual-auto",
		force: options.force,
	};
	return generateTitle(pi, ctx, config, titleConfig, pending);
}

async function generateTitle(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	config: PiConfig,
	titleConfig: SessionTitleGenerationConfig,
	pending: PendingTitle,
): Promise<TitleResult | undefined> {
	if (
		shouldSkipAutoTitle(ctx, pi, {
			allowTemporaryRetry: true,
			force: pending.force,
		})
	) {
		return undefined;
	}

	const candidates = await resolveTitleModels(ctx, titleConfig, pending);
	if (candidates.length === 0) return undefined;

	if (ctx.hasUI) ctx.ui.setStatus("session-title", "naming session…");
	try {
		const branch = ctx.sessionManager.getBranch();
		const workspace = await collectWorkspace(pi, ctx);
		const language = config.user.preferences.language || "English";
		const systemPrompt = buildSystemPrompt(titleConfig, pending, language);
		const userMessage = buildUserMessage(
			pending,
			branch,
			titleConfig,
			workspace,
			language,
		);

		let usedModel: Model<any> | undefined;
		let raw = "";
		for (let i = 0; i < candidates.length; i++) {
			const { model, auth } = candidates[i];
			try {
				raw = await requestTitle(model, auth, systemPrompt, userMessage);
				if (process.env.PI_DEBUG_SESSION_TITLE) {
					console.warn(
						`[session-title] raw from ${model.provider}/${model.id}: ${JSON.stringify(raw)}`,
					);
				}
				if (raw && raw.trim().length > 0) {
					usedModel = model;
					break;
				}
				// Empty reply: try next candidate if available.
				if (i < candidates.length - 1) {
					console.warn(
						`[session-title] model ${model.provider}/${model.id} returned empty title; trying next candidate`,
					);
					continue;
				}
				usedModel = model;
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				console.warn(
					`[session-title] model ${model.provider}/${model.id} failed: ${msg}`,
				);
				if (i < candidates.length - 1) continue;
				// Last candidate: surface so the user sees why we fell back.
				if (ctx.hasUI) {
					ctx.ui.notify(
						`Title generation failed on all auto-title models (last: ${model.provider}/${model.id}): ${msg}`,
						"warning",
					);
				}
				usedModel = model;
			}
		}
		const model = usedModel ?? candidates[0].model;

		if (
			shouldSkipAutoTitle(ctx, pi, {
				allowTemporaryRetry: true,
				force: pending.force,
			})
		) {
			return undefined;
		}

		const result = parseResult(raw, pending, titleConfig);
		pi.setSessionName(result.title);
		markAutoTitle(
			pi,
			result.title,
			`${model.provider}/${model.id}`,
			result.temporary,
		);
		if (ctx.hasUI) {
			ctx.ui.setTitle(result.title);
		}
		emitSessionTitleMessage(
			pi,
			{
				title: result.title,
				actor: `${model.provider}/${model.id}`,
				source: "auto",
				temporary: result.temporary,
			},
			{ ctx },
		);
		return result;
	} finally {
		if (ctx.hasUI) ctx.ui.setStatus("session-title", undefined);
	}
}

export function registerSessionAutoTitle(
	pi: ExtensionAPI,
	initialConfig = DEFAULT_PI_CONFIG,
): void {
	const titleConfig = initialConfig.session.titleGeneration;
	if (titleConfig.enabled === false) return;

	let pending: PendingTitle | undefined;
	let lastRawInput: string | undefined;
	let generating = false;
	let temporaryTurns = 0;
	let temporaryRetries = 0;

	function makePending(
		prompt: string,
		rawInput: string | undefined,
		reason: PendingTitle["reason"],
		config: SessionTitleGenerationConfig,
		waitTurns?: number,
	): PendingTitle {
		const isCmd = Boolean(rawInput && isCommandInput(rawInput));
		return {
			firstPrompt: prompt,
			rawInput,
			commandName: rawInput ? commandName(rawInput) : undefined,
			waitTurns:
				waitTurns ??
				(isCmd ? Math.max(0, config.commandStrategy.waitTurns) : 0),
			turnsSeen: 0,
			reason,
		};
	}

	function scheduleGeneration(ctx: ExtensionContext, snapshot = pending): void {
		if (
			!snapshot ||
			generating ||
			shouldSkipAutoTitle(ctx, pi, { allowTemporaryRetry: true })
		) {
			return;
		}
		generating = true;
		void (async () => {
			try {
				const config = await loadConfig(ctx);
				const result = await generateTitle(
					pi,
					ctx,
					config,
					config.session.titleGeneration,
					snapshot,
				);
				if (pending === snapshot) pending = undefined;
				if (result?.temporary) {
					temporaryTurns = 0;
					temporaryRetries++;
				} else if (result) {
					temporaryRetries = 0;
				}
			} catch (error) {
				if (ctx.hasUI)
					ctx.ui.notify(
						`Title generation failed: ${error instanceof Error ? error.message : String(error)}`,
						"warning",
					);
			} finally {
				generating = false;
			}
		})();
	}

	pi.on("input", (event) => {
		if (event.source !== "interactive" && event.source !== "rpc")
			return { action: "continue" as const };
		lastRawInput = event.text;
		return { action: "continue" as const };
	});

	function consumeRawInputForPrompt(prompt: string): string | undefined {
		const rawInput = lastRawInput;
		lastRawInput = undefined;
		if (!rawInput) return undefined;
		if (rawInput === prompt) return rawInput;
		if (isCommandInput(rawInput)) return rawInput;
		return undefined;
	}

	pi.on("before_agent_start", async (event, ctx) => {
		const rawInput = consumeRawInputForPrompt(event.prompt);
		const config = await loadConfig(ctx);
		const currentTitleConfig = config.session.titleGeneration;
		const temporaryTitle = hasTemporaryAutoTitle(ctx);
		const shouldSkip = shouldSkipAutoTitle(ctx, pi, {
			allowTemporaryRetry: false,
		});
		if (
			!shouldCreateInitialTitlePending({
				pending: Boolean(pending),
				generating,
				titleGenerationEnabled: currentTitleConfig.enabled !== false,
				hasTemporaryTitle: temporaryTitle,
				shouldSkip,
			})
		) {
			return;
		}

		pending = makePending(
			event.prompt,
			rawInput,
			"initial",
			currentTitleConfig,
		);
		if (pending.waitTurns === 0) scheduleGeneration(ctx);
	});

	pi.on("turn_end", async (_event, ctx) => {
		const config = await loadConfig(ctx);
		const retryConfig = config.session.titleGeneration.retry;
		if (pending && !generating) {
			pending.turnsSeen++;
			if (pending.turnsSeen >= pending.waitTurns) scheduleGeneration(ctx);
			return;
		}
		if (
			!generating &&
			temporaryRetries < retryConfig.maxTemporaryRetries &&
			hasTemporaryAutoTitle(ctx) &&
			!shouldSkipAutoTitle(ctx, pi, { allowTemporaryRetry: true })
		) {
			temporaryTurns++;
			if (temporaryTurns >= retryConfig.temporaryAfterTurns) {
				const prompt = latestUserPrompt(ctx.sessionManager.getBranch()) ?? "";
				if (prompt) {
					pending = makePending(
						prompt,
						prompt,
						"temporary-fallback",
						config.session.titleGeneration,
						0,
					);
					scheduleGeneration(ctx);
				}
			}
		}
	});

	pi.on("agent_end", (_event, ctx) => {
		if (pending && !generating && pending.turnsSeen >= pending.waitTurns)
			scheduleGeneration(ctx);
	});

	pi.on("session_start", (_event, ctx) => {
		if (
			shouldSkipAutoTitle(ctx, pi, {
				allowTemporaryRetry: hasTemporaryAutoTitle(ctx),
			})
		) {
			pending = undefined;
		}
	});
}

export async function runAutoTitleCommand(
	pi: ExtensionAPI,
	ctx: ExtensionCommandContext,
): Promise<void> {
	// Fire-and-forget: don't block the slash command (or wait for the agent
	// to go idle) so the title is generated in the background while the
	// agent keeps working. The transcript message is injected by
	// `generateTitle` -> `emitSessionTitleMessage` once the LLM returns.
	void generateSessionTitleNow(pi, ctx, {
		force: true,
		reason: "manual-auto",
	})
		.then((result) => {
			if (!result && ctx.hasUI)
				ctx.ui.notify(
					"Could not generate a session title for the current context.",
					"warning",
				);
		})
		.catch((error) => {
			const msg = error instanceof Error ? error.message : String(error);
			if (ctx.hasUI)
				ctx.ui.notify(`Title generation failed: ${msg}`, "warning");
			else console.warn(`[session-title] manual /rename auto failed: ${msg}`);
		});
}
