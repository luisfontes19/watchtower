import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { generateHTMLReport, generateJSONReport } from './report'
import { Finding } from './types'
import { Watchtower } from './watchtower'

export interface ScanSummary {
    totalFindings: number
    highFindings: number
    mediumFindings: number
    lowFindings: number
}

export class ScanLifecycle {
    private static instance: ScanLifecycle
    private workspaceStorage: vscode.Memento
    private watchtower: Watchtower

    private constructor(context: vscode.ExtensionContext) {
        this.workspaceStorage = context.workspaceState
        this.watchtower = Watchtower.getInstance()
    }

    public static getInstance(context?: vscode.ExtensionContext): ScanLifecycle {
        if (!ScanLifecycle.instance) {
            if (!context) {
                throw new Error('Extension context is required for first initialization')
            }
            ScanLifecycle.instance = new ScanLifecycle(context)
        }
        return ScanLifecycle.instance
    }

    /**
     * Get the current project identifier (workspace folder name)
     */
    private getProjectKey(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('Watchtower: No workspace folders found, using default key')
            return 'default'
        }

        // Use just the folder name to avoid path issues
        const projectName = path.basename(workspaceFolders[0].uri.fsPath)
        console.log(`Watchtower: Using project key: ${projectName}`)
        return projectName
    }

    /**
     * Get project-specific storage key
     */
    private getStorageKey(setting: string): string {
        const key = `${this.getProjectKey()}.${setting}`
        console.log(`Watchtower: Storage key: ${key}`)
        return key
    }

    /**
     * Check if the project has been acknowledged (user has seen scan results and acknowledged them)
     */
    private isProjectProjectStartupScanDisabled(): boolean {
        const key = this.getStorageKey('projectAcknowledged')
        const value = this.workspaceStorage.get<boolean>(key, false)
        console.log(`Watchtower: Project acknowledged for ${this.getProjectKey()}: ${value}`)
        return value
    }

    /**
     * Check if protections (scanning + runtime monitoring) are disabled
     */
    private areProjectProtectionsDisabled(): boolean {
        const key = this.getStorageKey('protectionsDisabled')
        const value = this.workspaceStorage.get<boolean>(key, false)
        console.log(`Watchtower: Protections disabled for ${this.getProjectKey()}: ${value}`)
        return value
    }

    /**
     * Set project acknowledged status
     */
    private async setDisableStartupScanForProject(acknowledged: boolean): Promise<void> {
        const key = this.getStorageKey('projectAcknowledged')
        console.log(`Watchtower: Setting project acknowledged for ${this.getProjectKey()}: ${acknowledged}`)
        await this.workspaceStorage.update(key, acknowledged)

        // Verify the save worked
        const saved = this.workspaceStorage.get<boolean>(key, false)
        console.log(`Watchtower: Verification - project acknowledged is now: ${saved}`)
    }

    /**
     * Set protections disabled status
     */
    private async setProtectionsDisabledForProject(disabled: boolean): Promise<void> {
        const key = this.getStorageKey('protectionsDisabled')
        console.log(`Watchtower: Setting protections disabled for ${this.getProjectKey()}: ${disabled}`)
        await this.workspaceStorage.update(key, disabled)

        // Verify the save worked
        const saved = this.workspaceStorage.get<boolean>(key, false)
        console.log(`Watchtower: Verification - protections disabled is now: ${saved}`)
    }

    /**
     * Generate scan summary from findings
     */
    private generateScanSummary(findings: Finding[]): ScanSummary {
        const highFindings = findings.filter(f => f.priority === 'high').length
        const mediumFindings = findings.filter(f => f.priority === 'medium').length
        const lowFindings = findings.filter(f => f.priority === 'low').length

        return {
            totalFindings: findings.length,
            highFindings,
            mediumFindings,
            lowFindings
        }
    }

    /**
     * Check if startup scans are disabled globally via configuration
     */
    private areStartupScansDisabledGlobally(): boolean {
        const config = vscode.workspace.getConfiguration('watchtower')
        const value = !config.get<boolean>('enableStartupScans', true)
        console.log(`Watchtower: Global startup scans disabled via config: ${value}`)
        return value
    }

    /**
     * Should run scan on startup?
     */
    public shouldRunStartupScan(): boolean {
        // Don't run if startup scans are disabled globally via configuration
        if (this.areStartupScansDisabledGlobally()) {
            return false
        }
        // Don't run if protections are disabled
        if (this.areProjectProtectionsDisabled()) {
            return false
        }
        // Don't run if already acknowledged (but keep background protection)
        if (this.isProjectProjectStartupScanDisabled()) {
            return false
        }
        return true
    }

    /**
     * Should run background file monitoring?
     */
    public shouldRunBackgroundMonitoring(): boolean {
        // Run background monitoring unless protections are fully disabled
        return !this.areProjectProtectionsDisabled()
    }

    /**
     * Run initial scan and show results
     */
    public async runInitialScan(): Promise<void> {
        if (!this.shouldRunStartupScan()) {
            return
        }

        const findings = await this.watchtower.runScan()
        await this.showScanResults(findings)
    }

    /**
     * Run manual scan (always runs regardless of settings)
     */
    public async runManualScan(): Promise<void> {
        const findings = await this.watchtower.runScan()
        await this.showScanResults(findings, true)
    }

    /**
     * Show scan results with summary and action options
     */
    private async showScanResults(findings: Finding[], isManual: boolean = false): Promise<void> {
        const summary = this.generateScanSummary(findings)
        await this.showScanSummary(summary, findings, isManual)
    }

    /**
     * Show scan summary dialog
     */
    private async showScanSummary(summary: ScanSummary, findings: Finding[], isManual: boolean): Promise<void> {
        const { totalFindings, highFindings, mediumFindings, lowFindings } = summary

        let message = 'Watchtower Scan Complete: '

        if (totalFindings === 0) {
            message += 'No potential attack vectors found in this workspace ✅ '
        } else {
            message += `Found ${totalFindings} potential attack vector${totalFindings > 1 ? 's' : ''} ⚠️ `

            const priorities = []
            if (highFindings > 0) priorities.push(`🔴 ${highFindings} high`)
            if (mediumFindings > 0) priorities.push(`🟠 ${mediumFindings} medium`)
            if (lowFindings > 0) priorities.push(`🟡 ${lowFindings} low`)

            if (priorities.length > 0) {
                message += ` (${priorities.join(', ')})`
            }

        }

        const choice = await vscode.window.showWarningMessage(message, 'Show Report')

        if (choice === 'Show Report') {
            await this.handleShowReport(findings)
        }
    }

    /**
     * Handle disable startup scan action
     */
    private async handleDisableStartupScanForProject(): Promise<void> {
        await this.setDisableStartupScanForProject(true)
        vscode.window.showInformationMessage(
            'Startup scans are disabled, but background protection remains active for sensitive file changes.'
        )
    }

    /**
     * Handle disable all protections action
     */
    private async handleDisableAllProtectionsForProject(): Promise<void> {
        const confirmMessage = 'Disabling protections will stop both startup scans and runtime protection (detection of changes to sensitive files). This reduces security monitoring. Do you want to proceed?'

        const choice = await vscode.window.showWarningMessage(
            confirmMessage,
            'Yes, Disable All Protections',
            'Cancel'
        )

        if (choice === 'Yes, Disable All Protections') {
            await this.setProtectionsDisabledForProject(true)
            vscode.window.showInformationMessage(
                'All protections disabled. Use "Watchtower: Enable Background Protections" to re-enable security monitoring.'
            )
        }
    }

    /**
     * Handle show report action
     */
    private async handleShowReport(findings: Finding[]): Promise<void> {
        const projectState = {
            startupScanDisabled: this.isProjectProjectStartupScanDisabled(),
            allScansDisabled: this.areProjectProtectionsDisabled()
        }
        const reportHtml = generateHTMLReport(findings, false, true, projectState) // Include trust actions with state
        const panel = vscode.window.createWebviewPanel(
            'watchtowerReport',
            'Watchtower Security Report',
            vscode.ViewColumn.One,
            { enableScripts: true }
        )

        panel.webview.html = reportHtml

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {

                case 'disableStartupScan':
                    await this.handleDisableStartupScanForProject()
                    panel.dispose()
                    break
                case 'enableStartupScan':
                    await this.enableProjectStartupScan()
                    panel.dispose()
                    break
                case 'disableAllScans':
                    await this.handleDisableAllProtectionsForProject()
                    panel.dispose()
                    break
                case 'enableAllScans':
                    await this.enableBackgroundProtectionsForProject()
                    panel.dispose()
                    break
                case 'exportToJSON':
                    await this.handleExportToJSON(findings, false)
                    break
            }
        })
    }


    /**
     * Handle JSON export from report
     */
    private async handleExportToJSON(findings: Finding[], partial: boolean): Promise<void> {
        try {
            const saveDialogOptions: vscode.SaveDialogOptions = {
                defaultUri: vscode.Uri.file('watchtower-report.json'),
                filters: {
                    'JSON Files': ['json'],
                    'All Files': ['*']
                },
                title: 'Save Watchtower Report as JSON'
            }

            const fileUri = await vscode.window.showSaveDialog(saveDialogOptions)

            if (!fileUri) {
                // User canceled the dialog
                return
            }

            const jsonData = generateJSONReport(findings, partial)
            await fs.promises.writeFile(fileUri.fsPath, jsonData, 'utf8')

            vscode.window.showInformationMessage(
                `Report exported successfully to ${path.basename(fileUri.fsPath)}`
            )
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
        }
    }

    /**
     * Enable all protections (legacy method)
     */
    public async enableProtectionsForProject(): Promise<void> {
        await this.setProtectionsDisabledForProject(false)
        await this.setDisableStartupScanForProject(false)
        vscode.window.showInformationMessage('All protections enabled. Startup scans and background monitoring are now active.')
    }

    /**
     * Get current protection status for display
     */
    public getProtectionStatusForProject(): string {
        const projectName = this.getProjectKey()

        if (this.areProjectProtectionsDisabled()) {
            return `Protections are fully disabled for ${projectName}`
        } else if (this.isProjectProjectStartupScanDisabled()) {
            return `Project ${projectName} acknowledged - startup scans disabled, background protection active`
        } else {
            return `Full protection active for ${projectName} - startup scans and background monitoring enabled`
        }
    }

    /**
     * Get all project settings stored in workspace
     */
    public getAllProjectSettings(): { [projectName: string]: { acknowledged: boolean, protectionsDisabled: boolean } } {
        const allKeys = this.workspaceStorage.keys()
        const projects: { [projectName: string]: { acknowledged: boolean, protectionsDisabled: boolean } } = {}

        console.log('Watchtower: All storage keys:', allKeys)

        // Group settings by project name
        for (const key of allKeys) {
            if (key.includes('.projectAcknowledged')) {
                const projectName = key.replace('.projectAcknowledged', '')
                if (!projects[projectName]) {
                    projects[projectName] = { acknowledged: false, protectionsDisabled: false }
                }
                projects[projectName].acknowledged = this.workspaceStorage.get<boolean>(key, false)
            } else if (key.includes('.protectionsDisabled')) {
                const projectName = key.replace('.protectionsDisabled', '')
                if (!projects[projectName]) {
                    projects[projectName] = { acknowledged: false, protectionsDisabled: false }
                }
                projects[projectName].protectionsDisabled = this.workspaceStorage.get<boolean>(key, false)
            }
        }

        console.log('Watchtower: Project settings:', projects)
        return projects
    }

    /**
     * Clear all project settings from workspace storage
     */
    public async clearAllProjectSettings(): Promise<void> {
        const allKeys = this.workspaceStorage.keys()

        for (const key of allKeys) {
            if (key.includes('.projectAcknowledged') || key.includes('.protectionsDisabled')) {
                await this.workspaceStorage.update(key, undefined)
            }
        }

        vscode.window.showInformationMessage('All project settings cleared from workspace storage.')
    }

    /**
     * Show detailed status of all projects in workspace
     */
    public showDetailedStatus(): void {
        const projects = this.getAllProjectSettings()
        const currentProject = this.getProjectKey()

        let message = 'Watchtower Project Status:\n\n'

        if (Object.keys(projects).length === 0) {
            message += 'No project settings found. All projects use default protection settings.'
        } else {
            for (const [projectName, settings] of Object.entries(projects)) {
                const isCurrent = projectName === currentProject

                message += `${isCurrent ? '→ ' : '  '}${projectName}${isCurrent ? ' (current)' : ''}:\n`

                if (settings.protectionsDisabled) {
                    message += '    🚫 All protections disabled\n'
                } else if (settings.acknowledged) {
                    message += '    ✓ Acknowledged - background protection only\n'
                } else {
                    message += '    🛡️ Full protection active\n'
                }
                message += '\n'
            }
        }

        vscode.window.showInformationMessage(message)
    }

    /**
     * Enable startup scan for current project
     */
    public async enableProjectStartupScan(): Promise<void> {
        await this.setDisableStartupScanForProject(false)
        vscode.window.showInformationMessage('Startup scans enabled. Security monitoring will run on workspace startup.')
    }

    /**
     * Disable startup scan for current project
     */
    public async disableProjectStartupScan(): Promise<void> {
        await this.setDisableStartupScanForProject(true)
        vscode.window.showInformationMessage('Startup scans disabled. Background protection remains active for sensitive file changes.')
    }

    /**
     * Enable background protections for current project
     */
    public async enableBackgroundProtectionsForProject(): Promise<void> {
        await this.setProtectionsDisabledForProject(false)
        vscode.window.showInformationMessage('Background protections enabled. Security monitoring is now active for file changes.')
    }

    /**
     * Disable background protections for current project
     */
    public async disableProjectBackgroundProtections(): Promise<void> {
        const confirmMessage = 'Disabling background protections will stop runtime security monitoring (detection of changes to sensitive files). This reduces security. Do you want to proceed?'

        const choice = await vscode.window.showWarningMessage(
            confirmMessage,
            'Yes, Disable Background Protections',
            'Cancel'
        )

        if (choice === 'Yes, Disable Background Protections') {
            await this.setProtectionsDisabledForProject(true)
            vscode.window.showInformationMessage('Background protections disabled. Only manual scans will be available.')
        }
    }
}
