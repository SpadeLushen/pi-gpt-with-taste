# Explicit collaborator integration

The default package entry is Main. No standard pi child-agent lifecycle exists for this package to assume. Third-party tools must preserve their own models, tools, permissions, write areas, and leaf restrictions.

## Choose Sub explicitly

An integration extension can use the exported factory:

```typescript
import { createTasteExtension } from "pi-gpt-with-taste/integration";

export default createTasteExtension({ role: "sub" });
```

Load that entry in the child instead of the default Main entry. Install/configure the integration module's package dependency as appropriate for your extension. Do not load both entry points in the same session: they register the same command and reserved section.

Sub replaces only this package's behavioral source, not the child's role instructions. The same configuration and selected-model scope apply. A parent's session override is not automatically inherited by a separate child session.

If a child loader disables extensions or uses a separate agent directory, it must explicitly make this factory and configuration available. The bundled `resources/instructions/sub.md` is also available as a standalone role-composition source, but manually appending it bypasses this extension's scope and off switches.

## Completion-only custom messages

A trusted parent integration may declare types that mean a completed collaborator result:

```typescript
import { createTasteExtension } from "pi-gpt-with-taste/integration";

export default createTasteExtension({
  role: "main",
  completedResultTypes: ["my-collaborator:completed"],
});
```

The collaborator extension then delivers an actual result through a custom message of that exact type using pi's supported delivery behavior. Result content stays intact; this package inserts a request-only agent-steer reminder after it.

Only completed-result types belong in this list. Progress, timeouts, failures, and generic notifications must use other types. The package trusts the declared type's contract and does not inspect untrusted result prose for completion. It neither polls nor forces a continuation.

Tool-result-based collaborator integrations still need a concrete adapter that converts or signals their completion contract at the right boundary. None is enabled by default. Do not simply match a tool name and assume all its outputs completed successfully.
