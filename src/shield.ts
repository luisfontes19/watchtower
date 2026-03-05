import * as vscode from 'vscode'
import { AgentsAnalyzer } from './analyzers/agentsFile'
import { DevContainerAnalyzer } from './analyzers/devcontainerFile'
import { InvisibleCodeAnalyzer } from './analyzers/invisibleCode'
import { JsonFile } from './analyzers/jsonFile'
import { LaunchAnalyzer } from './analyzers/launchFile'
import { SettingsAnalyzer } from './analyzers/settingsFile'
import { StaticAnalyzer } from './analyzers/staticAnalyzer'
import { TaskAnalyzer } from './analyzers/taskFile'
import { generateHTMLReport } from './report'
import { Finding } from './types'

export class Shield {
    private static instance: Shield
    private config: vscode.WorkspaceConfiguration

    private agentsAnalyzer: AgentsAnalyzer
    private devContainerAnalyzer: DevContainerAnalyzer
    private invisibleCodeAnalyzer: InvisibleCodeAnalyzer
    private jsonFileAnalyzer: JsonFile
    private taskAnalyzer: TaskAnalyzer
    private settingsAnalyzer: SettingsAnalyzer
    private launchAnalyzer: LaunchAnalyzer



    private constructor() {
        this.config = vscode.workspace.getConfiguration('vscode-shield')

        this.config.update("test", true, vscode.ConfigurationTarget.Workspace).then(() => {
            console.log("Configuration updated successfully")
        })
        this.agentsAnalyzer = new AgentsAnalyzer()
        this.devContainerAnalyzer = new DevContainerAnalyzer()
        this.invisibleCodeAnalyzer = new InvisibleCodeAnalyzer()
        this.jsonFileAnalyzer = new JsonFile()
        this.taskAnalyzer = new TaskAnalyzer()
        this.settingsAnalyzer = new SettingsAnalyzer()
        this.launchAnalyzer = new LaunchAnalyzer()
    }


    public static getInstance(): Shield {
        if (!Shield.instance) {
            Shield.instance = new Shield()
        }
        return Shield.instance
    }

