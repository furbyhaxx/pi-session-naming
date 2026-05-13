const TRIVIAL_INPUT_RE =
	/^\s*(hi+|hello+|hey+|yo+|sup|moin|servus|hallo|hola|test+|ok(ay)?|lol|lmao|huh|what|sure|thx|ty|ping|gm|gn|thanks|thank\s*you|\?+|\.+)\s*[!?.]*\s*$/i;
const ANSI_ESCAPE_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const TUI_BORDER_RE = /[\u2500-\u257f\u2580-\u259f]/;

export const CONVENTIONAL_TITLE_RE =
	/^[a-z][a-z0-9-]*(\([a-z0-9._/-]+\))?:\s.+\S$/;
export const ISO_FALLBACK_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

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

function isValidTitleCandidate(line: string, maxLen: number): boolean {
	if (line.length > maxLen) return false;
	if (TUI_BORDER_RE.test(line)) return false;
	return ISO_FALLBACK_RE.test(line) || CONVENTIONAL_TITLE_RE.test(line);
}

function extractTitlePrefix(line: string, maxLen: number): string | undefined {
	const limit = Math.min(line.length, maxLen);
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
		if (isValidTitleCandidate(candidate, maxLen)) return candidate;
	}
	return undefined;
}

export function normalizeTitle(raw: string, maxLen: number): string {
	const lines = (raw ?? "").split(/\r?\n/).map(cleanLine).filter(Boolean);

	// Prefer the first line that matches the conventional title format.
	for (const line of lines) {
		if (isValidTitleCandidate(line, maxLen)) return line;
		const prefix = extractTitlePrefix(line, maxLen);
		if (prefix) return prefix;
	}

	// Otherwise fall back to a deterministic datetime stamp.
	return fallbackDatetime();
}
