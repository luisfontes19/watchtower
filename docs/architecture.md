# Architecture

Watchtower is a VS Code extension that scans workspaces for security threats — malicious configs, hidden code, supply chain attacks — and surfaces findings through notifications, inline highlights, and a sidebar panel. This document explains how the pieces fit together.

## Component Roles

### `extension.ts` — Wiring

The activation entry point. It does **no logic** — its job is to instantiate all components and wire them together:

- Creates singleton instances of `Settings` and `Watchtower`
- Registers all VS Code UI providers (sidebar views, tree views)
- Registers all commands, delegating each to a method on `Watchtower` or `report`
- Sets up file system watchers and event listeners (conditionally, based on settings)
- Triggers the initial scan

If you need to add a new command or listener, this is where it gets registered, but the implementation should live in `watchtower.ts`.

### `watchtower.ts` — Orchestration

The central singleton that owns all scan logic and state. It holds:

- The `findings` array (all accumulated scan results)
- The list of all analyzer instances
- References to all UI providers (to push updates)

**Scan engine:** `scanFile()` is the core method. It takes a file URI, checks it against excluded patterns, reads content once, then fans out to all analyzers whose `canScanFile()` returns `true`. Both `checkFile()` and `runBackgroundEditedCheck()` run in parallel via `Promise.all`. The full workspace scan (`runScan()`) simply iterates all workspace files through `scanFile()`.

**Event handling:** File system events (`onFileCreated`, `onFileChanged`, `onFileOpened`, `onActiveEditorChanged`) feed into `scanFile()` with deduplication logic. Extension change events (`onExtensionsChanged`) go through a separate path using `ThreatIntel` to check newly installed extensions against the Aikido malware database.

**UI coordination:** After every scan, `updateViews()` pushes the current findings to all providers. `setInlineFindings()` applies editor decorations. `alertFindings()` shows VS Code notification toasts.

### `analyzers/` — Detection Logic

Each analyzer extends `StaticAnalyzer` and encapsulates detection for a specific context. See [detections.md](detections.md) for the full guide on creating analyzers and rules.

The key design principle: **analyzers are stateless and isolated**. They receive a file and return findings. They don't know about other analyzers, the UI, or the scan lifecycle. This makes them easy to test independently.

The `StaticAnalyzer` base class provides:
- `runBackgroundEditedCheck()` — auto-generates `SilentFileChange` findings for sensitive files modified in the background
- `ensureFileContent()` — lazy file read helper to avoid redundant I/O
- `editedInBackground()` — checks if the file is the active editor tab

### `rules.ts` — Rule Registry & Decorator

The `@rule` decorator and `RuleRegistry` provide a way to make individual detections toggleable. When a method is decorated with `@rule('id', 'description')`, the rule is registered in a global registry and the method is wrapped to short-circuit when disabled.

The settings UI reads from `RuleRegistry.getAllRules()` to dynamically list all available rules with toggle controls — no manual UI registration needed.

### `providers/` — UI Layer

Four providers render Watchtower's sidebar:

| Provider | Type | Purpose |
|---|---|---|
| `FindingsTreeProvider` | WebviewView | Lists findings sorted by priority with color-coded severity dots. Handles "reveal finding" (open file + highlight range). |
| `FindingsOverviewProvider` | WebviewView | Summary dashboard showing total/high/medium/low counts in a grid. |
| `SettingsTreeProvider` | TreeDataProvider | Tree with collapsible groups for global and per-workspace settings. Dynamically lists all registered rules. |
| `ActionsTreeProvider` | TreeDataProvider | Simple action list (e.g., "Scan Extension for Malware"). |

Providers are **passive** — they don't fetch data. `Watchtower` pushes findings to them via `setFindings()`, and they re-render.

### `settings.ts` — Configuration

Singleton managing two layers of persistence:

- **Global state** (`context.globalState`): Cross-workspace data like known extensions and last version
- **Workspace state** (`context.workspaceState`): Per-workspace overrides keyed by workspace path — startup scan, real-time detection, excluded patterns, disabled rules
- **VS Code configuration** (`watchtower.*` in `settings.json`): User-facing settings like `startupScans`, `inlineFindings`, `autoUninstallMalicious`

Key decision methods like `shouldRunStartupScanForWorkspace()` merge global config with workspace overrides and workspace trust state.

### `threatIntel/` — External Intelligence

The `ThreatIntel` class queries the [Aikido Intel API](https://intel.aikido.dev) to check if a VS Code extension has been flagged as malware. Used in two flows:

1. **Real-time monitoring:** When `onExtensionsChanged` fires, newly installed extensions are checked and optionally auto-uninstalled
2. **Manual scan:** The "Scan Extension for Malware" command lets users check any extension ID on demand

### `report.ts` — Export

Two export formats: JSON (structured data with metadata) and HTML (styled report in a webview panel). Both are triggered via commands and operate on the current `findings` array.

### `dangerousCommands.ts` — Shared Patterns

A list of regex patterns matching commands commonly used for RCE or data exfiltration (`curl`, `wget`, `powershell`, `base64`, `netcat`, etc.). Used by multiple analyzers to flag suspicious commands in tasks, settings, and scripts.

## Key Design Decisions

**Singleton pattern for Watchtower and Settings.** Both are instantiated once during activation and shared across the extension. This avoids passing state through every function call and ensures a single source of truth for findings and configuration.

**Content read once, shared across analyzers.** During `scanFile()`, file content is read once and passed to all matching analyzers. This is important for performance on large workspaces and remote file systems.

**Analyzers are context-scoped, rules are method-scoped.** An analyzer targets a file type or context. Individual detections within it are separate `@rule`-decorated methods. This keeps the code organized (one class per concern) while giving users granular control over what's enabled.

**Providers don't pull, orchestrator pushes.** UI providers never call back into the scan engine. `Watchtower` calls `setFindings()` on providers after every scan, keeping the data flow unidirectional.

**Real-time scanning is conditional.** File system watchers are only active when `startupScans` is set to `OnEveryProject`. On untrusted workspaces or when scans are off, the watchers are not registered (or disposed on trust change).

## Where to Look

| I want to... | Look at... |
|---|---|
| Add a new detection | [detections.md](detections.md) and `src/analyzers/` |
| Add a new command | Register in `extension.ts`, implement in `watchtower.ts` |
| Change the sidebar UI | `src/providers/` |
| Add a new setting | `src/settings.ts` + `package.json` (contributes.configuration) |
| Modify scan behavior | `src/watchtower.ts` (`scanFile`, `runScan`) |
| Add a dangerous command pattern | `src/dangerousCommands.ts` |
| Update threat intelligence | `src/threatIntel/threatIntel.ts` |
| Write tests | `src/test/analyzers/` (mirror the analyzer file name) |
