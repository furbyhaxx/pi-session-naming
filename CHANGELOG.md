# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses conventional commits.

## [0.2.0] - 2026-05-13

### Changed

- Simplified `session.titleGeneration` around the conventional title design.
- Replaced nested `style`, `fallback`, `commandStrategy`, and `retry` settings with flat `language`, `model`, `retries`, `emojis`, `maxLength`, `useTags`, `builtinTags`, and `tags` options.
- Made `--list-sessions` and `--json` fixed flags instead of configurable `session.list` settings.
- Updated title normalization so `maxLength` applies only to the generated description, not the tag/scope prefix.
- Prepared package metadata for npm publishing as `@furbyhaxx/pi-session-naming`.

### Added

- Added an internal built-in conventional title tag list with optional user tag merging.
- Added lightweight project metadata detection for common manifests including `Cargo.toml`, `pyproject.toml`, `pubspec.yaml`, `go.mod`, `composer.json`, JVM/Gradle, Ruby, Elixir, Deno, and `package.json`.
- Added `maxMessageCount` and `includeTools` title-generation settings and renamed the submitted transcript block to `<session-transcript>`.
- Added npm package publishing metadata and an MIT `LICENSE` file.
- Added unit tests for the simplified config schema, title tag handling, model reference parsing, and fixed listing flags.

## [0.1.0] - 2026-05-13

### Added

- Extracted the session naming extension as a standalone Pi package.
- Added automatic session title generation, `/rename`, `/sessions`, and `--list-sessions`.
- Added Pi `settings.json` configuration loading with `PI_CODING_AGENT_DIR` support.
- Added unit tests for settings merging, title normalization, scheduling, and model selection.

### Changed

- Replaced the old custom theme/message rendering dependency with Pi default theme tokens.
- Migrated configuration away from `Pi.yaml` while keeping snake-case aliases for old config keys.
