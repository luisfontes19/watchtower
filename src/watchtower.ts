import * as vscode from 'vscode'
import { AgentsAnalyzer } from './analyzers/agentsFile'
import { BindingGypAnalyzer } from './analyzers/bindingGypFile'
import { DevContainerAnalyzer } from './analyzers/devcontainerFile'
import { GitHooksAnalyzer } from './analyzers/gitHooks'
import { HooksPathReferenceAnalyzer } from './analyzers/hooksPathReference'
import { InvisibleCodeAnalyzer } from './analyzers/invisibleCode'
import { JsonFile } from './analyzers/jsonFile'
import { LaunchAnalyzer } from './analyzers/launchFile'
import { NpmrcAnalyzer } from './analyzers/npmrcFile'
import { PackageJsonAnalyzer } from './analyzers/packageJson'
import { SettingsAnalyzer } from './analyzers/settingsFile'
import { StaticAnalyzer } from './analyzers/staticAnalyzer'
import { PthFileAnalyzer } from './analyzers/pthFile'
import { TaskAnalyzer } from './analyzers/taskFile'
import { FindingsOverviewProvider } from './providers/findingsOverviewProvider'
import { FindingsTreeProvider } from './providers/findingsTreeProvider'
import { SettingsTreeProvider } from './providers/settingsTreeProvider'
import { Settings } from './settings'
import { ThreatIntel } from './threatIntel/threatIntel'
import { Finding, FindingType, InlineFindingType, StartupScansMode } from './types'
import { fileMatchesPatterns } from './utils'


export class Watchtower {
    private static instance: Watchtower

    private highlightDecorationType: vscode.TextEditorDecorationType

    public findings: Finding[] = []
    private settings: Settings
    private findingsTree: FindingsTreeProvider
    private findingsOverview: FindingsOverviewProvider
    private settingsTree: SettingsTreeProvider
    private settingsTreeView: vscode.TreeView<vscode.TreeItem>
    private threatIntel: ThreatIntel


    private allAnalyzers: StaticAnalyzer[]

