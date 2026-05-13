import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent";

export interface PiConfig {
	version: number;
	user: {
		preferences: {
			language: string;
		};
	};
	session: SessionConfig;
}

export type SessionTitleFormat = "conventional";
export type SessionTitleFallback = "datetime";

export interface SessionTitlePromptOverrides {
	replace: string;
	rules: string;
	examples: string;
}

export interface SessionTitleGenerationConfig {
	enabled: boolean;
	model: string;
	commandStrategy: {
		waitTurns: number;
		prompt: SessionTitlePromptOverrides;
	};
	retry: {
		temporaryAfterTurns: number;
		maxTemporaryRetries: number;
	};
	style: {
		format: SessionTitleFormat;
		emojis: boolean;
		maxLength: number;
		fallback: SessionTitleFallback;
		prompt: SessionTitlePromptOverrides;
	};
}

export interface SessionRenameConfig {
	enabled: boolean;
	command: string;
	interactiveWhenEmpty: boolean;
}

export interface SessionBrowserConfig {
	enabled: boolean;
	command: string;
	pageSize: number;
	showCwd: "auto" | "always" | "never";
	delete: {
		enabled: boolean;
		useTrash: boolean;
		confirmPresses: number;
	};
}

export interface SessionListConfig {
	enabled: boolean;
	flag: string;
	jsonFlag: string;
}

export interface SessionConfig {
	titleGeneration: SessionTitleGenerationConfig;
	rename: SessionRenameConfig;
	browser: SessionBrowserConfig;
	list: SessionListConfig;
}

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends Array<infer U>
		? U[]
		: T[P] extends object
			? DeepPartial<T[P]>
			: T[P];
};

export interface LoadedPiConfig {
	config: PiConfig;
	sources: string[];
}

export const DEFAULT_SESSION_NAMING_CONFIG: PiConfig = {
	version: 1,
	user: {
		preferences: {
			language: "English",
		},
	},
	session: {
		titleGeneration: {
			enabled: true,
			model: "auto",
			commandStrategy: {
				waitTurns: 3,
				prompt: {
					replace: "",
					rules: "",
					examples: "",
				},
			},
			retry: {
				temporaryAfterTurns: 10,
				maxTemporaryRetries: 3,
			},
			style: {
				format: "conventional",
				emojis: false,
				maxLength: 52,
				fallback: "datetime",
				prompt: {
					replace: "",
					rules: "",
					examples: "",
				},
			},
		},
		rename: {
			enabled: true,
			command: "rename",
			interactiveWhenEmpty: true,
		},
		browser: {
			enabled: true,
			command: "sessions",
			pageSize: 12,
			showCwd: "auto",
			delete: {
				enabled: true,
				useTrash: true,
				confirmPresses: 2,
			},
		},
		list: {
			enabled: true,
			flag: "list-sessions",
			jsonFlag: "json",
		},
	},
};

export const DEFAULT_PI_CONFIG = DEFAULT_SESSION_NAMING_CONFIG;

type SettingsWithSessionNaming = {
	version?: number;
	user?: DeepPartial<PiConfig["user"]>;
	session?: DeepPartial<SessionConfig>;
};

export function loadSessionNamingConfig(
	cwd: string,
	agentDir = getAgentDir(),
): LoadedPiConfig {
	const manager = SettingsManager.create(cwd, agentDir);
	let config = clone(DEFAULT_SESSION_NAMING_CONFIG);

	const globalSettings = normalizeConfigAliases(
		manager.getGlobalSettings(),
	) as SettingsWithSessionNaming;
	const projectSettings = normalizeConfigAliases(
		manager.getProjectSettings(),
	) as SettingsWithSessionNaming;

	config = mergeSettingsConfig(config, globalSettings);
	config = mergeSettingsConfig(config, projectSettings);

	return {
		config,
		sources: settingsSources(cwd, agentDir),
	};
}

export async function loadPiConfig(cwd: string): Promise<LoadedPiConfig> {
	return loadSessionNamingConfig(cwd, getAgentDir());
}

function mergeSettingsConfig(
	base: PiConfig,
	settings: SettingsWithSessionNaming,
): PiConfig {
	return deepMerge(base, {
		version: settings.version,
		user: settings.user,
		session: settings.session,
	});
}

function settingsSources(cwd: string, agentDir: string): string[] {
	return [join(agentDir, "settings.json"), join(cwd, ".pi", "settings.json")].filter(
		(path) => existsSync(path),
	);
}

export function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
	if (override === undefined) return clone(base);
	if (!isPlainObject(base) || !isPlainObject(override)) {
		return clone(override as T);
	}

	const merged: Record<string, unknown> = {
		...(base as Record<string, unknown>),
	};
	for (const [key, value] of Object.entries(override)) {
		if (value === undefined) continue;
		const current = merged[key];
		if (isPlainObject(current) && isPlainObject(value)) {
			merged[key] = deepMerge(current, value as Record<string, unknown>);
		} else {
			merged[key] = clone(value);
		}
	}
	return merged as T;
}

function normalizeConfigAliases(value: unknown): unknown {
	if (Array.isArray(value)) return value.map((item) => normalizeConfigAliases(item));
	if (!isPlainObject(value)) return value;

	return Object.fromEntries(
		Object.entries(value).map(([key, item]) => [
			snakeToCamel(key),
			normalizeConfigAliases(item),
		]),
	);
}

function snakeToCamel(key: string): string {
	return key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function clone<T>(value: T): T {
	if (Array.isArray(value)) return value.map((item) => clone(item)) as T;
	if (isPlainObject(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, clone(item)]),
		) as T;
	}
	return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
