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
import { isSensitiveFile } from './utils'


export class Watchtower {
    private static instance: Watchtower

    private agentsAnalyzer: AgentsAnalyzer
    private devContainerAnalyzer: DevContainerAnalyzer
    private invisibleCodeAnalyzer: InvisibleCodeAnalyzer
    private jsonFileAnalyzer: JsonFile
    private taskAnalyzer: TaskAnalyzer
    private settingsAnalyzer: SettingsAnalyzer
    private launchAnalyzer: LaunchAnalyzer
    private inlineDiagnostics: vscode.DiagnosticCollection

    public findings: Finding[] = []


    private constructor() {
        this.agentsAnalyzer = new AgentsAnalyzer()
        this.devContainerAnalyzer = new DevContainerAnalyzer()
        this.invisibleCodeAnalyzer = new InvisibleCodeAnalyzer()
        this.jsonFileAnalyzer = new JsonFile()
        this.taskAnalyzer = new TaskAnalyzer()
        this.settingsAnalyzer = new SettingsAnalyzer()
        this.launchAnalyzer = new LaunchAnalyzer()

        this.inlineDiagnostics = vscode.languages.createDiagnosticCollection('watchtowerFindings')
    }


    public static getInstance(): Watchtower {
        if (!Watchtower.instance) {
            Watchtower.instance = new Watchtower()
        }
        return Watchtower.instance
    }

    public onWorkspaceTrusted() {
        vscode.window.showInformationMessage('Workspace is now trusted. You can safely analyze your code.')
    }

    public async onFileCreated(uri: vscode.Uri, scanLifecycle: any) {
        // Check if background monitoring should run
        if (!scanLifecycle.shouldRunBackgroundMonitoring()) {
            return
        }

        const findings = await this.scanFile(uri, undefined, true)
        await this.showAlerts(findings)
    }

    public async onFileOpened(e: vscode.TextDocument) {
        this.scanFile(e.uri, new TextEncoder().encode(e.getText()))
    }

    public async onFileChanged(uri: vscode.Uri, scanLifecycle: any) {
        // Check if background monitoring should run
        if (!scanLifecycle.shouldRunBackgroundMonitoring()) {
            return
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
        const path = vscode.Uri.joinPath(workspaceFolder!.uri, vscode.workspace.asRelativePath(uri))

        const findings = await this.scanFile(path, undefined, true)
        await this.showAlerts(findings)
    }

    /**
     * Run a full workspace scan and return findings
     */
    public async runScan(): Promise<Finding[]> {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Watchtower - Scanning workspace...',
            cancellable: true
        }, async (progress, token) => {
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

                const fileFindings = await this.scanFile(file)
                findings.push(...fileFindings)
            }

            this.findings = findings

            this.inlineDiagnostics.clear()
            this.setInlineFindings(findings)

            return findings
        })
    }

    public setInlineFindings(findings: Finding[]) {
        for (const finding of findings) {
            if (finding.range && finding.file) {
                const uri = vscode.workspace.workspaceFolders ? vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, finding.file) : null
                if (!uri) continue

                const diagnostic = new vscode.Diagnostic(finding.range, finding.detail, vscode.DiagnosticSeverity.Warning)
                diagnostic.source = 'Watchtower'

                this.inlineDiagnostics.set(uri, [diagnostic])
            }
        }
    }

    public generateHTMLReport(findings: Finding[], partial: boolean = false): string {
        return generateHTMLReport(findings, partial)
    }




    public getSensitiveFileAnalyzers(uri: vscode.Uri): StaticAnalyzer[] {
        if (!isSensitiveFile(uri)) return []


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

        if (analyzers.length === 0) {
            throw new Error(`File ${uri.fsPath} is marked as sensitive but no analyzer found. Check the file patterns in getSensitiveFileAnalyzers and ensure they match the patterns in SensitiveFiles.`)
        }

        return analyzers
    }

    public async scanFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>, fileEdited: boolean = false): Promise<Finding[]> {
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
        const findings = results.flat()

        this.inlineDiagnostics.delete(uri)
        this.setInlineFindings(findings)

        return findings

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
            `⚡ Watchtower — Partial Scan`,
            `Detected ${findings.length} issue${findings.length > 1 ? 's' : ''} in recently changed files`,
            `Priority: ${counts.join(' | ')}`,
            '',
            summary,
        ].join('\n')

        const action = await vscode.window.showErrorMessage(message, 'Show Report', '🔍 Run Full Scan')

        if (action === 'Show Report') {
            // Show detailed report - will be handled by ScanLifecycle
            const reportHtml = this.generateHTMLReport(findings, true)
            const panel = vscode.window.createWebviewPanel('watchtowerReport', 'Watchtower Partial Scan', vscode.ViewColumn.One, { enableScripts: true })
            panel.webview.html = reportHtml
        } else if (action === '🔍 Run Full Scan') {
            // Trigger manual full scan - will be handled by caller
            vscode.commands.executeCommand('watchtower.analyze')
        }
    }


}



export const SensitiveFiles = () => [
    '.devcontainer/devcontainer.json',
    '.vscode/settings.json',
    '.vscode/tasks.json',
    '.vscode/launch.json',
    '**/*.md',
    '**/*.json',
    ...AgentsAnalyzer.AGENTS_FILE_NAMES
]
