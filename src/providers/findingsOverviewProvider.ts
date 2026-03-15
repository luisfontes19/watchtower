import * as vscode from 'vscode'
import { Finding, FindingType } from '../types'

export class FindingsOverviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'watchtower.overview'

    private _view?: vscode.WebviewView
    private findings: Finding[] = []
    private hasScanned = false

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView
        webviewView.webview.options = { enableScripts: false }
        this.render()
    }

    setFindings(findings: Finding[]) {
        this.findings = findings
        this.hasScanned = true
        this.render()
    }

    private render() {
        if (!this._view) return

        const total = this.findings.length
        const high = this.findings.filter(f => f.priority === 'high').length
        const medium = this.findings.filter(f => f.priority === 'medium').length
        const low = this.findings.filter(f => f.priority === 'low').length

        const typeCounts = new Map<string, number>()
        for (const f of this.findings) {
            typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1)
        }

        const files = new Set(this.findings.map(f => f.file).filter(Boolean))

        const emptyContent = !this.hasScanned ? `
    <div class="empty">
        <div class="empty-icon">🔍</div>
        <div>No scan has been run yet</div>
    </div>` : `
    <div class="empty">
        <div class="empty-icon">✅</div>
        <div>No findings detected</div>
    </div>`

        this._view.webview.html = `<!DOCTYPE html>
<html><head><style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 12px; margin: 0; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .stat { background: var(--vscode-editor-background); border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1)); border-radius: 6px; padding: 10px; text-align: center; }
    .stat-value { font-size: 1.6em; font-weight: 700; line-height: 1.2; }
    .stat-label { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .stat-high .stat-value { color: var(--vscode-errorForeground, #f44336); }
    .stat-medium .stat-value { color: #ffa726; }
    .stat-low .stat-value { color: #fdd835; }
    .stat-total .stat-value { color: var(--vscode-foreground); }
    .section-title { font-size: 0.82em; font-weight: 600; color: var(--vscode-descriptionForeground); text-transform: uppercase; letter-spacing: 0.5px; margin: 14px 0 6px; }
    .type-row { display: flex; align-items: center; gap: 6px; padding: 4px 6px; font-size: 0.88em; border-radius: 4px; }
    .type-icon { flex-shrink: 0; }
    .type-label { flex: 1; }
    .type-count { font-weight: 600; color: var(--vscode-descriptionForeground); }
    .meta { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-top: 10px; }
    .empty { text-align: center; padding: 20px 0; color: var(--vscode-descriptionForeground); }
    .empty-icon { font-size: 2em; margin-bottom: 6px; }
</style></head><body>${total === 0 ? emptyContent : `
    <div class="summary">
        <div class="stat stat-total"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
        <div class="stat stat-high"><div class="stat-value">${high}</div><div class="stat-label">High</div></div>
        <div class="stat stat-medium"><div class="stat-value">${medium}</div><div class="stat-label">Medium</div></div>
        <div class="stat stat-low"><div class="stat-value">${low}</div><div class="stat-label">Low</div></div>
    </div>`}
</body></html>`
    }
}

function typeIcon(type: string): string {
    const icons: Record<string, string> = {
        [FindingType.Task]: '⚙️',
        [FindingType.JsonSchema]: '📄',
        [FindingType.SilentFileChange]: '👻',
        [FindingType.McpServer]: '🔌',
        [FindingType.InvisibleCode]: '🔍',
        [FindingType.Binary]: '💀',
        [FindingType.Configuration]: '🎯',
        [FindingType.AutoApprove]: '🤖',
        [FindingType.PreinstallScript]: '📦',
    }
    return icons[type] ?? '🔍'
}

function escapeHtml(str: string): string {
    return String(str).replace(/[\u00A0-\u9999<>\&]/g, i => '&#' + i.charCodeAt(0) + ';')

}
