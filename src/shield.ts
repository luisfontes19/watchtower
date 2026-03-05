import * as vscode from 'vscode'
import { AgentsAnalyzer } from './analyzers/agentsFile'
import { DevContainerAnalyzer } from './analyzers/devcontainerFile'
import { InvisibleCodeAnalyzer } from './analyzers/invisibleCode'
import { JsonFile } from './analyzers/jsonFile'
import { TaskAnalyzer } from './analyzers/task'
import { SettingsAnalyzer } from './analyzers/vscodeSettingsFile'
import { generateHTMLReport } from './report'
import { Finding } from './types'

export class Shield {
    private static instance: Shield
    private config: vscode.WorkspaceConfiguration




    private constructor() {
        this.config = vscode.workspace.getConfiguration('vscode-shield')

        this.config.update("test", true, vscode.ConfigurationTarget.Workspace).then(() => {
            console.log("Configuration updated successfully")
        })
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

    private displayFindingsPage(findings: Finding[]) {
        const panel = vscode.window.createWebviewPanel('findingsView', 'VSCode Shield Findings', vscode.ViewColumn.One, { enableScripts: true })
        panel.webview.html = generateHTMLReport(findings)
    }


    public onWorkspaceTrusted() {
        console.log("3")
        vscode.window.showInformationMessage('Workspace is now trusted. You can safely analyze your code.')
    }

    public async onFileCreated(uri: vscode.Uri) {
        const findings = await this.analyzeFile(uri)
        this.showAlerts(findings)
    }

    public async onFileChanged(uri: vscode.Uri) {
        const findings = await this.analyzeFile(uri)
        this.showAlerts(findings)
    }

    public async analyzeFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>): Promise<Finding[]> {
        const promises = []

        // Ensure we only read file once, when running on multiple analyzers, as vscode.workspace.fs.readFile can be expensive on large files or remote workspaces
        const ensureFileContent = async (): Promise<Uint8Array> => {
            if (content) return content
            const data = await vscode.workspace.fs.readFile(uri)
            return data
        }


        if (uri.fsPath.endsWith('.vscode/settings.json')) {
            const analyzer = new SettingsAnalyzer()
            promises.push(Promise.resolve(analyzer.sensitiveFileBackgroundEditCheck(uri)))
            promises.push(analyzer.checkFile(uri, await ensureFileContent()))
        }


        if (uri.fsPath.endsWith('.devcontainer/devcontainer.json')) {
            const analyzer = new DevContainerAnalyzer()
            promises.push(Promise.resolve(analyzer.sensitiveFileBackgroundEditCheck(uri)))
            promises.push(analyzer.checkFile(uri, await ensureFileContent()))
        }

        if (uri.fsPath.endsWith('.json')) {
            const analyzer = new JsonFile()
            promises.push(Promise.resolve(analyzer.sensitiveFileBackgroundEditCheck(uri)))
            promises.push(analyzer.checkFile(uri, await ensureFileContent()))
        }

        if (uri.fsPath.endsWith('.vscode/tasks.json')) {
            const analyzer = new TaskAnalyzer()
            promises.push(Promise.resolve(analyzer.sensitiveFileBackgroundEditCheck(uri)))
            promises.push(analyzer.checkFile(uri, await ensureFileContent()))
        }


        if (uri.fsPath.endsWith('.md')) {
            const analyzer = new AgentsAnalyzer()
            if (AgentsAnalyzer.isAgentFile(uri))
                promises.push(Promise.resolve(analyzer.sensitiveFileBackgroundEditCheck(uri)))

            promises.push(analyzer.checkFile(uri, await ensureFileContent()))
        }


        promises.push(new InvisibleCodeAnalyzer().checkFile(uri, await ensureFileContent()))

        const results = await Promise.all(promises)
        return results.flat()

    }

    public async processFileChange(document: vscode.TextDocument) {
        const findings = await this.analyzeFile(document.uri, new TextEncoder().encode(document.getText()))

        if (findings.length === 0) return
        this.showAlerts(findings)

    }

    public showAlerts(findings: Finding[]) {
        for (const finding of findings)
            vscode.window.showErrorMessage(`Potential issue detected in ${finding.file}: ${finding.detail}`)
    }


}
