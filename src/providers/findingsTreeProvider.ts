import * as vscode from 'vscode'
import { Finding } from '../types'
import { sanitizeHtml } from '../utils'

const priorityColors: Record<string, string> = {
    high: '#f44336',
    medium: '#ffa726',
    low: '#fdd835',
}

export class FindingsTreeProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'watchtower.findings'

    private _view?: vscode.WebviewView
    private findings: Finding[] = []

    private hoverDecoration = vscode.window.createTextEditorDecorationType({})

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView
        webviewView.webview.options = { enableScripts: true, enableCommandUris: true }
        webviewView.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'revealFinding' && msg.index !== undefined) {
                const items = this.getFilteredFindings()
                const finding = items[msg.index]
                if (finding) this.revealFinding(finding)
            }
        })
        this.updateBadge()
        this.render()
    }

    async revealFinding(finding: Finding): Promise<void> {
        if (!finding.file) return
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
        if (!workspaceFolder) return

        let range: vscode.Range | undefined
        if (finding.range) {
            const r = finding.range as any
            const start = new vscode.Position(
                r.start?.line ?? r[0]?.line ?? 0,
                r.start?.character ?? r[0]?.character ?? 0
            )
            const end = new vscode.Position(
                r.end?.line ?? r[1]?.line ?? 0,
                r.end?.character ?? r[1]?.character ?? 0
            )
            range = new vscode.Range(start, end)
        }

        const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, finding.file)
        const editor = await vscode.window.showTextDocument(fileUri, {
            preserveFocus: false,
            selection: range,
        })

        if (range) {
            const hoverMessage = new vscode.MarkdownString()
            hoverMessage.appendMarkdown(`**🗼 Watchtower — ${finding.type}**\n\n`)
            hoverMessage.appendMarkdown(`**${finding.name}**\n\n`)
            hoverMessage.appendMarkdown(finding.detail.replace(/\n/g, '\n\n'))
            editor.setDecorations(this.hoverDecoration, [{ range, hoverMessage }])
        }
    }

    setFindings(findings: Finding[], _partial = false) {
        this.findings = findings
        vscode.commands.executeCommand('setContext', 'watchtower.hasFindings', findings.length > 0)
        this.updateBadge()
        this.render()
    }

    private updateBadge() {
        if (!this._view) return
        if (this.findings.length === 0) {
            this._view.badge = undefined
            return
        }
        const highest = this.findings.some(f => f.priority === 'high')
            ? 'high'
            : this.findings.some(f => f.priority === 'medium')
                ? 'medium'
                : 'low'
        this._view.badge = {
            value: this.findings.length,
            tooltip: `${this.findings.length} finding${this.findings.length !== 1 ? 's' : ''} (highest: ${highest})`
        }
    }

    private getFilteredFindings(): Finding[] {
        const order = { high: 0, medium: 1, low: 2 }
        return [...this.findings].sort((a, b) => order[a.priority] - order[b.priority])
    }

    private render() {
        if (!this._view) return

        const items = this.getFilteredFindings()

        const listItems = items.map((f, i) => {
            const color = priorityColors[f.priority] ?? '#999'
            return `<div class="item" data-index="${i}">
                <div class="dot" style="background:${color};"></div>
                <div class="content">
                    <div class="name">${sanitizeHtml(f.name)}</div>
                    ${f.file ? `<div class="file">${sanitizeHtml(f.file)}</div>` : ''}
                </div>
            </div>`
        }).join('')

        const empty = items.length === 0
            ? `<div class="empty">No findings yet.<br><a href="command:watchtower.scan">Scan Workspace</a></div>`
            : ''

        this._view.webview.html = `<!DOCTYPE html>
<html><head><style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 0; margin: 0; }
    .item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.06)); }
    .item:hover { background: var(--vscode-list-hoverBackground); }
    .item.selected { background: var(--vscode-list-activeSelectionBackground); color: var(--vscode-list-activeSelectionForeground); }
    .item.selected .file { color: var(--vscode-list-activeSelectionForeground); opacity: 0.8; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .content { flex: 1; min-width: 0; }
    .name { font-size: 0.92em; line-height: 1.3; word-break: break-word; }
    .file { font-size: 0.78em; color: var(--vscode-descriptionForeground); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .empty { text-align: center; padding: 24px 12px; color: var(--vscode-descriptionForeground); font-size: 0.9em; }
    .empty a { color: var(--vscode-textLink-foreground); text-decoration: none; }
    .empty a:hover { text-decoration: underline; }
</style></head><body>
${empty}${listItems}
<script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.item').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.item.selected').forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
            vscode.postMessage({ command: 'revealFinding', index: parseInt(el.dataset.index) });
        });
    });
</script>
</body></html>`
    }
}
