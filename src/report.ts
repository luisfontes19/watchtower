import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { Settings } from './settings'
import { Finding } from './types'

export interface ScanSummary {
    totalFindings: number
    highFindings: number
    mediumFindings: number
    lowFindings: number
}

/**
 * Generate scan summary from findings
 */
export const generateScanSummary = (findings: Finding[]): ScanSummary => {
    return {
        totalFindings: findings.length,
        highFindings: findings.filter(f => f.priority === 'high').length,
        mediumFindings: findings.filter(f => f.priority === 'medium').length,
        lowFindings: findings.filter(f => f.priority === 'low').length
    }
}

/**
 * Show scan results dialog and optionally open the full report panel.
 */
export const showScanResults = async (
    findings: Finding[],
    settings: Settings,
    isManual: boolean = false
): Promise<void> => {
    const { totalFindings, highFindings, mediumFindings, lowFindings } = generateScanSummary(findings)

    let message = 'Watchtower Scan Complete: '

    if (totalFindings === 0) {
        message += 'No potential attack vectors found in this workspace \u2705 '
    } else {
        message += `Found ${totalFindings} potential attack vector${totalFindings > 1 ? 's' : ''} \u26a0\ufe0f `

        const priorities: string[] = []
        if (highFindings > 0) priorities.push(`\ud83d\udd34 ${highFindings} high`)
        if (mediumFindings > 0) priorities.push(`\ud83d\udfe0 ${mediumFindings} medium`)
        if (lowFindings > 0) priorities.push(`\ud83d\udfe1 ${lowFindings} low`)

        if (priorities.length > 0) {
            message += ` (${priorities.join(', ')})`
        }
    }

    const choice = await vscode.window.showWarningMessage(message, 'Show Report')

    if (choice === 'Show Report') {
        await showReportPanel(findings, settings)
    }
}

/**
 * Open the full report webview panel with project trust actions.
 */
export const showReportPanel = async (
    findings: Finding[],
    settings: Settings,
    partial: boolean = false
): Promise<void> => {
    const projectState = settings.getProjectState()
    const reportHtml = generateHTMLReport(findings, partial, true, projectState)
    const panel = vscode.window.createWebviewPanel(
        'watchtowerReport',
        'Watchtower Security Report',
        vscode.ViewColumn.One,
        { enableScripts: true }
    )

    panel.webview.html = reportHtml

    panel.webview.onDidReceiveMessage(async (message) => {
        switch (message.command) {
            case 'disableStartupScan': {
                const confirm = await vscode.window.showWarningMessage(
                    'Disabling Startup Scan means Watchtower will no longer automatically scan this workspace when you open it. You can still run scans manually via the command palette.',
                    { modal: true },
                    'Disable Startup Scan'
                )
                if (confirm === 'Disable Startup Scan') {
                    await settings.setWorkspaceStartupScan(false)
                    panel.dispose()
                }
                break
            }
            case 'enableStartupScan':
                await settings.setWorkspaceStartupScan(true)
                panel.dispose()
                break
            case 'disableRealTimeScans': {
                const confirm = await vscode.window.showWarningMessage(
                    'Disabling Real-Time Protection means Watchtower will no longer monitor file changes in this workspace. New or modified files will not be checked for threats until you run a manual scan.',
                    { modal: true },
                    'Disable Real-Time Protection'
                )
                if (confirm === 'Disable Real-Time Protection') {
                    await settings.setWorkspaceRealTimeDetection(false)
                    panel.dispose()
                }
                break
            }
            case 'enableRealTimeScans':
                await settings.setWorkspaceRealTimeDetection(true)
                panel.dispose()
                break
            case 'exportToJSON':
                await exportToJSON(findings, partial)
                break
        }
    })
}

/**
 * Show a save-dialog and export findings as JSON.
 */
export const exportToJSON = async (findings: Finding[], partial: boolean): Promise<void> => {
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
        if (!fileUri) return

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
 * Show partial-scan alert and optionally open a report or trigger a full scan.
 */
export const showAlerts = async (findings: Finding[]): Promise<void> => {
    if (findings.length === 0) return

    const highCount = findings.filter(f => f.priority === 'high').length
    const medCount = findings.filter(f => f.priority === 'medium').length

    const highestPriority = highCount > 0 ? '\ud83d\udd34 High' : medCount > 0 ? '\ud83d\udfe0 Medium' : '\ud83d\udfe1 Low'

    const files = [...new Set(findings.map(f => f.file).filter(Boolean))]
    const fileList = files.length > 0 ? ` (${files.join(', ')})` : ''

    const message = `\u26a1 Watchtower \u2014 File edited in the background${fileList}. Highest priority: ${highestPriority}`

    const buttons = files.length === 1 ? ['Show Report', 'Open File'] : ['Show Report']
    const action = await vscode.window.showErrorMessage(message, ...buttons)

    if (action === 'Show Report') {
        const settings = Settings.getInstance()
        await showReportPanel(findings, settings, true)
    } else if (action === 'Open File' && files.length === 1) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (workspaceFolder) {
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, files[0])
            await vscode.window.showTextDocument(fileUri)
        }
    }
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
const sanitizeHTML = (str: string | number | boolean): string => {
    return String(str).replace(/[\u00A0-\u9999<>\&]/g, i => '&#' + i.charCodeAt(0) + ';')

}

