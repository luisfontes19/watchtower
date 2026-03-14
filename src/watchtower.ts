import * as vscode from 'vscode'
import { AgentsAnalyzer } from './analyzers/agentsFile'
import { DevContainerAnalyzer } from './analyzers/devcontainerFile'
import { InvisibleCodeAnalyzer } from './analyzers/invisibleCode'
import { JsonFile } from './analyzers/jsonFile'
import { LaunchAnalyzer } from './analyzers/launchFile'
import { SettingsAnalyzer } from './analyzers/settingsFile'
import { StaticAnalyzer } from './analyzers/staticAnalyzer'
import { TaskAnalyzer } from './analyzers/taskFile'
import { showAlerts, showScanResults } from './report'
import { Settings } from './settings'
import { Finding, FindingType, InlineFindingType } from './types'

export class Watchtower {
    private static instance: Watchtower

    private highlightDecorationType: vscode.TextEditorDecorationType

    public findings: Finding[] = []
    private settings: Settings


    private allAnalyzers: StaticAnalyzer[]

    private constructor(extensionUri: vscode.Uri) {

        this.allAnalyzers = [
            new AgentsAnalyzer(),
            new DevContainerAnalyzer(),
            new InvisibleCodeAnalyzer(),
            new JsonFile(),
            new TaskAnalyzer(),
            new SettingsAnalyzer(),
            new LaunchAnalyzer(),
        ]

        this.settings = Settings.getInstance()


        const warningEmoji = '❗️'
        const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="12">${warningEmoji}</text></svg>`
        const gutterIcon = vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svgIcon).toString('base64')}`)

        this.highlightDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 166, 0, 0.25)',
            border: '1px solid rgba(255, 166, 0, 0.6)',
            borderRadius: '3px',
            overviewRulerColor: 'rgba(255, 166, 0, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Center,
            isWholeLine: false,
            gutterIconPath: gutterIcon,
            gutterIconSize: 'contain',

        })
    }


    public static getInstance(extensionUri?: vscode.Uri): Watchtower {
        if (!Watchtower.instance) {
            if (!extensionUri) {
                throw new Error('Extension URI is required for first initialization')
            }
            Watchtower.instance = new Watchtower(extensionUri)
        }
        return Watchtower.instance
    }

    public onWorkspaceTrusted() { }

    public async onFileCreated(uri: vscode.Uri) {
        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        const findings = await this.scanFile(uri, undefined, true)
        await showAlerts(findings)
    }

    public async onFileOpened(e: vscode.TextDocument) {
        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        await this.scanFile(e.uri, new TextEncoder().encode(e.getText()))
    }

    public async onFileChanged(uri: vscode.Uri) {
        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
        const filePath = vscode.Uri.joinPath(workspaceFolder!.uri, vscode.workspace.asRelativePath(uri))

        const findings = await this.scanFile(filePath, undefined, true)
        await showAlerts(findings)
    }

    public async onActiveEditorChanged(editor: vscode.TextEditor | undefined) {
        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        if (!editor) return
        const doc = editor.document
        await this.scanFile(doc.uri, new TextEncoder().encode(doc.getText()))

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


            this.setInlineFindings(findings)

            return findings
        })
    }

    public setInlineFindings(findings: Finding[]) {
        const inlineSetting = this.settings.getGlobalInlineFindings()
        if (inlineSetting === InlineFindingType.none) {
            return
        }

        const activeDocument = vscode.window.activeTextEditor?.document.uri
        if (!activeDocument) return

        const currentWorkspace = vscode.workspace.getWorkspaceFolder(activeDocument)
        if (!currentWorkspace) return

        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) return

        const currentFile = vscode.workspace.asRelativePath(activeEditor.document.uri)

        const decorations: vscode.DecorationOptions[] = findings
            .filter(f =>
                f.range
                && f.file === currentFile
                && (
                    inlineSetting === InlineFindingType.all
                    || (inlineSetting === InlineFindingType.invisible && f.type === FindingType.InvisibleCode)
                )
            ).map(f => ({
                range: f.range!,
                hoverMessage: new vscode.MarkdownString(`**Watchtower:** ${f.name}\n\n${f.detail}`),
            }))

        activeEditor.setDecorations(this.highlightDecorationType, decorations)

    }

    public async runInitialScan(): Promise<void> {
        if (!this.settings.shouldRunStartupScanForWorkspace())
            return

        const wsfolders = vscode.workspace.workspaceFolders
        if (!wsfolders || wsfolders.length === 0) return

        const findings = await this.runScan()
        await showScanResults(findings, this.settings)
    }

    public async commandRunScan(): Promise<void> {
        const findings = await this.runScan()
        await showScanResults(findings, this.settings, true)
    }

    public async commandDisableStartupScanForWorkspace(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Disabling Startup Scan means Watchtower will no longer automatically scan this workspace when you open it. You can still run scans manually via the command palette.',
            { modal: true },
            'Disable Startup Scan'
        )
        if (confirm === 'Disable Startup Scan') {
            await this.settings.setWorkspaceStartupScan(false)
        }
    }

    public async commandDisableRealTimeDetectionForWorkspace(): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Disabling Real-Time Protection means Watchtower will no longer monitor file changes in this workspace. New or modified files will not be checked for threats until you run a manual scan.',
            { modal: true },
            'Disable Real-Time Protection'
        )
        if (confirm === 'Disable Real-Time Protection') {
            await this.settings.setWorkspaceRealTimeDetection(false)
        }
    }

    public async scanFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>, fileEdited: boolean = false): Promise<Finding[]> {

        console.log(`Scanning file: ${uri.fsPath}`)

        // Ensure we only read file once, when running on multiple analyzers, as vscode.workspace.fs.readFile can be expensive on large files or remote workspaces
        const ensureFileContent = async (): Promise<Uint8Array> => {
            if (content) return content
            const data = await vscode.workspace.fs.readFile(uri)
            return data
        }

        content = await ensureFileContent()

        const analyzersForFile = this.allAnalyzers.filter(a => a.canScanFile(uri))
        const fileChecks = analyzersForFile.map(a => a.checkFile(uri, content))
        const backgroundChecks = fileEdited ? analyzersForFile.map(a => a.runBackgroundEditedCheck(uri)) : []

        const promises = [
            ...fileChecks,
            ...backgroundChecks
        ]

        const results = await Promise.all(promises)
        const findings = results.flat()

        if (this.isActiveFile(uri))
            this.setInlineFindings(findings)

        return findings

    }


    private isActiveFile(uri: vscode.Uri): boolean {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) return false

        const activeFile = vscode.workspace.asRelativePath(activeEditor.document.uri)
        const targetFile = vscode.workspace.asRelativePath(uri)

        return activeFile === targetFile
    }


}
