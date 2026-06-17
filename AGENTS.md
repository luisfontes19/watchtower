# Instructions

This is a vscode extension written in typescript and it is a security agent that scans the user's workspace for potential security issues and alerts the user about them. It also has a side panel where users can see the findings and manage the extension settings.

Things to have in mind when working on this extension:

- extension.ts is where all the components are registered. Commands, listeners, UI, etc. If the component is a UI, it should reference a provider that is responsible for providing the data and logic for that UI component. For listeners and commands, the declaration should invoke a method on `watchtower.ts` where all the main logic is managed

## Creating New Analyzers

All analyzers extend `StaticAnalyzer` (src/analyzers/staticAnalyzer.ts), which is the base class and interface every analyzer must implement. Three methods are **required**:

### `canScanFile(uri: vscode.Uri): boolean`

Determines whether a given file URI should be analyzed by this analyzer. **Restrict this as narrowly as possible** — returning `true` for too many files causes unnecessary processing. Examples:

- For analyzers targeting a specific file, match on `uri.fsPath.endsWith(...)` or a specific filename
- For analyzers that should run on all non-binary code files (e.g. invisible character detection), use the inherited `this.isNotBinaryFile(uri)` helper, which excludes a comprehensive list of binary formats (images, executables, archives, compiled artifacts, etc.)

### `alertOnEditedInBackground(): boolean`

Controls whether a finding is raised when a sensitive file is silently modified by a background process (not the active editor). Return `true` only for files that could be tampered with by malicious agents or tools — e.g. AI instruction files, git hooks, `.npmrc`, settings files. For general code scanning analyzers, return `false`.

### `checkFile(uri: vscode.Uri, content?: Uint8Array): Promise<Finding[]>`

Contains the analysis logic. Always start by calling:

```typescript
const data = await this.ensureFileContent(uri, content)
```

This guarantees the file bytes are available whether the file was already read (content passed in) or needs to be read from disk. Never call `vscode.workspace.fs.readFile` directly inside `checkFile`.

### Utility methods available from `StaticAnalyzer`

- `this.ensureFileContent(uri, content)` — reads the file if content was not provided
- `this.isNotBinaryFile(uri)` — returns `true` if the file extension is not in the binary exclusion list; use this in `canScanFile` for general-purpose code analyzers
- `this.parentFolderRelativePath(uri)` — returns the workspace-relative path of the file's parent folder

### Adding a new analyzer

1. Create a new file in `src/analyzers/`
2. Export a class that extends `StaticAnalyzer` and implements the three required methods
3. Register the analyzer in `watchtower.ts` so it is included in the scan pipeline