    private constructor(findingsTree: FindingsTreeProvider, findingsOverview: FindingsOverviewProvider, settingsTree: SettingsTreeProvider, settingsTreeView: vscode.TreeView<vscode.TreeItem>) {

        this.allAnalyzers = [
            new AgentsAnalyzer(),
            new BindingGypAnalyzer(),
            new DevContainerAnalyzer(),
            new GitHooksAnalyzer(),
            new HooksPathReferenceAnalyzer(),
            new InvisibleCodeAnalyzer(),
            new JsonFile(),
            new NpmrcAnalyzer(),
            new PackageJsonAnalyzer(),
            new TaskAnalyzer(),
            new SettingsAnalyzer(),
            new LaunchAnalyzer(),
            new PthFileAnalyzer(),
        ]

        this.settings = Settings.getInstance()
        this.findingsTree = findingsTree
        this.findingsOverview = findingsOverview
        this.settingsTree = settingsTree
        this.settingsTreeView = settingsTreeView
        this.threatIntel = new ThreatIntel()

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


    public static getInstance(
        findingsTree: FindingsTreeProvider,
        findingsOverview: FindingsOverviewProvider,
        settingsTree: SettingsTreeProvider,
        settingsTreeView: vscode.TreeView<vscode.TreeItem>): Watchtower {

        if (!Watchtower.instance)
            Watchtower.instance = new Watchtower(findingsTree, findingsOverview, settingsTree, settingsTreeView)


        return Watchtower.instance
    }

    public onWorkspaceTrusted() { }

    private updateViews() {
        this.findingsTree.setFindings(this.findings)
        this.findingsOverview?.setFindings(this.findings)
        this.updateBadge()
    }

    private updateBadge() {
        if (this.findings.length === 0) {
            this.settingsTreeView.badge = undefined
            return
        }

        this.settingsTreeView.badge = {
            value: this.findings.length,
            tooltip: `${this.findings.length} finding${this.findings.length !== 1 ? 's' : ''}`
        }
    }

    public async checkWorkspaceTrustSettings() {
        if (!this.settings.getCheckWorkspaceTrust()) return

        const trustConfig = vscode.workspace.getConfiguration('security.workspace.trust')
        const enabled = trustConfig.get('enabled') === true
        const startupPrompt = trustConfig.get('startupPrompt')

        if (!enabled || startupPrompt === 'never') {
            vscode.window.showWarningMessage(
                'Watchtower: Workspace Trust settings are insecure. Please make sure you have workspace trust enabled (security.workspace.trust.enabled set to true) and set "security.workspace.trust.startupPrompt" to "always" or "once" for optimal security.\n\nYou can disable this warning in VSCode settings',
                { modal: true },
                'Open Security Settings'
            ).then(action => {
                if (action === 'Open Security Settings')
                    vscode.commands.executeCommand('workbench.action.openSettings', 'security.workspace.trust')
            })
        }

    }

    public async onFileCreated(uri: vscode.Uri) {
        console.log(`[Watchtower] File created: ${vscode.workspace.asRelativePath(uri)}`)

        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        const findings = await this.scanFile(uri, undefined, true)
        const newFindings = findings.filter(f => !this.isDuplicateFolderFinding(f, this.findings))
        if (newFindings.length > 0) {
            this.findings.push(...newFindings)
            this.updateViews()
            this.alertFindings(newFindings)
        }
    }

    public async onFileOpened(e: vscode.TextDocument) {
        console.log(`[Watchtower] File opened: ${vscode.workspace.asRelativePath(e.uri)}`)

        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        await this.scanFile(e.uri, new TextEncoder().encode(e.getText()))
    }

    public async onFileChanged(uri: vscode.Uri) {
        console.log(`[Watchtower] File changed: ${vscode.workspace.asRelativePath(uri)}`)

        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
        const filePath = vscode.Uri.joinPath(workspaceFolder!.uri, vscode.workspace.asRelativePath(uri))

        const findings = await this.scanFile(filePath, undefined, true)
        if (findings.length === 0) return

        // if a silent file change finding already exists for this file, don't add another one, but still get alerted
        const newFindings = findings.filter(f => {
            if (f.type === FindingType.SilentFileChange && this.findings.some(existing => existing.file === f.file && existing.type === FindingType.SilentFileChange))
                return false
            if (this.isDuplicateFolderFinding(f, this.findings)) return false
            return true
        })
        this.findings.push(...newFindings)
        this.updateViews()
        this.alertFindings(findings)
    }

    public async onActiveEditorChanged(editor: vscode.TextEditor | undefined) {
        if (!editor) return

        console.log(`[Watchtower] Active editor changed: ${vscode.workspace.asRelativePath(editor.document.uri)}`)

        if (!this.settings.shouldRunRealtimeScanForWorkspace()) return

        const doc = editor.document
        await this.scanFile(doc.uri, new TextEncoder().encode(doc.getText()))
    }

    public async onExtensionsChanged() {
        console.log('[Watchtower] Extensions changed, checking for new extensions and potential threats')
        const currentExtensions = vscode.extensions.all
            .filter(ext => !(ext.packageJSON as { isBuiltin?: boolean })?.isBuiltin)
            .map(ext => ext.id)

        const knownExtensions = this.settings.getKnownExtensions()

        const newExtensions = knownExtensions.length === 0
            ? [] // First run — just save the baseline
            : currentExtensions.filter(id => !knownExtensions.includes(id))

        await this.settings.setKnownExtensions(currentExtensions)

        if (newExtensions.length === 0) return

        console.log(`[Watchtower] New extensions detected: ${newExtensions.join(', ')}`)

        for (const extensionId of newExtensions) {
            const malicious = await this.threatIntel.isExtensionMalicious(extensionId)
            if (!malicious) continue

            const title = `Malicious Extension "${extensionId}"`
            const detail = `The extension "${extensionId}" has been identified as malicious. It is strongly recommended to uninstall it immediately.`



            if (this.settings.getAutoUninstallMalicious()) {
                vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extensionId)

                vscode.window.showWarningMessage(
                    `🔴 Watchtower: ${title}`,
                    { modal: true, detail: `${detail}\n\nThe extension has been automatically uninstalled. You can disable automatic uninstall in Watchtower settings.` },
                    'Open Settings'
                ).then(action => {
                    if (action === 'Open Settings')
                        vscode.commands.executeCommand('workbench.action.openSettings', 'watchtower.autoUninstallMalicious')
                })
            } else {
                vscode.window.showWarningMessage(`🔴 Watchtower: ${title}`, { modal: true, detail: detail }, 'Uninstall').then(action => {
                    if (action === 'Uninstall')
                        vscode.commands.executeCommand('workbench.extensions.uninstallExtension', extensionId)
                })

                this.findings.push({
                    file: extensionId,
                    name: title,
                    detail: detail,
                    priority: 'high',
                    type: FindingType.MaliciousExtension
                })

                this.updateViews()
            }



        }
    }

