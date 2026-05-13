# pi-session-naming

Standalone Pi extension package for automatic session titles, `/rename`, `/sessions`, and `--list-sessions`.

Extracted from `/Projects/furbyhaxx/pi-extensions/extensions/session` with the custom theme dependency removed. Rendering uses Pi's normal theme tokens (`accent`, `dim`, `warning`, `selectedBg`, etc.), so it follows the active Pi theme instead of shipping one. Because apparently even colors deserve boundaries.

## Install

From this checkout:

```bash
npm install
pi install ./
```

Temporary smoke load without installing:

```bash
pi -e ./
```

The package manifest exposes only:

```json
{
  "pi": {
    "extensions": ["./extensions/session/index.ts"]
  }
}
```

## Features

- Auto-generates a session title for unnamed sessions.
- Uses a lightweight configured model, or falls back through known title models and then the current session model.
- Avoids overwriting manual titles.
- Uses temporary datetime titles for trivial/vague prompts and retries later after meaningful activity.
- Adds `/rename [name]` and `/rename auto`.
- Adds `/sessions` for interactive project session browsing, switching, renaming, and deletion.
- Adds `--list-sessions [filter]` and `--json` for CLI listing.

## Configuration

Configuration lives in Pi's regular `settings.json`, not `Pi.yaml`.

Pi resolves global settings from:

```text
${PI_CODING_AGENT_DIR:-~/.pi/agent}/settings.json
```

Project settings override it from:

```text
./.pi/settings.json
```

This extension reads both scopes through Pi's `SettingsManager`, deep-merges only its own `user.preferences` and `session` blocks, and preserves the original camelCase config semantics. Snake-case aliases are also accepted for easier migration from the old YAML config.

### Example

```json
{
  "user": {
    "preferences": {
      "language": "English"
    }
  },
  "session": {
    "titleGeneration": {
      "enabled": true,
      "model": "auto",
      "commandStrategy": {
        "waitTurns": 3,
        "prompt": {
          "replace": "",
          "rules": "",
          "examples": ""
        }
      },
      "retry": {
        "temporaryAfterTurns": 10,
        "maxTemporaryRetries": 3
      },
      "style": {
        "format": "conventional",
        "emojis": false,
        "maxLength": 52,
        "fallback": "datetime",
        "prompt": {
          "replace": "",
          "rules": "",
          "examples": ""
        }
      }
    },
    "rename": {
      "enabled": true,
      "command": "rename",
      "interactiveWhenEmpty": true
    },
    "browser": {
      "enabled": true,
      "command": "sessions",
      "pageSize": 12,
      "showCwd": "auto",
      "delete": {
        "enabled": true,
        "useTrash": true,
        "confirmPresses": 2
      }
    },
    "list": {
      "enabled": true,
      "flag": "list-sessions",
      "jsonFlag": "json"
    }
  }
}
```

### Snake-case migration example

This also works in `settings.json`:

```json
{
  "session": {
    "title_generation": {
      "command_strategy": { "wait_turns": 2 },
      "retry": { "max_temporary_retries": 5 },
      "style": { "max_length": 60 }
    }
  }
}
```

## Commands and flags

```text
/rename                  Open an input prompt for the current session title
/rename <title>          Set a manual session title
/rename auto             Force title generation from current context
/sessions                Browse project sessions interactively
--list-sessions [filter] List project sessions and exit
--json                   Emit session listing as JSON when listing is active
```

## Development

```bash
npm install
npm run typecheck
npm run test
```

The unit tests cover title normalization, model selection, context filtering, title scheduling, and `settings.json` config merging with `PI_CODING_AGENT_DIR` support.
