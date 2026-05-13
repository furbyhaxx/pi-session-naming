# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project uses conventional commits.

## [0.1.0] - 2026-05-13

### Added

- Extracted the session naming extension as a standalone Pi package.
- Added automatic session title generation, `/rename`, `/sessions`, and `--list-sessions`.
- Added Pi `settings.json` configuration loading with `PI_CODING_AGENT_DIR` support.
- Added unit tests for settings merging, title normalization, scheduling, and model selection.

### Changed

- Replaced the old custom theme/message rendering dependency with Pi default theme tokens.
- Migrated configuration away from `Pi.yaml` while keeping snake-case aliases for old config keys.