    /**
     * Run a full workspace scan and return findings
     */
    public async runScan(): Promise<Finding[]> {
        console.log('[Watchtower] Starting full workspace scan')

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Watchtower - Scanning workspace...',
            cancellable: true
        }, async (progress, token) => {
            const findings: Finding[] = []

            progress.report({ increment: 0, message: 'Listing project files...' })
            const excludePattern = `{${this.settings.getAllExcludedFolders().join(',')}}`
            const files = await vscode.workspace.findFiles('**/*', excludePattern)
            console.log(`[Watchtower] Found ${files.length} files to scan`)

            if (token.isCancellationRequested) return findings

            const totalFiles = files.length
            const incrementPerFile = 100 / totalFiles

            for (let i = 0; i < totalFiles; i++) {
                if (token.isCancellationRequested) break

                const file = files[i]
                const relativePath = vscode.workspace.asRelativePath(file)
                progress.report({ increment: incrementPerFile, message: `Analyzing ${relativePath} (${i + 1}/${totalFiles})` })

                const fileFindings = await this.scanFile(file)
                for (const f of fileFindings) {
                    if (this.isDuplicateFolderFinding(f, findings)) continue
                    findings.push(f)
                }
            }

            this.findings = findings
            this.updateViews()

            this.setInlineFindings(findings)

            console.log(`[Watchtower] Scan complete: ${findings.length} findings`)
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
                hoverMessage: new vscode.MarkdownString(`**Watchtower:** ${f.name}\n\n${this.findingDetailWithReferences(f)}`),
            }))

        activeEditor.setDecorations(this.highlightDecorationType, decorations)

    }

    private findingDetailWithReferences(finding: Finding): string {
        if (!finding.references || finding.references.length === 0)
            return finding.detail

        return `${finding.detail}\n\nReferences:\n${finding.references.map(url => `- ${url}`).join('\n')}`
    }


    public async commandCycleStartupScans(): Promise<void> {
        const current = this.settings.getGlobalStartupScans()
        const order = [StartupScansMode.onEveryProject, StartupScansMode.onUntrusted, StartupScansMode.off]
        const next = order[(order.indexOf(current) + 1) % order.length]
        await this.settings.setGlobalStartupScans(next)
        this.settingsTree.refresh()
    }

    public async commandCycleInlineFindings(): Promise<void> {
        const current = this.settings.getGlobalInlineFindings()
        const order = [InlineFindingType.all, InlineFindingType.invisible, InlineFindingType.none]
        const next = order[(order.indexOf(current) + 1) % order.length]
        await this.settings.setGlobalInlineFindings(next)
        this.settingsTree.refresh()
    }

    public async commandToggleWorkspaceStartupScan(): Promise<void> {
        const current = this.settings.getWorkspaceStartupScan()
        await this.settings.setWorkspaceStartupScan(!current)
        this.settingsTree.refresh()
    }

    public async commandToggleWorkspaceRealTime(): Promise<void> {
        const current = this.settings.getWorkspaceRealTimeDetection()
        await this.settings.setWorkspaceRealTimeDetection(!current)
        this.settingsTree.refresh()
    }

    public async commandToggleRule(ruleId: string): Promise<void> {
        await this.settings.toggleRule(ruleId)
        this.settingsTree.refresh()
    }

    public async commandToggleWorkspaceRule(ruleId: string): Promise<void> {
        await this.settings.toggleWorkspaceRule(ruleId)
        this.settingsTree.refresh()
    }

    public async commandToggleAutoUninstallMalicious(): Promise<void> {
        const current = this.settings.getAutoUninstallMalicious()
        await vscode.workspace.getConfiguration('watchtower').update('autoUninstallMalicious', !current, vscode.ConfigurationTarget.Global)
        this.settingsTree.refresh()
    }

    public async commandExcludeFile(uri: vscode.Uri): Promise<void> {
        const relPath = vscode.workspace.asRelativePath(uri, false)
        const current = this.settings.getWorkspaceExcludedFiles()
        if (!current.includes(relPath)) {
            await this.settings.setWorkspaceExcludedFiles([...current, relPath])
        }
        this.findings = this.findings.filter(f => f.file !== relPath)
        this.updateViews()
        this.syncExcludedFilesContext()
    }

    public async commandIncludeFile(uri: vscode.Uri): Promise<void> {
        const relPath = vscode.workspace.asRelativePath(uri, false)
        const current = this.settings.getWorkspaceExcludedFiles()
        await this.settings.setWorkspaceExcludedFiles(current.filter(p => p !== relPath))
        this.syncExcludedFilesContext()

        const newFindings = await this.scanFile(uri)
        for (const f of newFindings) {
            if (!this.isDuplicateFolderFinding(f, this.findings))
                this.findings.push(f)
        }
        this.updateViews()
    }

    public initExcludedFilesContext(): void {
        this.syncExcludedFilesContext()
    }

    private syncExcludedFilesContext(): void {
        const patterns = this.settings.getWorkspaceExcludedFiles()
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) return

        // Only exact paths (no glob chars) can be matched against resourcePath in when clauses
        const absolutePaths = patterns
            .filter(p => !/[*?[{]/.test(p))
            .map(p => vscode.Uri.joinPath(workspaceFolder.uri, p).fsPath)

        vscode.commands.executeCommand('setContext', 'watchtower.excludedFilePaths', absolutePaths)
    }

    public async commandEditWorkspaceExcludedFiles(): Promise<void> {
        const current = this.settings.getWorkspaceExcludedFiles()
        const input = await vscode.window.showInputBox({
            prompt: 'Enter glob patterns for files to exclude from scans (comma-separated)',
            value: current.join(', '),
            placeHolder: 'e.g. **/generated/*, src/vendor/**'
        })
        if (input === undefined) return
        const patterns = input.split(',').map(p => p.trim()).filter(Boolean)
        await this.settings.setWorkspaceExcludedFiles(patterns)
        this.settingsTree.refresh()
    }

    public async commandEditWorkspaceExcludedFolders(): Promise<void> {
        const current = this.settings.getWorkspaceExcludedFolders()
        const input = await vscode.window.showInputBox({
            prompt: 'Enter glob patterns for folders to exclude from scans (comma-separated)',
            value: current.join(', '),
            placeHolder: 'e.g. **/build/**, **/vendor/**'
        })
        if (input === undefined) return
        const patterns = input.split(',').map(p => p.trim()).filter(Boolean)
        await this.settings.setWorkspaceExcludedFolders(patterns)
        this.settingsTree.refresh()
    }

    public async runInitialScan(): Promise<void> {
        if (!this.settings.shouldRunStartupScanForWorkspace()) {
            console.log('[Watchtower] Startup scan disabled for this workspace, skipping')
            return
        }

        console.log('[Watchtower] Running initial scan')
        const wsfolders = vscode.workspace.workspaceFolders
        if (!wsfolders || wsfolders.length === 0) return

        const findings = await this.runScan()
        if (findings.length > 0)
            vscode.commands.executeCommand('watchtower.findings.focus')

    }

    public async commandRunScan(): Promise<void> {
        console.log('[Watchtower] Manual scan triggered')
        const findings = await this.runScan()

        if (findings.length === 0)
            vscode.window.showInformationMessage('Watchtower: No potential attack vectors found ✅')
    }

    public async showWhatsNewIfUpdated(context: vscode.ExtensionContext): Promise<void> {
        const currentVersion = context.extension.packageJSON.version as string
        const lastVersion = this.settings.getLastKnownVersion()

        if (lastVersion === currentVersion) return
        this.settings.setLastKnownVersion(currentVersion)

        const uri = vscode.Uri.joinPath(context.extensionUri, 'CHANGELOG.md')
        vscode.commands.executeCommand('markdown.showPreview', uri)

    }

    public async commandScanExtension(): Promise<void> {
        const extensionId = await vscode.window.showInputBox({
            prompt: 'Enter the extension ID to scan (e.g. publisher.extension-name)',
            placeHolder: 'publisher.extension-name',
            validateInput: (value) => value.trim() ? null : 'Extension ID is required',
        })

        if (!extensionId) return

        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Scanning extension ${extensionId}...` },
            async () => {
                const isMalicious = await this.threatIntel.isExtensionMalicious(extensionId.trim())

                if (isMalicious)
                    vscode.window.showWarningMessage(`❗️ Extension "${extensionId}" has been flagged as malicious!`)
                else
                    vscode.window.showInformationMessage(`✅ Extension "${extensionId}" appears clean.`)

            },
        )
    }

    public async scanFile(uri: vscode.Uri, content?: Uint8Array<ArrayBufferLike>, fileEdited: boolean = false): Promise<Finding[]> {

        console.log(`Scanning file: ${uri.fsPath}`)

        if (this.isFileExcluded(uri)) {
            console.log(`[Watchtower] File excluded: ${vscode.workspace.asRelativePath(uri)}`)
            return []
        }

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

    private isDuplicateFolderFinding(finding: Finding, existing: Finding[]): boolean {
        if (!finding.file.endsWith('/')) return false
        return existing.some(e => e.file === finding.file && e.type === finding.type)
    }

    private isFileExcluded(uri: vscode.Uri): boolean {
        const excludedFiles = this.settings.getWorkspaceExcludedFiles()
        if (excludedFiles.length === 0) return false
        return fileMatchesPatterns(uri, excludedFiles)
    }


    private isActiveFile(uri: vscode.Uri): boolean {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) return false

        const activeFile = vscode.workspace.asRelativePath(activeEditor.document.uri)
        const targetFile = vscode.workspace.asRelativePath(uri)

        return activeFile === targetFile
    }

    private alertFindings(findings: Finding[]) {
        const priorityEmoji = { high: '🔴', medium: '🟠', low: '🟡' }

        for (const finding of findings) {
            const emoji = priorityEmoji[finding.priority]
            const message = `${emoji} Watchtower: ${finding.name} (${finding.file})`

            vscode.window.showInformationMessage(message, 'Show Finding').then(action => {
                if (action === 'Show Finding') {
                    vscode.commands.executeCommand('watchtower.revealFinding', finding)
                }
            })
        }
    }


}
