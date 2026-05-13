const TRIVIAL_INPUT_RE =
	/^\s*(hi+|hello+|hey+|yo+|sup|moin|servus|hallo|hola|test+|ok(ay)?|lol|lmao|huh|what|sure|thx|ty|ping|gm|gn|thanks|thank\s*you|\?+|\.+)\s*[!?.]*\s*$/i;
const ANSI_ESCAPE_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const TUI_BORDER_RE = /[\u2500-\u257f\u2580-\u259f]/;
const TAG_RE = /^[a-z][a-z0-9-]*$/;

export const BUILTIN_TITLE_TAGS = [
	"feat",
	"add",
	"fix",
	"refactor",
	"perf",
	"style",
	"test",
	"bench",
	"docs",
	"build",
	"ops",
	"chore",
	"analyze",
	"audit",
	"review",
	"research",
	"investigate",
	"debug",
	"troubleshoot",
	"plan",
	"design",
	"propose",
	"compare",
	"evaluate",
	"explain",
	"summarize",
	"document",
	"configure",
	"migrate",
	"prototype",
	"validate",
	"wire",
] as const;

export const CONVENTIONAL_TITLE_RE =
	/^([a-z][a-z0-9-]*)(\([a-z0-9._/-]+\))?:\s(.+\S)$/u;
export const ISO_FALLBACK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

export type TitleTagConfig = {
	builtinTags: boolean;
	tags: string[];
};

export type NormalizeTitleOptions = {
	maxLength: number;
	useTags: boolean;
	tags: readonly string[];
};

export function resolveTitleTags(config: TitleTagConfig): string[] {
	const out: string[] = config.builtinTags ? [...BUILTIN_TITLE_TAGS] : [];
	const seen = new Set(out);
	for (const raw of config.tags ?? []) {
		const tag = raw.trim().toLowerCase();
		if (!TAG_RE.test(tag)) continue;
		if (seen.has(tag)) continue;
		seen.add(tag);
		out.push(tag);
	}
	return out;
}

export function fallbackDatetime(now: Date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const offMinutes = -now.getTimezoneOffset();
	const sign = offMinutes >= 0 ? "+" : "-";
	const offH = pad(Math.floor(Math.abs(offMinutes) / 60));
	const offM = pad(Math.abs(offMinutes) % 60);
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
	return `${date}T${time}${sign}${offH}:${offM}`;
}

export function isTrivialInput(text: string | undefined | null): boolean {
	if (!text) return true;
	const t = text.trim();
	if (t.length < 3) return true;
	return TRIVIAL_INPUT_RE.test(t);
}

function cleanLine(line: string): string {
	return line
		.replace(ANSI_ESCAPE_RE, "")
		.replace(CONTROL_CHARS_RE, "")
		.trim()
		.replace(/^[\s>*_~`"'\u201C\u2018-]+/, "")
		.replace(/[`"'\u201D\u2019\s*_~]+$/, "")
		.trim()
		.replace(/[.\s]+$/g, "");
}

function configuredMaxLength(value: number): number {
	return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 52;
}

function titleParts(line: string):
	| { tag: string; description: string }
	| undefined {
	const match = line.match(CONVENTIONAL_TITLE_RE);
	if (!match) return undefined;
	return { tag: match[1]!, description: match[3]! };
}

function titleDescription(line: string): string | undefined {
	return titleParts(line)?.description;
}

function isValidTaggedTitle(
	line: string,
	maxLength: number,
	tags: readonly string[],
): boolean {
	const parts = titleParts(line);
	return Boolean(
		parts && tags.includes(parts.tag) && parts.description.length <= maxLength,
	);
}

function isValidPlainTitle(line: string, maxLength: number): boolean {
	if (!line || line.length > maxLength) return false;
	if (TUI_BORDER_RE.test(line)) return false;
	return true;
}

function stripTag(line: string): string | undefined {
	const description = titleDescription(line);
	return description ? cleanLine(description) : undefined;
}

function isValidTitleCandidate(
	line: string,
	options: Required<NormalizeTitleOptions>,
): string | undefined {
	if (TUI_BORDER_RE.test(line)) return undefined;
	if (ISO_FALLBACK_RE.test(line)) return line;

	const maxLength = configuredMaxLength(options.maxLength);
	const effectiveUseTags = options.useTags && options.tags.length > 0;
	if (effectiveUseTags) {
		return isValidTaggedTitle(line, maxLength, options.tags)
			? line
			: undefined;
	}

	const untagged = stripTag(line) ?? line;
	return isValidPlainTitle(untagged, maxLength) ? untagged : undefined;
}

function extractTitlePrefix(
	line: string,
	options: Required<NormalizeTitleOptions>,
): string | undefined {
	const limit = Math.min(line.length, 260);
	for (let end = limit; end > 0; end--) {
		const previous = line[end - 1];
		const next = line[end];
		if (
			next &&
			/[\p{L}\p{N}._/-]/u.test(previous ?? "") &&
			/[\p{L}\p{N}._/-]/u.test(next)
		)
			continue;
		const candidate = cleanLine(line.slice(0, end));
		const valid = isValidTitleCandidate(candidate, options);
		if (valid) return valid;
	}
	return undefined;
}

export function normalizeTitle(
	raw: string,
	options: NormalizeTitleOptions,
): string {
	const normalizedOptions: Required<NormalizeTitleOptions> = {
		maxLength: configuredMaxLength(options.maxLength),
		useTags: options.useTags,
		tags: options.tags,
	};
	const lines = (raw ?? "").split(/\r?\n/).map(cleanLine).filter(Boolean);

	for (const line of lines) {
		const valid = isValidTitleCandidate(line, normalizedOptions);
		if (valid) return valid;
		if (TUI_BORDER_RE.test(line)) {
			const prefix = extractTitlePrefix(line, normalizedOptions);
			if (prefix) return prefix;
		}
	}

	return fallbackDatetime();
}
