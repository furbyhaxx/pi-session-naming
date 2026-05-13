# pi-session-naming

A [pi](https://github.com/earendil-works/pi) coding-agent extension for automatic session titles, manual session renaming, project session browsing, and session listing.

It uses pi's default theme tokens (`accent`, `dim`, `warning`, `selectedBg`, etc.), so rendering follows the active pi theme. No custom theme. Shocking restraint, really.

## Install

Install from GitHub:

```sh
pi install git:https://github.com/furbyhaxx/pi-session-naming
```

Or clone the repo and install from the local checkout:

```sh
git clone https://github.com/furbyhaxx/pi-session-naming
cd pi-session-naming
npm install
pi install path/to/cloned/repo
```

Load directly without installing:

```sh
pi -e path/to/cloned/repo
```

After npm publishing, the package is intended to install as:

```sh
pi install npm:@furbyhaxx/pi-session-naming
```

## Features

- Auto-generates a title for unnamed sessions.
- Generates conventional-style titles such as `fix(auth): refresh token flow`.
- Restricts scopes to a single lowercase alphanumeric word with configurable length, because `feat(pi-fancy-editor): ...` is chaos wearing a hat.
- Uses built-in title tags plus optional user-supplied tag guidance.
- Adds lightweight project context from common manifest files, not just npm packages.
- Can disable tags for plain description-only titles.
- Uses a configured lightweight model, or auto-selects a known title model.
- Retries title generation and falls back once to the current session model when different.
- Avoids overwriting manual titles.
- Uses temporary datetime titles for trivial/vague prompts and retries later after meaningful activity.
- Adds `/rename [name]` and `/rename auto`.
- Adds `/sessions` for interactive project session browsing, switching, renaming, and deletion.
- Adds fixed `--list-sessions [filter]` and `--json` CLI listing flags.

## Commands and flags

```text
/rename                  Open an input prompt for the current session title
/rename <title>          Set a manual session title
/rename auto             Force title generation from current context
/sessions                Browse project sessions interactively
--list-sessions [filter] List project sessions and exit
--json                   Emit session listing as JSON when listing is active
```

## Configuration

Configuration lives in pi's regular `settings.json`.

Global settings:

```text
${PI_CODING_AGENT_DIR:-~/.pi/agent}/settings.json
```

Project settings override global settings:

```text
./.pi/settings.json
```

This extension reads both scopes through pi's `SettingsManager` and deep-merges only its own `session.titleGeneration`, `session.rename`, and `session.browser` blocks. Snake-case aliases for the new keys are accepted (`title_generation`, `max_length`, `scope_max_length`, `use_tags`, `builtin_tags`, etc.). Unknown settings outside the current schema are ignored.

### Defaults

```json
{
  "session": {
    "titleGeneration": {
      "enabled": true,
      "language": "auto",
      "model": "auto",
      "retries": 3,
      "emojis": false,
      "maxLength": 52,
      "scopeMaxLength": 12,
      "maxMessageCount": -1,
      "includeTools": true,
      "useTags": true,
      "builtinTags": true,
      "tags": []
    },
    "browser": {
      "enabled": true,
      "command": "sessions",
      "pageSize": 12,
      "delete": {
        "enabled": true,
        "useTrash": true,
        "confirmPresses": 2
      }
    },
    "rename": {
      "enabled": true,
      "command": "rename",
      "interactiveWhenEmpty": true
    }
  }
}
```

### Title generation options

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Enables automatic title generation. |
| `language` | `"auto"` | `auto` tells the LLM to use the user's message language; any other string instructs that language. |
| `model` | `"auto"` | `auto`, or `{provider}/{model}{:thinking}` such as `deepseek/deepseek-v4-flash` or `deepseek/deepseek-v4-flash:high`. |
| `retries` | `3` | Number of attempts for the selected title model before trying the current session model once when different. |
| `emojis` | `false` | Allows or forbids emojis in generated titles. |
| `maxLength` | `52` | Maximum length of the description part after the tag, e.g. only `choco cookies` in `research(recipe): choco cookies`. |
| `scopeMaxLength` | `12` | Maximum length for optional scopes. Scopes are normalized to lowercase and must be one alphanumeric word: `auth`, not `auth-service`. |
| `maxMessageCount` | `-1` | Maximum number of latest textified message entries from the active session branch sent inside `<session-transcript>`. `0` or `-1` sends the whole branch transcript. |
| `includeTools` | `true` | Includes textified tool-result messages in `<session-transcript>`. When `false`, only user and assistant text messages are sent. |
| `useTags` | `true` | Enables the prefixed tag format (`research(recipe): ...`). When `false`, titles are plain descriptions. |
| `builtinTags` | `true` | Enables the built-in tag list. When `false`, only user-provided `tags` are available. |
| `tags` | `[]` | Additional lowercase custom tags. Entries may be strings (`"meet"`) or `["name", "guidance"]` pairs. Invalid tags are ignored. |

### Built-in title tags

Built-in tags include short model-facing guidance for when each tag should apply:

```text
feat, add, fix, refactor, perf, style, test, bench, docs, build, ops, chore,
onboard, scaffold, bootstrap, init, skill, analyze, audit, review, research,
investigate, debug, troubleshoot, plan, design, propose, compare, evaluate,
explain, summarize, document, configure, migrate, prototype, validate, wire
```

### Example

```json
{
  "session": {
    "titleGeneration": {
      "language": "auto",
      "model": "github-copilot/gpt-5.4-mini:low",
      "retries": 3,
      "emojis": false,
      "maxLength": 52,
      "scopeMaxLength": 12,
      "maxMessageCount": -1,
      "includeTools": true,
      "useTags": true,
      "builtinTags": true,
      "tags": [
        ["cook", "Use when cooking"],
        ["book", "Use when reading or writing about books"],
        "meet"
      ]
    }
  }
}
```

To use only your own tag list:

```json
{
  "session": {
    "titleGeneration": {
      "builtinTags": false,
      "tags": [["cook", "Use when cooking"], "book", "meet"]
    }
  }
}
```

## Title-generation project context

For title generation, the extension sends compact project identity metadata when it can detect it. It does **not** send full manifest files. It also sends the configured textified session branch inside `<session-transcript>`.

By default, `maxMessageCount: -1` sends all textified user/assistant/tool-result message entries from the active session branch. Set a positive `maxMessageCount` to send only the latest N entries, or set `includeTools: false` to omit tool-result messages.

Project metadata is sent as a single context line like:

```text
projects: rust:furbyhaxx-core (Cargo.toml), python:furbyhaxx-tools (pyproject.toml)
```

Detected manifests include `package.json`, `Cargo.toml`, `pyproject.toml`, `pubspec.yaml`, `go.mod`, `composer.json`, `pom.xml`, Gradle settings/build files, `.gemspec`, `mix.exs`, and `deno.json`/`deno.jsonc`.

## Package manifest

The pi package manifest exposes only the session extension entry point:

```json
{
  "pi": {
    "extensions": ["./extensions/session/index.ts"]
  }
}
```

## Development

```sh
npm install
npm run typecheck
npm test
npm pack --dry-run
```

Pi loads the TypeScript source directly; the build script only typechecks and does not emit artifacts.
