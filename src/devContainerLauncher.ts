import * as vscode from 'vscode'
import { analyzeDevContainerConfig, blockingIssues, DevContainerIssue } from './devContainerSecurity'
import { Settings } from './settings'

const DEV_CONTAINERS_EXTENSION_ID = 'ms-vscode-remote.remote-containers'
const REOPEN_COMMAND = 'remote-containers.reopenInContainer'

const ALWAYS_OPEN = 'Always open this project'
const OPEN_ONCE = 'Open once'

export class DevContainerLauncher {

    constructor(private settings: Settings) { }

    /** Opens the workspace in its Dev Container when the user's settings allow it */
    public async run(): Promise<void> {
        if (!this.settings.getDevContainerOpenByDefault()) return
        if (vscode.env.remoteName) return // already in a container/remote, avoids reopen loops

        const folder = vscode.workspace.workspaceFolders?.[0]
        if (!folder || folder.uri.scheme !== 'file') return

        const configs = await this.findConfigs(folder.uri)
        if (configs.length === 0) return

        if (!vscode.extensions.getExtension(DEV_CONTAINERS_EXTENSION_ID)) return

        if (this.settings.isDevContainerException(folder.uri.fsPath)) {
            await this.open()
            return
        }

        const trusted = vscode.workspace.isTrusted === true
        const reasons: string[] = []

        if (!trusted && !this.settings.getDevContainerOpenInUntrustedWorkspaces())
            reasons.push('The workspace is not trusted')

        const skipChecks = this.settings.getDevContainerSecurityChecksOnlyWhenUntrusted() && trusted
        if (!skipChecks)
            reasons.push(...(await this.securityIssues(configs, folder.uri.fsPath)).map(i => i.message))

        if (reasons.length === 0) {
            await this.open()
            return
        }

        await this.promptBlocked(folder.uri.fsPath, reasons)
    }

    private async securityIssues(configs: vscode.Uri[], workspaceDir: string): Promise<DevContainerIssue[]> {
        const readFile = async (absPath: string): Promise<string | undefined> => {
            try {
                return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(absPath)))
            } catch {
                return undefined
            }
        }

        const issues: DevContainerIssue[] = []
        for (const config of configs) {
            const text = await readFile(config.fsPath)
            if (text === undefined) {
                issues.push({ kind: 'unverifiable', message: `${vscode.workspace.asRelativePath(config, false)} could not be read` })
                continue
            }
            issues.push(...await analyzeDevContainerConfig(text, config.fsPath, workspaceDir, readFile))
        }

        return blockingIssues(issues, {
            onlyIfNoInitCommands: this.settings.getDevContainerOnlyIfNoInitCommands(),
            onlyIfNoMounts: this.settings.getDevContainerOnlyIfNoMounts(),
        })
    }

    private async promptBlocked(projectPath: string, reasons: string[]): Promise<void> {
        const message = `Watchtower did not open this project in its Dev Container automatically:\n${reasons.map(r => `• ${r}`).join('\n')}`
        const choice = await vscode.window.showWarningMessage(message, ALWAYS_OPEN, OPEN_ONCE)

        if (choice === ALWAYS_OPEN) {
            await this.settings.addDevContainerException(projectPath)
            await this.open()
        } else if (choice === OPEN_ONCE) {
            await this.open()
        }
    }

    private async open(): Promise<void> {
        await vscode.commands.executeCommand(REOPEN_COMMAND)
    }

    /** .devcontainer/devcontainer.json, .devcontainer.json and .devcontainer/<folder>/devcontainer.json */
    private async findConfigs(folder: vscode.Uri): Promise<vscode.Uri[]> {
        const candidates = [
            vscode.Uri.joinPath(folder, '.devcontainer', 'devcontainer.json'),
            vscode.Uri.joinPath(folder, '.devcontainer.json'),
        ]

        try {
            const dir = vscode.Uri.joinPath(folder, '.devcontainer')
            for (const [name, type] of await vscode.workspace.fs.readDirectory(dir)) {
                if (type === vscode.FileType.Directory)
                    candidates.push(vscode.Uri.joinPath(dir, name, 'devcontainer.json'))
            }
        } catch {
            // no .devcontainer folder
        }

        const found: vscode.Uri[] = []
        for (const candidate of candidates) {
            try {
                await vscode.workspace.fs.stat(candidate)
                found.push(candidate)
            } catch {
                // doesn't exist
            }
        }
        return found
    }
}
