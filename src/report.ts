import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import { Finding } from './types'
import { sanitizeHtml as esc } from './utils'
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
 * Show an HTML report in a webview panel.
 */
export const showHTMLReport = (findings: Finding[], extensionUri: vscode.Uri): void => {
    const panel = vscode.window.createWebviewPanel(
        'watchtower.report',
        'Watchtower Report',
        vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'data', 'images')] }
    )
    const iconUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'data', 'images', 'icon.png'))
    panel.webview.html = generateHTMLReport(findings, iconUri)
    panel.webview.onDidReceiveMessage(msg => {
        if (msg.command === 'openFile' && msg.file) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
            if (!workspaceFolder) return
            const fileUri = vscode.Uri.joinPath(workspaceFolder.uri, msg.file)
            vscode.window.showTextDocument(fileUri, { preserveFocus: false })
        }
    })
}

/**
 * Generate a self-contained HTML report from findings.
 */
export const generateHTMLReport = (findings: Finding[], iconUri?: vscode.Uri): string => {
    const high = findings.filter(f => f.priority === 'high')
    const medium = findings.filter(f => f.priority === 'medium')
    const low = findings.filter(f => f.priority === 'low')

    const typeCounts = new Map<string, number>()
    for (const f of findings) {
        typeCounts.set(f.type, (typeCounts.get(f.type) ?? 0) + 1)
    }
    const files = new Set(findings.map(f => f.file).filter(Boolean))



    const row = (f: Finding) => {
        const color = f.priority === 'high' ? '#f44336' : f.priority === 'medium' ? '#ffa726' : '#fdd835'
        const fileCell = f.file
            ? `<a class="file-link" data-file="${esc(f.file)}">${esc(f.file)}</a>`
            : '\u2014'
        return `<tr>
            <td><span class="badge" style="background:${color}">${esc(f.priority)}</span></td>
            <td>${esc(f.type)}</td>
            <td><div class="finding-name">${esc(f.name)}</div><div class="finding-detail">${esc(f.detail.replace(/\n/g, ' '))}</div></td>
            <td class="file">${fileCell}</td>
        </tr>`
    }

    const typeRows = [...typeCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `<tr><td>${esc(type)}</td><td>${count}</td></tr>`)
        .join('')

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Watchtower Report</title>
<style>
  :root { --bg: var(--vscode-editor-background, #1e1e1e); --fg: var(--vscode-foreground, #ccc); --border: var(--vscode-widget-border, rgba(255,255,255,0.1)); }
  body { font-family: var(--vscode-font-family, system-ui, sans-serif); font-size: 14px; background: var(--bg); color: var(--fg); margin: 0; padding: 24px 32px; }
  h1 { font-size: 1.5em; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
  .header-icon { width: 28px; height: 28px; }
  .meta { font-size: 0.9em; color: var(--vscode-descriptionForeground, #888); margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid var(--border); border-radius: 8px; padding: 14px; text-align: center; }
  .card .val { font-size: 2em; font-weight: 700; }
  .card .lbl { font-size: 0.85em; color: var(--vscode-descriptionForeground, #888); margin-top: 2px; }
  .high .val { color: #f44336; } .medium .val { color: #ffa726; } .low .val { color: #fdd835; }
  h2 { font-size: 1.1em; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 1em; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
  th { font-weight: 600; color: var(--vscode-descriptionForeground, #888); text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.5px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; color: #fff; font-size: 0.85em; font-weight: 600; text-transform: uppercase; }
  .finding-name { font-weight: 600; margin-bottom: 2px; }
  .finding-detail { font-size: 0.92em; color: var(--vscode-descriptionForeground, #888); word-break: break-word; }
  .file { font-size: 0.9em; color: var(--vscode-descriptionForeground, #888); }
  .file-link { color: var(--vscode-textLink-foreground, #3794ff); text-decoration: none; cursor: pointer; }
  .file-link:hover { text-decoration: underline; }
</style>
</head><body>
<h1>${iconUri ? `<img src="${iconUri}" class="header-icon" />` : ''} Watchtower Report</h1>
<div class="meta">Generated ${new Date().toLocaleString()} &mdash; ${findings.length} finding${findings.length !== 1 ? 's' : ''} across ${files.size} file${files.size !== 1 ? 's' : ''}</div>

<h2>All Findings</h2>
<table>
<tr><th>Priority</th><th>Type</th><th>Finding</th><th>File</th></tr>
${findings.map(row).join('')}
</table>
<script>
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('.file-link').forEach(el => {
        el.addEventListener('click', () => {
            vscode.postMessage({ command: 'openFile', file: el.dataset.file });
        });
    });
</script>
</body></html>`
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
