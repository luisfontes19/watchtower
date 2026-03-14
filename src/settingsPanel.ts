import * as vscode from 'vscode'
import { Settings } from './settings'
import { InlineFindingType } from './types'

export function showSettingsPanel() {
    const settings = Settings.getInstance()

    const panel = vscode.window.createWebviewPanel(
        'watchtowerSettings',
        'Watchtower Settings',
        { viewColumn: vscode.ViewColumn.Active, preserveFocus: false },
        { enableScripts: false }
    )

    const globalStartupScans = settings.shouldRunStartupScanForWorkspace() || settings.getWorkspaceStartupScan()
    const runOnlyRestricted = settings.runsOnlyOnRestrictedWorkspaces()
    const inlineFindings = settings.getGlobalInlineFindings()
    const workspaceStartup = settings.getWorkspaceStartupScan()
    const workspaceRealTime = settings.getWorkspaceRealTimeDetection()
    const isTrusted = vscode.workspace.isTrusted
    const restrictedEnforced = settings.shouldEnforceRestrictedScanOnlySetting()
    const projectOverridesGlobal = settings.hasAnyExplicitProjectSetting()

    const globalStartupRaw = vscode.workspace
        .getConfiguration('watchtower')
        .get<boolean>('enableStartupScans', true)

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name ?? 'No workspace'

    panel.webview.html = getHtml({
        globalStartupScans: globalStartupRaw,
        runOnlyRestricted,
        inlineFindings,
        workspaceStartup,
        workspaceRealTime,
        workspaceName,
        isTrusted,
        restrictedEnforced,
        projectOverridesGlobal,
    })
}

interface SettingsData {
    globalStartupScans: boolean
    runOnlyRestricted: boolean
    inlineFindings: InlineFindingType
    workspaceStartup: boolean
    workspaceRealTime: boolean
    workspaceName: string
    isTrusted: boolean
    restrictedEnforced: boolean
    projectOverridesGlobal: boolean
}

function badge(enabled: boolean, label?: string): string {
    if (enabled) {
        return `<span class="badge enabled">${label ?? 'Enabled'}</span>`
    }
    return `<span class="badge disabled">${label ?? 'Disabled'}</span>`
}

function inlineBadge(type: InlineFindingType): string {
    switch (type) {
        case InlineFindingType.all:
            return `<span class="badge enabled">All</span>`
        case InlineFindingType.invisible:
            return `<span class="badge partial">Invisible Only</span>`
        case InlineFindingType.none:
            return `<span class="badge disabled">None</span>`
    }
}

function getHtml(data: SettingsData): string {
    const trustBadge = data.isTrusted
        ? '<span class="badge enabled">Trusted</span>'
        : '<span class="badge warning">Restricted</span>'

    const effectiveNote = data.restrictedEnforced
        ? `<div class="note warning-note">
            <span class="note-icon">⚠️</span>
            <span>Scans are currently <strong>inactive</strong> because <em>Run Only on Restricted Workspaces</em> is enabled and this workspace is trusted.</span>
           </div>`
        : ''

    const projectOverrideNote = data.projectOverridesGlobal
        ? `<div class="note warning-note">
            <span class="note-icon">ℹ️</span>
            <span>Project settings are currently <strong>overriding</strong> global settings for this workspace.</span>
           </div>`
        : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
    <title>Watchtower Settings</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --border: var(--vscode-widget-border, var(--vscode-editorGroup-border));
            --card-bg: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
            --muted: var(--vscode-descriptionForeground);
            --accent: var(--vscode-textLink-foreground);
            --enabled-bg: rgba(72, 199, 142, 0.15);
            --enabled-fg: #48c78e;
            --disabled-bg: rgba(255, 100, 100, 0.12);
            --disabled-fg: #f87171;
            --partial-bg: rgba(255, 183, 77, 0.15);
            --partial-fg: #ffb74d;
            --warning-bg: rgba(255, 183, 77, 0.12);
            --warning-fg: #ffb74d;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
            font-size: var(--vscode-font-size, 13px);
            color: var(--fg);
            background: var(--bg);
            display: flex;
            justify-content: center;
            padding: 32px 16px;
        }

        .container {
            max-width: 520px;
            width: 100%;
        }

        .header {
            text-align: center;
            margin-bottom: 24px;
        }

        .header h1 {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.3px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .header .subtitle {
            color: var(--muted);
            font-size: 12px;
            margin-top: 4px;
        }

        .card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }

        .card-title {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: var(--muted);
            margin-bottom: 14px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .setting-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
        }

        .setting-row + .setting-row {
            border-top: 1px solid var(--border);
        }

        .setting-label {
            font-size: 13px;
            font-weight: 500;
        }

        .setting-desc {
            font-size: 11px;
            color: var(--muted);
            margin-top: 2px;
        }

        .badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 600;
            padding: 3px 10px;
            border-radius: 12px;
            white-space: nowrap;
        }

        .badge.enabled {
            background: var(--enabled-bg);
            color: var(--enabled-fg);
        }

        .badge.disabled {
            background: var(--disabled-bg);
            color: var(--disabled-fg);
        }

        .badge.partial {
            background: var(--partial-bg);
            color: var(--partial-fg);
        }

        .badge.warning {
            background: var(--warning-bg);
            color: var(--warning-fg);
        }

        .workspace-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 14px;
        }

        .workspace-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--accent);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 260px;
        }

        .note {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            font-size: 12px;
            padding: 10px 12px;
            border-radius: 6px;
            margin-top: 16px;
        }

        .note .note-icon { flex-shrink: 0; }

        .warning-note {
            background: var(--warning-bg);
            color: var(--warning-fg);
        }

        .divider {
            height: 1px;
            background: var(--border);
            margin: 4px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏰 Watchtower Settings</h1>
            <div class="subtitle">Current configuration overview</div>
        </div>

        <div class="card">
            <div class="card-title">⚙️ Global Settings</div>
            <div class="setting-row">
                <div>
                    <div class="setting-label">Startup Scans</div>
                    <div class="setting-desc">Scan workspaces on open</div>
                </div>
                ${badge(data.globalStartupScans)}
            </div>
            <div class="setting-row">
                <div>
                    <div class="setting-label">Run Only on Restricted Workspaces</div>
                    <div class="setting-desc">Limit scans to untrusted workspaces</div>
                </div>
                ${data.runOnlyRestricted
                    ? '<span class="badge warning">Enabled</span>'
                    : '<span class="badge enabled">Disabled</span>'}
            </div>
            <div class="setting-row">
                <div>
                    <div class="setting-label">Inline Findings</div>
                    <div class="setting-desc">Highlight findings in the editor</div>
                </div>
                ${inlineBadge(data.inlineFindings)}
            </div>
        </div>

        <div class="card">
            <div class="workspace-header">
                <div class="card-title" style="margin-bottom:0">📁 Project Settings</div>
                ${trustBadge}
            </div>
            <div class="workspace-name">${escapeHtml(data.workspaceName)}</div>
            <div style="margin-top: 14px;">
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Run on Startup</div>
                        <div class="setting-desc">Scan this project when opened</div>
                    </div>
                    ${badge(data.workspaceStartup)}
                </div>
                <div class="setting-row">
                    <div>
                        <div class="setting-label">Real-Time Detection</div>
                        <div class="setting-desc">Monitor file changes live</div>
                    </div>
                    ${badge(data.workspaceRealTime)}
                </div>
            </div>
            ${effectiveNote}
            ${projectOverrideNote}
        </div>
    </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}