const priorityConfig = {
    high: { emoji: '🔴', label: 'HIGH', color: '#ef5350', bg: 'rgba(239,83,80,0.08)', border: 'rgba(239,83,80,0.25)' },
    medium: { emoji: '🟠', label: 'MEDIUM', color: '#ffa726', bg: 'rgba(255,167,38,0.08)', border: 'rgba(255,167,38,0.25)' },
    low: { emoji: '🟡', label: 'LOW', color: '#fdd835', bg: 'rgba(253,216,53,0.08)', border: 'rgba(253,216,53,0.25)' },
} as const

const typeEmoji: Record<string, string> = {
    'Suspicious Task': '⚙️',
    'Suspicious JSON Schema': '📄',
    'Silent File Change': '👻',
    'MCP Server Detected': '🔌',
}

const isTrojanSource = (f: Finding) => f.name.startsWith('Trojan Source Character Detected')

const renderTrojanSourceGroup = (findings: Finding[]) => {
    const first = findings[0]
    const sev = priorityConfig[first.priority]
    const icon = '🔍'

    const occurrences = findings.map(f => {
        const charMatch = f.detail.match(/`(U\+[0-9A-F]+)`/)
        const code = charMatch ? charMatch[1] : 'unknown'
        const line = f.range ? f.range.start.line + 1 : '?'
        const col = f.range ? f.range.start.character + 1 : '?'
        return `<code style="background:rgba(100,181,246,0.1);padding:2px 6px;border-radius:3px;">${sanitizeHTML(code)}</code> at line ${line}, col ${col}`
    })

    return `
        <div class="finding" style="border-left:3px solid ${sev.border};background:${sev.bg};border-radius:8px;padding:16px 20px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span style="font-size:1.15em;">${icon}</span>
                <span style="font-weight:700;font-size:1.05em;color:#e0e0e0;">[${sanitizeHTML(first.type)}] Trojan Source Characters Detected (${findings.length} occurrence${findings.length > 1 ? 's' : ''})</span>
                <span class="badge" style="background:${sev.border};color:${sev.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:700;letter-spacing:0.5px;">${sev.emoji} ${sev.label}</span>
            </div>
            <p style="margin:6px 0 8px 28px;color:#bdbdbd;font-size:0.95em;line-height:1.5;">Trojan Source attacks use special Unicode characters to manipulate the display of code, making it appear different from its actual execution.</p>
            <div style="margin:0 0 8px 28px;color:#bdbdbd;font-size:0.9em;line-height:1.8;">
                ${occurrences.join('<br>')}
            </div>
            ${first.file ? `<div style="margin-left:28px;font-size:0.82em;color:#64b5f6;">📂 <code style="background:rgba(100,181,246,0.1);padding:2px 6px;border-radius:3px;">${sanitizeHTML(first.file)}</code></div>` : ''}
        </div>`
}

const renderFindings = (items: Finding[]) => {
    const result: string[] = []
    const trojanByFile = new Map<string, Finding[]>()
    const nonTrojan: Finding[] = []

    for (const f of items) {
        if (isTrojanSource(f)) {
            const group = trojanByFile.get(f.file) ?? []
            group.push(f)
            trojanByFile.set(f.file, group)
        } else {
            nonTrojan.push(f)
        }
    }

    result.push(...nonTrojan.map((f, i) => renderFinding(f, i)))
    for (const group of trojanByFile.values()) {
        result.push(renderTrojanSourceGroup(group))
    }

    return result.join('')
}

