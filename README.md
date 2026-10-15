# pi GPT with Taste

English · [简体中文](README.zh-CN.md)

Bring [GPT with Taste](https://github.com/NB-Corp/gpt-with-taste)'s judgment, sustained execution, engineering and visual craft, and reader-first communication to pi.

This extension adds behavioral instructions to matching model requests and short reminders to new user inputs. Instructions are written in English; replies follow the user's latest language. Your explicit persona, project rules, tools, and permissions remain authoritative.

## Quick start

Requires **Node.js 22.19+** and **pi 1.2.0+**. From the repository root, try it for one session:

```sh
pi -e ./src/index.ts
```

For persistent use, run from the same directory:

```sh
pi install ./
```

Start a new session or run `/reload`, then check `/taste status`. By default, the extension applies only when both conditions match:

- Provider is `openai` or `openai-codex`.
- Model ID matches `/^gpt-/` (case-sensitive).

Local installation references this checkout; keep it available. To uninstall, run `pi remove ./` from the same repository root, then restart or reload pi. User-created configuration is retained.

## Everyday controls

| Command | Action |
| --- | --- |
| `/taste` or `/taste status` | Show role, selected model, scope decision, reminders, overrides, and configuration sources |
| `/taste on` / `/taste off` | Enable or disable instructions for the current session branch |
| `/taste steer on` / `/taste steer off` | Enable or disable input reminders only |
| `/taste config` | Show effective configuration, file locations, and project trust |
| `/taste reload` | Reread configuration without clearing branch overrides |
| `/taste reset` | Clear branch overrides and follow configuration again |

Overrides survive session resume and extension reload, and follow forks and tree navigation. `/taste on` can override `enabled: false`, but cannot bypass model scope or configuration errors. Command output uses stderr outside the UI, keeping JSON/RPC stdout intact.

## Configure model scope

No configuration file is required. To customize the defaults, create:

```text
<agent-dir>/extensions/pi-gpt-with-taste/config.json
```

`<agent-dir>` defaults to `~/.pi/agent` and honors `PI_CODING_AGENT_DIR`. Use `/taste config` to find the location for your installation. The extension reads configuration but never creates or edits it.

Start with [config.example.json](config.example.json):

```json
{
  "enabled": true,
  "steering": true,
  "providers": ["openai", "openai-codex"],
  "modelIdPattern": "/^gpt-/"
}
```

After editing, run `/taste reload`.

- `providers` contains exact, case-sensitive pi provider IDs. Add custom providers explicitly; an empty list matches nothing.
- `modelIdPattern` is one `"/pattern/flags"` string matching `model.id`, not its display name or `provider/model`. It uses Node.js `RegExp` syntax; the last slash separates the pattern from its flags.
- Use `i` for case-insensitive matching and `^` / `$` to anchor a full match. Escape backslashes in JSON: `"/^gpt-6\\.1$/i"`. Stateful `g` / `y` positions reset for each match.
- Both provider and model conditions must match. An unknown model never matches.

### Project overrides

A trusted project can override individual fields in `.pi/gpt-with-taste.json` relative to its working directory. This file alone does not trigger pi's trust prompt; use pi's normal `/trust` workflow when needed.

Precedence is **built-in defaults → user configuration → trusted project configuration**. Provider lists and patterns replace inherited values rather than merging.

Invalid JSON, unknown fields, invalid types or regexes, and file-read errors pause all injection. A later layer cannot mask an invalid earlier one. Fix the affected file and run `/taste reload`.

## Manual installation

As an alternative to `pi install`, copy **all files inside `src/`**, plus `resources/` and `LICENSE`, into this layout:

```text
<agent-dir>/extensions/pi-gpt-with-taste/
├── index.ts
├── instructions.ts
├── … remaining source files
├── resources/
│   └── instructions/
│       ├── main.md
│       ├── sub.md
│       ├── user-steer.md
│       ├── sub-steer.md
│       └── agent-steer.md
├── LICENSE
└── config.json          # optional user configuration
```

For this flat layout, omit the original `package.json`, `node_modules/`, and `dist/`. Pi discovers `index.ts` and reads the adjacent instruction resources.

You can instead preserve the package layout by copying `package.json`, `src/`, `resources/`, and `LICENSE` together. The manifest loads `src/index.ts`, which reads resources from its parent directory.

Restart pi or run `/reload`. Use only one installation, and include all five instruction resources; source files alone are insufficient.

## How it works

For each model request, the extension checks the **selected** provider and model, adds the full Main instructions to a dedicated system section, and inserts hidden reminders after unanswered user inputs. This includes queued steering and follow-ups; ordinary tool continuations do not repeat reminders.

A final-request guard restores the complete instruction block if forced-system-prompt processing removed it. It supports OpenAI Responses/Codex Responses and Chat Completions payloads with an existing system/developer message. Existing instructions, including automode permission guidance, remain intact; an already-present complete block is not duplicated.

Instructions and reminders are request-local, not session entries. Only branch switch overrides are stored outside model context. The extension does not change models, reasoning levels, permissions, tools, MCP, project instructions, or skills, and initiates no extra model calls, turns, tests, or paid calls.

### Compatibility limits

- Scope follows the selected model, not a virtual model's dispatched physical target.
- Unsupported payload formats retain system-section injection but cannot recover from forced prompt replacement through the guard; a warning identifies this limitation.
- Later payload-rewriting extensions can still override the result.
- Turning the extension off removes future additions, not the influence of earlier instructions on historical responses.

Main is the default role. Explicit Sub instructions and completed-result reminders are available through the [collaborator integration API](docs/integration.md). Third-party subagents are not automatically rewritten, and no scheduler is included. See [architecture and compatibility](docs/architecture.md) for implementation details.

## Inspect instruction delivery

`/taste status` reports scope matching, not final delivery. For optional request inspection, load the actual installed taste entry **before** pi's `provider-payload.ts` logger example:

```sh
pi -e "<installed-taste-entry>" -e "<pi-source>/packages/coding-agent/examples/extensions/provider-payload.ts"
```

Replace both placeholders with your own locations. Use the installed `index.ts` for a flat layout or `src/index.ts` for a package layout, not another checkout. Pi deduplicates the same canonical entry even if it is also auto-discovered.

The current project needs an existing `.pi` directory. Send a new prompt and inspect the latest request in `.pi/provider-payload.log`. For Codex Responses, top-level `instructions` should contain `<gpt-with-taste>` and the full Main text; input reminders use `<gpt-with-taste-user-steer>`. A reminder alone does not establish full instruction delivery.

Pi 1.2.0 loads CLI `-e` extensions before auto-discovered ones and chains payload handlers in that order. Loading only the logger can record the request before the taste guard runs. Logs contain conversation content: keep them private and exit the temporary logging session to stop recording. New requests after `/taste off` no longer receive this package's instructions.

## Development

```sh
npm install --include=dev --ignore-scripts
npm run build
```

The build only compiles TypeScript. Pi loads source directly, so building is not required for use. Development dependencies do not upgrade your globally installed pi.

## Sources and license

Adapted from [NB-Corp/gpt-with-taste](https://github.com/NB-Corp/gpt-with-taste). See [upstream sources and adaptation notes](docs/upstream.md). Distributed under the [MIT license](LICENSE).
