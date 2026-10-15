import { execFile } from 'child_process'
import * as vscode from 'vscode'
import { analyzeDevContainerConfig, blockingIssues, DevContainerIssue } from './devContainerSecurity'
import { Settings } from './settings'
import { logger } from './logger'

const DEV_CONTAINERS_EXTENSION_ID = 'ms-vscode-remote.remote-containers'
const REOPEN_COMMAND = 'remote-containers.reopenInContainer'

const ALWAYS_OPEN = 'Always open this project'
const OPEN_ONCE = 'Open once'
const RETRY = 'Retry'
const DOCKER_CHECK_TIMEOUT_MS = 10_000

function log(message: string): void {
    logger.info(`Dev Container: ${message}`)
}

/** Honors the Dev Containers extension's docker path setting (also used for podman), falling back to `docker` */
function containerEnginePath(): string {
    const config = vscode.workspace.getConfiguration()
    return config.get<string>('dev.containers.dockerPath') || config.get<string>('remote.containers.dockerPath') || 'docker'
}

/** True if the container engine's daemon answers; `docker version` fails when it can't be reached */
function isContainerEngineRunning(): Promise<boolean> {
    const engine = containerEnginePath()
    return new Promise(resolve => {
        execFile(engine, ['version', '--format', '{{.Server.Version}}'], { timeout: DOCKER_CHECK_TIMEOUT_MS }, error => {
            if (error) log(`'${engine} version' failed: ${error.message}`)
            resolve(!error)
        })
    })
}

export class DevContainerLauncher {

    constructor(private settings: Settings) { }

    /** Opens the workspace in its Dev Container when the user's settings allow it */
    public async run(): Promise<void> {
        if (!this.settings.getDevContainerOpenByDefault()) return log('skipped: openByDefault is off')
        if (vscode.env.remoteName) return log(`skipped: already in a remote window (${vscode.env.remoteName})`) // avoids reopen loops

        const folder = vscode.workspace.workspaceFolders?.[0]
        if (!folder) return log('skipped: no workspace folder open')
        if (folder.uri.scheme !== 'file') return log(`skipped: workspace folder scheme is '${folder.uri.scheme}'`)

        const configs = await this.findConfigs(folder.uri)
        if (configs.length === 0) return log('skipped: no devcontainer config found')

        if (!vscode.extensions.getExtension(DEV_CONTAINERS_EXTENSION_ID))
            return log(`skipped: extension '${DEV_CONTAINERS_EXTENSION_ID}' is not installed`)

        if (this.settings.isDevContainerException(folder.uri.fsPath)) {
            log('project is in the exceptions list, opening')
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
            log('checks passed, opening')
            await this.open()
            return
        }

        log(`blocked: ${reasons.join('; ')}`)
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
        if (!(await isContainerEngineRunning())) {
            const choice = await vscode.window.showWarningMessage(
                "Watchtower did not open this project in its Dev Container automatically: Docker doesn't seem to be running (or isn't responding). Start Docker and try again.",
                RETRY,
            )
            if (choice === RETRY) await this.open()
            return
        }

        try {
            await vscode.commands.executeCommand(REOPEN_COMMAND)
        } catch (error) {
            log(`'${REOPEN_COMMAND}' failed: ${error}`)
            vscode.window.showErrorMessage(`Watchtower could not open the project in its Dev Container: ${error instanceof Error ? error.message : error}`)
        }
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