const renderFinding = (f: Finding, index: number) => {
    const sev = priorityConfig[f.priority]
    const icon = typeEmoji[sanitizeHTML(f.type)] ?? '🔍'

    return `
        <div class="finding" style="border-left:3px solid ${sev.border};background:${sev.bg};border-radius:8px;padding:16px 20px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span style="font-size:1.15em;">${icon}</span>
                <span style="font-weight:700;font-size:1.05em;color:#e0e0e0;">[${sanitizeHTML(f.type)}] ${sanitizeHTML(f.name)}</span>
                <span class="badge" style="background:${sev.border};color:${sev.color};padding:2px 8px;border-radius:4px;font-size:0.75em;font-weight:700;letter-spacing:0.5px;">${sev.emoji} ${sev.label}</span>
            </div>
            <p style="margin:6px 0 8px 28px;color:#bdbdbd;font-size:0.95em;line-height:1.5;">${sanitizeHTML(f.detail).replace(/\n/g, '<br>')}</p>
            ${f.file ? `<div style="margin-left:28px;font-size:0.82em;color:#64b5f6;">📂 <code style="background:rgba(100,181,246,0.1);padding:2px 6px;border-radius:3px;">${sanitizeHTML(f.file)}</code></div>` : ''}
        </div>`
}

/**
 * Generate JSON report data from findings
 */
export const generateJSONReport = (findings: Finding[], partial: boolean = false): string => {
    const reportData = {
        metadata: {
            generatedAt: new Date().toISOString(),
            scanType: partial ? 'partial' : 'full',
            totalFindings: findings.length,
            summary: {
                high: findings.filter(f => f.priority === 'high').length,
                medium: findings.filter(f => f.priority === 'medium').length,
                low: findings.filter(f => f.priority === 'low').length
            }
        },
        findings: findings.map(finding => ({
            type: finding.type,
            name: finding.name,
            priority: finding.priority,
            detail: finding.detail,
            file: finding.file || null
        }))
    }
    return JSON.stringify(reportData, null, 2)
}

export const generateHTMLReport = (findings: Finding[], partial: boolean = false, includeTrustActions: boolean = false, projectState?: { startupScanDisabled: boolean; realtimeDetectionDisabled: boolean }) => {
    const highCount = findings.filter(f => f.priority === 'high').length
    const medCount = findings.filter(f => f.priority === 'medium').length
    const lowCount = findings.filter(f => f.priority === 'low').length

    const summaryBadge = (emoji: string, count: number, color: string) =>
        `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.04);padding:4px 12px;border-radius:6px;font-size:0.95em;">
            ${emoji} <strong style="color:${color}">${count}</strong>
        </span>`

    const noFindings = `
        <div style="text-align:center;padding:48px 0;">
            <div style="font-size:3em;margin-bottom:12px;">🎉</div>
            <h2 style="color:#66bb6a;margin:0 0 8px;">All Clear!</h2>
            <p style="color:#9e9e9e;font-size:1em;">No suspicious findings were detected in this workspace. Stay safe! 🛡️</p>
        </div>`

    const groupedFindings = () => {
        const sections: string[] = []
        const priorities = ['high', 'medium', 'low'] as const

        for (const sev of priorities) {
            const items = findings.filter(f => f.priority === sev)
            if (items.length === 0) { continue }

            const cfg = priorityConfig[sev]
            sections.push(`
                <div style="margin-top:28px;">
                    <h3 style="color:${cfg.color};font-size:1em;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
                        ${cfg.emoji} ${cfg.label} PRIORITY
                        <span style="font-size:0.8em;color:#757575;font-weight:400;">(${items.length} finding${items.length > 1 ? 's' : ''})</span>
                    </h3>
                    ${renderFindings(items)}
                </div>`)
        }
        return sections.join('')
    }

    const findingsHtml = findings.length ? groupedFindings() : noFindings

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Watchtower Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
            margin: 0; padding: 32px;
            background: #1e1e1e; color: #e0e0e0;
            line-height: 1.6;
        }
        code { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace; }
        .header { margin-bottom: 32px; }
        .finding { transition: background 0.15s ease; }
        .finding:hover { filter: brightness(1.15); }
        hr { border: none; border-top: 1px solid #333; margin: 24px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1 style="margin:0 0 4px;font-size:1.6em;color:#42a5f5;">
            🗼Watchtower Report
        </h1>
        ${partial
            ? `<div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,152,0,0.1);border:1px solid rgba(255,152,0,0.3);border-radius:6px;padding:6px 14px;margin-bottom:12px;font-size:0.88em;">
                    ⚡ <span style="color:#ffa726;"><strong>Partial Scan</strong> — Only changed file was analyzed.</span>
                </div>`
            : ''}
        <p style="margin:0 0 16px;color:#757575;font-size:0.92em;">
            ${partial ? 'Partial scan' : 'Full workspace scan'} completed — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${summaryBadge('🔴', highCount, '#ef5350')}
            ${summaryBadge('🟠', medCount, '#ffa726')}
            ${summaryBadge('🟡', lowCount, '#fdd835')}
            <span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.04);padding:4px 12px;border-radius:6px;font-size:0.95em;">
                📊 <strong style="color:#90caf9">${findings.length}</strong> <span style="color:#757575">total</span>
            </span>
        </div>
    </div>
    <div style="background:rgba(66,165,245,0.06);border:1px solid rgba(66,165,245,0.15);border-radius:8px;padding:16px 20px;margin-bottom:8px;">
        <p style="margin:0;color:#90caf9;font-size:0.92em;line-height:1.6;">
            🔎 <strong>What is this?</strong> — Watchtower scans your workspace for potential attack vectors that could compromise your development environment.
            This includes suspicious VS Code tasks, malicious JSON schema references, hidden unicode characters, unauthorized MCP servers, and silent background file modifications.
            These are common techniques used in <strong>supply chain attacks</strong> and <strong>IDE-targeted exploits</strong> to execute arbitrary code, exfiltrate data, or tamper with your project.
        </p>
    </div>
    <hr/>
    ${findingsHtml}
    ${includeTrustActions ? generateTrustActionsHTML(projectState) : ''}
    <hr/>
    <p style="text-align:center;color:#616161;font-size:0.82em;margin-top:24px;">
        Generated by <strong style="color:#42a5f5;">Watchtower</strong> � — Keep your workspace safe!
    </p>
