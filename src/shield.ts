import * as vscode from 'vscode'
import { AgentsAnalyzer } from './analyzers/agentsFile'
import { DevContainerAnalyzer } from './analyzers/devcontainerFile'
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
        const promises = []
        promises.push(TaskAnalyzer.analyze())
        promises.push(SettingsAnalyzer.analyze())
        promises.push(DevContainerAnalyzer.analyze())
        promises.push(JsonFile.analyze())

        const results = await Promise.all(promises)
        const findings = results.flat()

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

    public onWorkspaceChanged() {
        console.log("2")
        vscode.window.showInformationMessage('Workspace folders have changed. Re-analyzing for potential threats...')
    }

    public onDidStartTask(e: vscode.TaskStartEvent) {
        console.log("ondidstarttask")
    }

    public async onWillSaveFile(e: vscode.TextDocumentWillSaveEvent) {
        const findings = await this.processFileChange(e.document)

        if (findings.length === 0) return
        this.showAlert(findings)
    }

    public async onWillCreateFiles(e: vscode.FileCreateEvent) {
        const promises = []

        for (const file of e.files) {

            const document = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === file.fsPath)
            if (!document) continue

            promises.push(this.processFileChange(document))
        }

        const results = await Promise.all(promises)

        const findings = results.flat()
        if (findings.length === 0) return

        this.showAlert(findings)

    }

    public async processFileChange(document: vscode.TextDocument): Promise<Finding[]> {
        const promises = []
        const isActiveTab = vscode.window.activeTextEditor?.document.uri.fsPath === document.uri.fsPath


        if (document.uri.fsPath.endsWith('.vscode/settings.json'))
            promises.push(SettingsAnalyzer.onChange(document.uri))

        if (document.uri.fsPath.endsWith('.devcontainer/devcontainer.json'))
            promises.push(DevContainerAnalyzer.onChange(document.uri))

        if (document.uri.fsPath.endsWith('.json'))
            promises.push(JsonFile.checkFileContent(document.getText()))

        if (document.uri.fsPath.endsWith('.vscode/tasks.json'))
            promises.push(TaskAnalyzer.analyze(document.uri)) // TODO: Change to a onCHange


        if (document.uri.fsPath.endsWith('.md'))
            promises.push(AgentsAnalyzer.onChange(document.uri))



        const results = await Promise.all(promises)
        const findings = results.flat()

        return findings

    }

    public showAlert(findings: Finding[]) {
        for (const finding of findings)
            vscode.window.showErrorMessage(`Potential issue detected in ${finding.file}: ${finding.detail}`)
    }


}
