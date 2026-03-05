import * as vscode from 'vscode'
import { generateHTMLReport } from './report'
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
     * Check if the project has been acknowledged (user has seen scan results and acknowledged them)
     */
    private isProjectAcknowledged(): boolean {
        return this.workspaceStorage.get<boolean>('projectAcknowledged', false)
    }

    /**
     * Check if protections (scanning + runtime monitoring) are disabled
     */
    private areProtectionsDisabled(): boolean {
        return this.workspaceStorage.get<boolean>('protectionsDisabled', false)
    }

    /**
     * Set project acknowledged status
     */
    private async setProjectAcknowledged(acknowledged: boolean): Promise<void> {
        await this.workspaceStorage.update('projectAcknowledged', acknowledged)
    }

    /**
     * Set protections disabled status
     */
    private async setProtectionsDisabled(disabled: boolean): Promise<void> {
        await this.workspaceStorage.update('protectionsDisabled', disabled)
    }

    /**
     * Check if workspace is restricted (untrusted)
     */
    private isWorkspaceRestricted(): boolean {
        return !vscode.workspace.isTrusted
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
     * Should run scan on startup?
     */
    public shouldRunStartupScan(): boolean {
        // Don't run if protections are disabled
        if (this.areProtectionsDisabled()) {
            return false
        }
        // Don't run if already acknowledged (but keep background protection)
        if (this.isProjectAcknowledged()) {
            return false
        }
        return true
    }

    /**
     * Should run background file monitoring?
     */
    public shouldRunBackgroundMonitoring(): boolean {
        // Run background monitoring unless protections are fully disabled
        return !this.areProtectionsDisabled()
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
            message += 'No security issues found in this workspace ✅ '
        } else {
            message += `Found ${totalFindings} security issue${totalFindings > 1 ? 's' : ''} ⚠️ `

            const priorities = []
            if (highFindings > 0) priorities.push(`🔴 ${highFindings} high`)
            if (mediumFindings > 0) priorities.push(`🟠 ${mediumFindings} medium`)
            if (lowFindings > 0) priorities.push(`🟡 ${lowFindings} low`)

            if (priorities.length > 0) {
                message += ` (${priorities.join(', ')})`
            }
            const showAcknowledge = !isManual || !this.isProjectAcknowledged()
            const options = []

            if (showAcknowledge) {
                options.push('Acknowledge')
            }
            options.push('Disable Protections', 'Show Report')

            const choice = await vscode.window.showWarningMessage(message, ...options)

            switch (choice) {
                case 'Acknowledge':
                    await this.handleAcknowledge()
                    break
                case 'Disable Protections':
                    await this.handleDisableProtections()
                    break
                case 'Show Report':
                    await this.handleShowReport(findings)
                    break
            }
        }
    }

    /**
     * Handle acknowledge action
     */
    private async handleAcknowledge(): Promise<void> {
        await this.setProjectAcknowledged(true)
        vscode.window.showInformationMessage(
            'Project acknowledged. Startup scans are disabled, but background protection remains active for sensitive file changes.'
        )
    }

    /**
     * Handle disable protections action
     */
    public async handleDisableProtections(): Promise<void> {
        const confirmMessage = 'Disabling protections will stop both startup scans and runtime protection (detection of changes to sensitive files). This reduces security monitoring. Do you want to proceed?'

        const choice = await vscode.window.showWarningMessage(
            confirmMessage,
            'Yes, Disable All Protections',
            'Cancel'
        )

        if (choice === 'Yes, Disable All Protections') {
            await this.setProtectionsDisabled(true)
            vscode.window.showInformationMessage(
                'All protections disabled. Use "Watchtower: Enable Protections" to re-enable security monitoring.'
            )
        }
    }

    /**
     * Handle show report action
     */
    private async handleShowReport(findings: Finding[]): Promise<void> {
        const reportHtml = generateHTMLReport(findings, false, true) // Include trust actions
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
                case 'trustProject':
                    await this.handleTrustProject()
                    break
            }
        })
    }

    /**
     * Handle trust project action from report
     */
    private async handleTrustProject(): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            'Trust this project? This will disable all security scans for this workspace.',
            'Yes, Trust Project',
            'Cancel'
        )

        if (choice === 'Yes, Trust Project') {
            await this.setProjectAcknowledged(true)
            await this.setProtectionsDisabled(true)
            vscode.window.showInformationMessage('Project trusted. All security monitoring disabled.')
        }
    }

    /**
     * Remove acknowledgement (better name for untrust)
     */
    public async resetProjectAcknowledgement(): Promise<void> {
        await this.setProjectAcknowledged(false)
        vscode.window.showInformationMessage('Project acknowledgement removed. Startup scans will resume.')
    }

    /**
     * Enable protections
     */
    public async enableProtections(): Promise<void> {
        await this.setProtectionsDisabled(false)
        await this.setProjectAcknowledged(false)
        vscode.window.showInformationMessage('Protections enabled. Security monitoring is now active.')
    }

    /**
     * Get current protection status for display
     */
    public getProtectionStatus(): string {
        if (this.areProtectionsDisabled()) {
            return 'Protections are fully disabled'
        } else if (this.isProjectAcknowledged()) {
            return 'Project acknowledged - startup scans disabled, background protection active'
        } else {
            return 'Full protection active - startup scans and background monitoring enabled'
        }
    }
}