</body>
</html>`
}

/**
 * Generate trust actions HTML section
 */
export const generateTrustActionsHTML = (projectState?: { startupScanDisabled: boolean; realtimeDetectionDisabled: boolean }): string => {
    const isRestricted = !vscode.workspace.isTrusted
    const startupScanDisabled = projectState?.startupScanDisabled || false
    const realtimeDetectionDisabled = projectState?.realtimeDetectionDisabled || false

    // Determine button states
    const startupButton = startupScanDisabled
        ? { text: 'Enable Startup Scan', action: 'enableStartupScan()', color: '#4caf50' }
        : { text: 'Disable Startup Scan', action: 'disableStartupScan()', color: '#ffa726' }

    const allScansButton = realtimeDetectionDisabled
        ? { text: 'Enable Real-Time Detection', action: 'enableRealTimeScans()', color: '#4caf50' }
        : { text: 'Disable Real-Time Detection', action: 'disableRealTimeScans()', color: '#f44336' }

    let html = `
        <div class="actions" style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #333;">
            <h3 style="color: #42a5f5; margin-bottom: 16px;">🛡️ Project Actions</h3>
            <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;">
                <button class="button" onclick="${startupButton.action}" style="background: ${startupButton.color}; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">${startupButton.text}</button>
                <button class="button" onclick="${allScansButton.action}" style="background: ${allScansButton.color}; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">${allScansButton.text}</button>
                <button class="button" onclick="exportToJSON()" style="background: #7c4dff; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-family: inherit;">📄 Export to JSON</button>
            </div>
            <div style="margin-bottom: 16px; font-size: 0.9em; color: #9e9e9e;">
                <p style="margin: 4px 0;">• <strong>Startup Scan:</strong> ${startupScanDisabled ? 'Currently disabled' : 'Currently enabled'} - Automatic scans when opening workspace</p>
                <p style="margin: 4px 0;">• <strong>Real-Time Detection:</strong> ${realtimeDetectionDisabled ? 'Currently disabled' : 'Currently enabled'} - File change monitoring</p>
            </div>`

    if (!isRestricted) {
        html += `
            <div class="restriction-info" style="background: rgba(76, 175, 80, 0.1); border: 1px solid rgba(76, 175, 80, 0.3); padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h4 style="margin-top: 0; color: #81c784;">💡 Recommendation: Restrict Workspace</h4>
                <p style="color: #9e9e9e; margin-bottom: 12px;">This workspace is currently <strong style="color: #ffa726;">trusted</strong>. For enhanced security, consider restricting it:</p>
                <ol style="color: #9e9e9e; margin-left: 20px;">
                    <li>Go to <strong>File > Add Folder to Workspace</strong></li>
                    <li>Choose <strong>"Don't Trust"</strong> when prompted</li>
                    <li>Or use <strong>Command Palette > "Workspaces: Manage Workspace Trust"</strong></li>
                </ol>
                <p style="color: #9e9e9e; margin-bottom: 0;">Restricted workspaces prevent automatic execution of potentially malicious code.</p>
            </div>`
    }

    html += `
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            function disableStartupScan() {
                vscode.postMessage({ command: 'disableStartupScan' });
            }

            function enableStartupScan() {
                vscode.postMessage({ command: 'enableStartupScan' });
            }

            function disableRealTimeScans() {
                vscode.postMessage({ command: 'disableRealTimeScans' });
            }

            function enableRealTimeScans() {
                vscode.postMessage({ command: 'enableRealTimeScans' });
            }

            function exportToJSON() {
                vscode.postMessage({ command: 'exportToJSON' });
            }
        </script>`

    return html
}
