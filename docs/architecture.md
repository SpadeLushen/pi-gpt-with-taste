# Architecture and compatibility

## Request-local behavior

The implementation targets pi 1.2.0, referenced at source commit `06a466935`. Compilation uses the published `@earendil-works/pi-coding-agent@1.2.0` declarations.

The relevant source path is:

1. `AgentSession.prompt()` expands input and either queues it or starts a run.
2. `_prepareRun()` emits `before_agent_start` for user or custom-message startup.
3. The low-level agent loop drains prepared/queued messages before dispatch.
4. `streamAssistantResponse()` applies the context transform before conversion to provider messages.
5. `ExtensionRunner.emitContext()` clones the transcript, runs ordinary context handlers, then `context_with_system` handlers.

The extension reads configuration during startup and adds no persistent message from `before_agent_start`. At the request boundary, it reads the current selected model and active branch overrides. Configuration loading is cached by agent directory, cwd, and trust state; file edits require `/taste reload` or pi's `/reload`.

`src/projection.ts` creates a new list, copies only the leading system message/section map it changes, and leaves content, tools, and other sections intact. Its reserved section is `gpt_with_taste`; its ephemeral custom message type is `gpt-with-taste:steer`. Prior additions using those reserved identifiers are removed from the request copy before rebuilding, making projection idempotent.

No projected instruction is passed to `sendMessage`, `sendUserMessage`, or a session-message append API. The projected list is converted and sent to the provider without replacing the canonical session transcript. Consequently the behavioral source itself is absent from compaction inputs and exported session messages; generated assistant answers remain normal history.

## Final-request compatibility guard

In pi 1.2.0, `AgentSession._installAgentForcedPromptProjection()` runs after the SDK's extension context transform. When `forceSystemPrompt` is set, it replaces every system message with one containing that forced text and current tools. This removes our named section while retaining custom-message reminders. pi-automode's `before_agent_start` handler uses this mechanism, which explains the observed reminder-only request.

The supported later hook is `before_provider_request`: SDK `onPayload` calls `ExtensionRunner.emitBeforeProviderRequest()` after provider serialization. For Codex Responses, `buildRequestBody()` produces `instructions`, and `options.onPayload` runs before transport dispatch.

`src/payload.ts` checks the actual instruction fields for the exact complete Main/Sub block. It appends only a missing block:

- Responses/Codex Responses: a payload with string `model`, array `input`, and absent/null/string `instructions`. Existing top-level instructions and system/developer input are checked before appending to `instructions`.
- Chat Completions: a payload with string `model` and array `messages`. An existing system/developer message with string or array content is required. Its role, existing content, and metadata are preserved.

User and tool content do not count as evidence of an installed Main block. The guard copies only fields it updates; it never edits original instruction text, tools, permission settings, or session history. Scope is evaluated again in the hook, including role and session overrides. It adds no request when inactive. Other payload formats are left untouched with a warning; no format is guessed.

The named-section path remains in place for provider-neutral operation when no forced prompt replaces it. The guard is idempotent for the same complete block, so ordinary requests do not receive two copies.

## Observing the guarded payload

`DefaultResourceLoader.reload()` in pi 1.2.0 orders entries with `mergePaths(cliEnabledExtensions, enabledExtensions)`. `mergePaths()` walks primary paths first and deduplicates canonical paths. This also applies to the installed 1.2.0 runtime, not only the source checkout.

The logger example writes a snapshot immediately in its `before_provider_request` handler. Since returned payloads are chained in extension order, loading only the logger with `-e` records before an auto-discovered taste guard. Such a log may contain user-steer but omit the Main block that a later handler adds.

For inspection, explicitly pass the actual installed taste entry as the first `-e` and the logger as the second. The auto-discovered same entry is deduplicated. No injection change or permission-setting change is needed to correct this observation order. A later handler can still modify the payload after that logger; inspect those handlers if contrary evidence remains.

## Input reminders

Only inputs after the last assistant message in the request receive reminders. Each user message in that suffix receives user-steer (Main) or sub-steer (explicit Sub). This covers queued messages by their actual delivery, not submission-time bookkeeping, so an aborted/cleared queue does not leave an orphan reminder.

Tool-result follow-ups normally have a later assistant tool-call message and get no repeated user reminder. Retries can reconstruct the same reminder for the same input, without accumulating duplicates or advancing a deduplication cursor before a successful response.

Unknown custom messages receive no reminder. Trusted integrations can explicitly whitelist completion-only custom types; their messages receive agent-steer in Main. The type is the integration's contract, not a heuristic completion detector.

## Scope and state

Scope uses exact selected provider membership AND one model-ID regex. It is evaluated for every agent-loop request, including continuations and retries. `model_select` only updates UI status; no cached match decision survives it.

Session overrides are full snapshots in non-model-context custom entries of type `gpt-with-taste:state`. Every decision reads the latest such entry on the active branch, including after resume, fork, tree navigation, compaction, or reload. `/taste reset` writes an empty snapshot.

Project JSON is read only after `ctx.isProjectTrusted()` is true. Invalid configuration pauses injection even if a session override enables the master switch. Changing directory or trust invalidates the configuration cache.

## Boundaries

- A current selected model is required; no selected model means no injection.
- Selected virtual provider/ID is matched, not its physical route. Explicitly allowing a virtual ID permits its routed requests regardless of their physical models.
- This package does not hook compaction summaries or independently dispatched calls made by other extensions through modelRegistry. Those paths are outside the agent-loop context transform.
- A leading pi system message is required. If another extension removes it, injection is skipped with a diagnostic rather than fabricating a replacement that could lose instructions or tools.
- Forced prompt projection can remove named sections. The final-request guard restores the complete behavioral block for supported OpenAI payload formats without altering the forced text or its permission guidance. Unsupported formats cannot recover through that guard. Later payload handlers can still supersede the result.
- Context-only reminders are not transcript UI entries; `display: false` is also set. Non-UI diagnostics use stderr.
- Turning off the extension removes its future request additions, not the effects already reflected in historical assistant responses.
- There is no permission gate or sandbox here. Existing pi permissions and project rules remain authoritative.
- Installing this source as a package does not initialize configuration, alter another package, or install a subagent scheduler.

## Resource layouts

Instruction loading selects the resource path from the directory containing `instructions.ts` (or its compiled `.js`). In `src/` or `dist/`, resources are read from `../resources/instructions/`. For a flat manual extension, they are read from `./resources/instructions/`.

There is no fallback to another extension's resources. All five files must be present in the selected directory. Missing files remain explicit load errors.

## Files

`src/config.ts`: JSON layers, validation, regex compilation.  
`src/scope.ts`: one authoritative scope decision.  
`src/state.ts`: active-branch switch snapshots.  
`src/instructions.ts`: resource loading and pi authority boundary.  
`src/projection.ts`: immutable request projection.  
`src/payload.ts`: append-only complete-instruction guard for supported OpenAI payloads.  
`src/extension.ts`: lifecycle registration and commands.  
`src/index.ts`: default Main factory and explicit package manifest entry.
