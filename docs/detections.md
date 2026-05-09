# Creating Detections

This guide explains how to add new security detections to Watchtower. The detection system is built around two concepts: **Analyzers** (which scope what files to inspect) and **Rules** (individual detection methods within an analyzer).

## Core Concepts

### The Finding Object

Every detection ultimately produces a `Finding` — the unit of output that gets displayed to the user, highlighted in the editor, and included in reports.

```typescript
interface Finding {
    type: FindingType     // Category of the finding (e.g., Task, InvisibleCode, GitHook)
    file: string          // Workspace-relative path to the file
    name: string          // Short title shown in notifications and the findings panel
    detail: string        // Longer explanation shown on hover and in reports
    priority: 'low' | 'medium' | 'high'  // Drives alert emoji and sort order
    range?: vscode.Range  // Optional: highlights the exact location in the editor
}
```

**Priority** controls both the alert emoji (`🔴` high, `🟠` medium, `🟡` low) and the sort order in the findings panel. Use `high` for things that are almost certainly malicious, `medium` for suspicious patterns, and `low` for things that are worth knowing about but likely benign.

**Range** is optional but recommended. When present, the finding can be highlighted inline in the editor and the user can click "Show Finding" to jump directly to the relevant code. Use the utility functions in `utils.ts` (`rangeFromJsonNode`, `rangeFromOffset`, `rangeOfKeyInText`) or compute ranges manually.

**FindingType** is an enum that categorizes findings. If your detection doesn't fit an existing type, add a new one to the `FindingType` enum in `types.ts`.

### Analyzers

An analyzer is a class that extends `StaticAnalyzer` and is responsible for a specific context — a file type, a folder structure, or a pattern. The idea is: **one analyzer per context, multiple rules within it**.

For example, `InvisibleCodeAnalyzer` handles all invisible Unicode detection (both trojan source and invisible characters), while `TaskAnalyzer` handles everything related to `.vscode/tasks.json`.

Every analyzer must implement three abstract methods:

```typescript
abstract class StaticAnalyzer {
    // Core detection: inspect the file and return findings
    abstract checkFile(uri: vscode.Uri, content?: Uint8Array): Promise<Finding[]>

    // File routing: should this analyzer run on the given file?
    abstract canScanFile(uri: vscode.Uri): boolean

    // Background edit monitoring: should this analyzer alert when its files
    // are modified while not being the active editor tab?
    abstract alertOnEditedInBackground(): boolean
}
```

**`canScanFile`** acts as a router. During a scan, every file is passed through every analyzer's `canScanFile` — only those that return `true` will have `checkFile` called. Keep this method fast (path/extension checks only, no file I/O).

**`checkFile`** is where the actual detection happens. It receives the file URI and optionally the file content (already read by the scan engine to avoid redundant reads). Call `this.ensureFileContent(uri, content)` to get the content if it wasn't provided. Return an array of findings.

**`alertOnEditedInBackground`** enables silent file change detection. When `true`, and the file is modified while not being the active editor tab, the base class automatically generates a `SilentFileChange` finding. This is useful for sensitive config files that shouldn't be modified by background processes (like AI agents).

### The `@rule` Decorator

Individual detection methods within an analyzer are annotated with the `@rule` decorator:

```typescript
@rule('rule-id', 'Human-readable description of what this rule detects')
public myDetectionMethod(text: string, uri: vscode.Uri): Finding[] {
    // detection logic
}
```

The decorator does two things:

1. **Registers the rule** in the global `RuleRegistry` at decoration time, making it discoverable by the settings UI so users can toggle it on/off
2. **Wraps the method** to short-circuit and return `[]` when the rule is disabled, so you don't need to check settings yourself

Rule IDs should be kebab-case and descriptive (e.g., `trojan-source`, `suspicious-task`, `json-schema-exfiltration`). They appear in the settings panel and can be disabled globally or per-workspace.

## Step-by-Step: Adding a New Detection

### 1. Decide: New Analyzer or Existing One?

- If an existing analyzer already covers the same file context (e.g., you want to detect something new in `tasks.json`), add a new `@rule`-decorated method to the existing analyzer.
- If you're targeting a new file type or context, create a new analyzer.

### 2. Create a New Analyzer (if needed)

Create a new file in `src/analyzers/`:

```typescript
import * as vscode from 'vscode'
import { rule } from '../rules'
import { Finding, FindingType } from '../types'
import { StaticAnalyzer } from './staticAnalyzer'

export class MyNewAnalyzer extends StaticAnalyzer {

    alertOnEditedInBackground(): boolean {
        return false // set true for sensitive config files
    }

    canScanFile(uri: vscode.Uri): boolean {
        // Only scan files this analyzer cares about
        return uri.fsPath.endsWith('.myextension')
    }

    async checkFile(uri: vscode.Uri, content?: Uint8Array): Promise<Finding[]> {
        const data = await this.ensureFileContent(uri, content)
        const text = new TextDecoder().decode(data)

        return [
            ...this.detectPatternA(text, uri),
            ...this.detectPatternB(text, uri),
        ]
    }

    @rule('pattern-a', 'Detects pattern A in .myextension files')
    public detectPatternA(text: string, uri: vscode.Uri): Finding[] {
        // Your detection logic here
        return []
    }

    @rule('pattern-b', 'Detects pattern B in .myextension files')
    public detectPatternB(text: string, uri: vscode.Uri): Finding[] {
        // Your detection logic here
        return []
    }
}
```

### 3. Register the Analyzer

Add your analyzer to the `allAnalyzers` array in `src/watchtower.ts`:

```typescript
private allAnalyzers: StaticAnalyzer[] = [
    // ... existing analyzers
    new MyNewAnalyzer(),
]
```

That's it. The scan engine will automatically route files through your analyzer based on `canScanFile`, and the `@rule` decorator handles settings integration.

### 4. Write Tests

Create a test file at `src/test/analyzers/myNewAnalyzer.test.ts`. Look at existing test files for patterns — they typically instantiate the analyzer directly and call `checkFile` with crafted URIs and content.

## Existing Analyzers Reference

| Analyzer | Context | Rules |
|---|---|---|
| `InvisibleCodeAnalyzer` | All files | `invisible-code`, `trojan-source` |
| `TaskAnalyzer` | `.vscode/tasks.json` | `suspicious-task` |
| `SettingsAnalyzer` | `.vscode/settings.json` | `custom-binary-path`, `ai-auto-approve`, `terminal-env-override` |
| `LaunchAnalyzer` | `.vscode/launch.json` | `suspicious-launch-config` |
| `JsonFile` | All `.json` files | `json-schema-exfiltration` |
| `GitHooksAnalyzer` | `.husky/`, `.githooks/` folders | `git-hooks` |
| `HooksPathReferenceAnalyzer` | `.md` files | `hooks-path-reference` |
| `AgentsAnalyzer` | AI agent files (`*.agent.md`, `AGENTS.md`, `.mcp.json`, etc.) | — (background edit only) |
| `DevContainerAnalyzer` | `.vscode/extensions.json` | — (threat intel check) |
