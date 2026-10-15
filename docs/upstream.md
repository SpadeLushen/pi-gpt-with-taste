# Upstream sources

Behavioral sources are adapted from [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste), commit `16b987d`.

## Included

- `prompts/main.md` → `resources/instructions/main.md`
- `prompts/sub.md` → `resources/instructions/sub.md`
- `prompts/user-steer.md` → `resources/instructions/user-steer.md`
- `prompts/sub-steer.md` → `resources/instructions/sub-steer.md`
- `prompts/agent-steer.md` → `resources/instructions/agent-steer.md`
- Upstream MIT license and copyright notices.

The sources retain the original behavioral substance. Adaptation changes current Codex session/tool references to pi, changes the illustrative `.codex/` bookkeeping path to `.pi/`, and normalizes line endings. `src/instructions.ts` supplies a pi-specific authorization boundary around the full source, rather than granting new verification or collaboration authority.

## Not included

Codex's config.toml overlay, Hooks process, plugin marketplace, installer/recovery receipt, tests, website, and visual assets are not ported. The upstream license's TOML-helper attribution is retained with its original text; that helper is not distributed here.

Original Codex comparison cases are not evidence of pi output quality. No behavioral testing or paid model calls were performed as part of this implementation.

## Host reference

The implementation was designed against pi 1.2.0 source, commit `06a466935`. Build dependencies pin the published 1.2.0 API for compilation. Host-provided packages remain peer dependencies with wildcard ranges as required by pi's package contract; the extension rejects a running host older than 1.2.0.
