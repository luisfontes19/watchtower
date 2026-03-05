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
        const findings: Finding[] = []

        this.displayFindingsPage(findings)
        return findings
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


        if (uri.fsPath.endsWith('.vscode/settings.json'))
            promises.push(new SettingsAnalyzer().checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.devcontainer/devcontainer.json'))
            promises.push(new DevContainerAnalyzer().checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.json'))
            promises.push(new JsonFile().checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.vscode/tasks.json'))
            promises.push(new TaskAnalyzer().checkFile(uri, await ensureFileContent()))

        if (uri.fsPath.endsWith('.md'))
            promises.push(new AgentsAnalyzer().checkFile(uri, await ensureFileContent()))


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