    public async analyze() {
        return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'VSCode Shield', cancellable: true }, async (progress, token) => {
            const findings: Finding[] = []

            progress.report({ increment: 0, message: 'Listing project files...' })
            const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**')

            if (token.isCancellationRequested) return findings

            const totalFiles = files.length
            const incrementPerFile = 100 / totalFiles

            for (let i = 0; i < totalFiles; i++) {
                if (token.isCancellationRequested) break

                const file = files[i]
                const relativePath = vscode.workspace.asRelativePath(file)
                progress.report({ increment: incrementPerFile, message: `Analyzing ${relativePath} (${i + 1}/${totalFiles})` })

                const fileFindings = await this.analyzeFile(file)
                findings.push(...fileFindings)
            }

            this.displayFindingsPage(findings)
            return findings
        })
    }

    private displayFindingsPage(findings: Finding[], partial: boolean = false) {
        const title = partial ? 'VSCode Shield — Partial Scan' : 'VSCode Shield Findings'
        const panel = vscode.window.createWebviewPanel('findingsView', title, vscode.ViewColumn.One, { enableScripts: true })
        panel.webview.html = generateHTMLReport(findings, partial)
    }


    public onWorkspaceTrusted() {
        console.log("3")
        vscode.window.showInformationMessage('Workspace is now trusted. You can safely analyze your code.')
    }

    public async onFileCreated(uri: vscode.Uri) {
        const findings = await this.analyzeFile(uri, undefined, true)
        await this.showAlerts(findings)
    }

    public async onFileChanged(uri: vscode.Uri) {

        const findings = await this.analyzeFile(uri, undefined, true)
        await this.showAlerts(findings)
    }

    public getSensitiveFileAnalyzers(uri: vscode.Uri): StaticAnalyzer[] {
        const relativePath = vscode.workspace.asRelativePath(uri, false)
        const path = uri.fsPath

        const analyzers: StaticAnalyzer[] = []

        if (path.endsWith('.vscode/settings.json'))
            analyzers.push(this.settingsAnalyzer)

        if (path.endsWith('.devcontainer/devcontainer.json'))
            analyzers.push(this.devContainerAnalyzer)

        if (path.endsWith('.json'))
            analyzers.push(this.jsonFileAnalyzer)

        if (path.endsWith('.vscode/tasks.json'))
            analyzers.push(this.taskAnalyzer)

        if (path.endsWith('.vscode/launch.json'))
            analyzers.push(this.launchAnalyzer)

        if (path.endsWith('.md') && AgentsAnalyzer.isAgentFile(uri))
            analyzers.push(this.agentsAnalyzer)

        return analyzers
    }

    public async analyzeFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>, fileEdited: boolean = false): Promise<Finding[]> {
        const promises = []

        // Ensure we only read file once, when running on multiple analyzers, as vscode.workspace.fs.readFile can be expensive on large files or remote workspaces
        const ensureFileContent = async (): Promise<Uint8Array> => {
            if (content) return content
            const data = await vscode.workspace.fs.readFile(uri)
            return data
        }

        if (uri.fsPath.endsWith('.vscode/settings.json'))
            promises.push(this.settingsAnalyzer.checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.devcontainer/devcontainer.json'))
            promises.push(this.devContainerAnalyzer.checkFile(uri, await ensureFileContent()))


        if (uri.fsPath.endsWith('.json'))
            promises.push(this.jsonFileAnalyzer.checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.vscode/tasks.json'))
            promises.push(this.taskAnalyzer.checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.md'))
            promises.push(this.agentsAnalyzer.checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.vscode/launch.json'))
            promises.push(this.launchAnalyzer.checkFile(uri, await ensureFileContent()))


        if (fileEdited) {
            const analyzers = this.getSensitiveFileAnalyzers(uri)
            for (const analyzer of analyzers) {
                promises.push(analyzer.sensitiveFileBackgroundEditCheck(uri))
            }
        }

        promises.push(this.invisibleCodeAnalyzer.checkFile(uri, await ensureFileContent()))

        const results = await Promise.all(promises)
        return results.flat()

    }


    public async showAlerts(findings: Finding[]) {
        if (findings.length === 0) return

        const highCount = findings.filter(f => f.priority === 'high').length
        const medCount = findings.filter(f => f.priority === 'medium').length
        const lowCount = findings.filter(f => f.priority === 'low').length

        const counts: string[] = []
        if (highCount) counts.push(`🔴 ${highCount} high`)
        if (medCount) counts.push(`🟠 ${medCount} medium`)
        if (lowCount) counts.push(`🟡 ${lowCount} low`)

        // Group findings by type for a concise summary
        const byType = new Map<string, Finding[]>()
        for (const f of findings) {
            const group = byType.get(f.type) ?? []
            group.push(f)
            byType.set(f.type, group)
        }

        const summary = Array.from(byType.entries()).map(([type, items]) => {
            const files = [...new Set(items.map(f => f.file).filter(Boolean))]
            const fileList = files.length ? `: ${files.join(', ')}` : ''
            return `• ${type} (${items.length})${fileList}`
        }).join('\n')

        const message = [
            `⚡ VSCode Shield — Partial Scan`,
            `Detected ${findings.length} issue${findings.length > 1 ? 's' : ''} in recently changed files`,
            `Priority: ${counts.join(' | ')}`,
            '',
            summary,
        ].join('\n')

        const action = await vscode.window.showErrorMessage(message, 'Show Report', '🔍 Run Full Scan')

        if (action === 'Show Report') {
            this.displayFindingsPage(findings, true)
        } else if (action === '🔍 Run Full Scan') {
            this.analyze()
        }
    }


}
