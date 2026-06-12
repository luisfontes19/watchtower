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

    private getDetailWithReferencesMarkdown(finding: Finding): string {
        const references = finding.references && finding.references.length > 0
            ? `\n\n**References**\n\n${finding.references.map(url => `- ${url}`).join('\n')}`
            : ''
        return `${finding.detail}${references}`
    }

    resolveWebviewView(webviewView: vscode.WebviewView) {
        this._view = webviewView
        webviewView.webview.options = { enableScripts: true, enableCommandUris: true }
        webviewView.webview.onDidReceiveMessage(msg => {
            if (msg.command === 'revealFinding' && msg.index !== undefined) {
                const items = this.getFilteredFindings()
                const finding = items[msg.index]
                if (finding) this.revealFinding(finding)
            }
            if (msg.command === 'excludeFile' && msg.index !== undefined) {
                const items = this.getFilteredFindings()
                const finding = items[msg.index]
                if (!finding?.file) return
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
                if (!workspaceFolder) return
                const filePath = finding.file.endsWith('/') ? finding.file.slice(0, -1) : finding.file
                const uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath)
                vscode.commands.executeCommand('watchtower.excludeFile', uri)
            }
        })
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
            hoverMessage.appendMarkdown(this.getDetailWithReferencesMarkdown(finding).replace(/\n/g, '\n\n'))
            editor.setDecorations(this.hoverDecoration, [{ range, hoverMessage }])
        }
    }

    setFindings(findings: Finding[]) {
        this.findings = findings
        vscode.commands.executeCommand('setContext', 'watchtower.hasFindings', findings.length > 0)
        this.render()
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
    #ctx-menu { display: none; position: fixed; z-index: 1000; background: var(--vscode-menu-background); border: 1px solid var(--vscode-menu-border, var(--vscode-widget-border)); border-radius: 4px; padding: 4px 0; min-width: 180px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    #ctx-menu .ctx-item { padding: 6px 14px; cursor: pointer; font-size: 0.9em; color: var(--vscode-menu-foreground); }
    #ctx-menu .ctx-item:hover { background: var(--vscode-menu-selectionBackground); color: var(--vscode-menu-selectionForeground); }
</style></head><body>
${empty}${listItems}
<div id="ctx-menu"><div class="ctx-item" id="ctx-exclude">Exclude from scan</div></div>
<script>
    const vscode = acquireVsCodeApi();
    const ctxMenu = document.getElementById('ctx-menu');
    const ctxExclude = document.getElementById('ctx-exclude');
    let activeIndex = -1;

    document.querySelectorAll('.item').forEach(el => {
        el.addEventListener('click', () => {
            document.querySelectorAll('.item.selected').forEach(s => s.classList.remove('selected'));
            el.classList.add('selected');
            vscode.postMessage({ command: 'revealFinding', index: parseInt(el.dataset.index) });
        });
        el.addEventListener('contextmenu', e => {
            e.preventDefault();
            activeIndex = parseInt(el.dataset.index);
            ctxMenu.style.display = 'block';
            const x = Math.min(e.clientX, window.innerWidth - ctxMenu.offsetWidth - 4);
            const y = Math.min(e.clientY, window.innerHeight - ctxMenu.offsetHeight - 4);
            ctxMenu.style.left = x + 'px';
            ctxMenu.style.top = y + 'px';
        });
    });

    ctxExclude.addEventListener('click', () => {
        if (activeIndex >= 0) vscode.postMessage({ command: 'excludeFile', index: activeIndex });
        ctxMenu.style.display = 'none';
        activeIndex = -1;
    });

    document.addEventListener('click', () => { ctxMenu.style.display = 'none'; activeIndex = -1; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { ctxMenu.style.display = 'none'; activeIndex = -1; } });
</script>
</body></html>`
    }
}
