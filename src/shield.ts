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
        const taskAnalyzer = new TaskAnalyzer()
        const settingsAnalyzer = new SettingsAnalyzer()
        const devContainerAnalyzer = new DevContainerAnalyzer()
        const jsonFile = new JsonFile()

        const promises = []
        promises.push(taskAnalyzer.analyze())
        promises.push(settingsAnalyzer.analyze())
        promises.push(devContainerAnalyzer.analyze())
        promises.push(jsonFile.analyze())

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
            promises.push(new SettingsAnalyzer().onChange(document.uri))

        if (document.uri.fsPath.endsWith('.devcontainer/devcontainer.json'))
            promises.push(new DevContainerAnalyzer().onChange(document.uri))

        if (document.uri.fsPath.endsWith('.json'))
            promises.push(new JsonFile().onChange(document.uri))

        if (document.uri.fsPath.endsWith('.vscode/tasks.json'))
            promises.push(new TaskAnalyzer().analyze()) // TODO: Change to a onChange


        if (document.uri.fsPath.endsWith('.md'))
            promises.push(new AgentsAnalyzer().onChange(document.uri))



        const results = await Promise.all(promises)
        const findings = results.flat()

        return findings

    }

    public showAlert(findings: Finding[]) {
        for (const finding of findings)
            vscode.window.showErrorMessage(`Potential issue detected in ${finding.file}: ${finding.detail}`)
    }


}
